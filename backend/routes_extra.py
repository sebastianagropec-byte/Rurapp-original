"""Additional routes for Rurapp v2: Chat, Verification, COL payments, Admin."""
import os
import logging
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, Query
from typing import List, Optional

from auth import get_current_user_id, decode_token
from models import (
    ConversationCreate, MessageCreate, ChatMessage, Conversation,
    VerificationSubmit, Verification, AdminReviewRequest,
    now_iso, gen_id,
)
from email_service import send_chat_notification
from payments_co import wompi, mercadopago
from ws_manager import manager
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)
extra_router = APIRouter(prefix="/api")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]


async def _get_user(db, user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


def _is_admin(user: dict) -> bool:
    return user.get("is_admin") or user.get("email", "").lower() in ADMIN_EMAILS


# ===========================
# CHAT
# ===========================
def register_chat_routes(db):
    @extra_router.post("/conversations", response_model=Conversation)
    async def get_or_create_conversation(
        payload: ConversationCreate,
        user_id: str = Depends(get_current_user_id),
    ):
        if payload.other_user_id == user_id:
            raise HTTPException(status_code=400, detail="No puedes chatear contigo mismo")
        me = await _get_user(db, user_id)
        other = await _get_user(db, payload.other_user_id)
        participants = sorted([user_id, payload.other_user_id])
        existing = await db.conversations.find_one(
            {"participants": participants}, {"_id": 0}
        )
        if existing:
            return Conversation(**existing)
        conv = Conversation(
            participants=participants,
            participant_names={user_id: me["full_name"], payload.other_user_id: other["full_name"]},
            unread_for={user_id: 0, payload.other_user_id: 0},
        )
        await db.conversations.insert_one(conv.model_dump())
        return conv

    @extra_router.get("/conversations", response_model=List[Conversation])
    async def list_conversations(user_id: str = Depends(get_current_user_id)):
        docs = await db.conversations.find(
            {"participants": user_id}, {"_id": 0}
        ).sort("last_message_at", -1).to_list(200)
        return [Conversation(**d) for d in docs]

    @extra_router.get("/conversations/{conv_id}/messages", response_model=List[ChatMessage])
    async def get_messages(conv_id: str, user_id: str = Depends(get_current_user_id)):
        conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
        if not conv or user_id not in conv["participants"]:
            raise HTTPException(status_code=403, detail="No autorizado")
        docs = await db.chat_messages.find(
            {"conversation_id": conv_id}, {"_id": 0}
        ).sort("created_at", 1).to_list(1000)
        # mark as read
        await db.conversations.update_one(
            {"id": conv_id}, {"$set": {f"unread_for.{user_id}": 0}}
        )
        return [ChatMessage(**d) for d in docs]

    @extra_router.post("/messages", response_model=ChatMessage)
    async def send_message(
        payload: MessageCreate,
        user_id: str = Depends(get_current_user_id),
    ):
        conv = await db.conversations.find_one({"id": payload.conversation_id}, {"_id": 0})
        if not conv or user_id not in conv["participants"]:
            raise HTTPException(status_code=403, detail="No autorizado")
        me = await _get_user(db, user_id)
        msg = ChatMessage(
            conversation_id=payload.conversation_id,
            sender_id=user_id,
            sender_name=me["full_name"],
            content=payload.content,
            read_by=[user_id],
        )
        await db.chat_messages.insert_one(msg.model_dump())

        # Update conversation
        other_id = next(p for p in conv["participants"] if p != user_id)
        await db.conversations.update_one(
            {"id": payload.conversation_id},
            {
                "$set": {
                    "last_message": payload.content[:200],
                    "last_message_at": now_iso(),
                },
                "$inc": {f"unread_for.{other_id}": 1},
            },
        )

        # Realtime push
        delivered = await manager.send_to_user(other_id, {
            "type": "message",
            "conversation_id": payload.conversation_id,
            "message": msg.model_dump(),
        })

        # If recipient offline, queue email notification
        if not delivered:
            other = await _get_user(db, other_id)
            if other.get("email"):
                try:
                    await send_chat_notification(
                        to_email=other["email"],
                        recipient_name=other["full_name"],
                        sender_name=me["full_name"],
                        preview=payload.content,
                        link=f"https://rurapp.co/chat/{payload.conversation_id}",
                    )
                except Exception as e:
                    logger.warning("Chat email notification failed: %s", e)

        return msg

    @extra_router.websocket("/ws/chat")
    async def chat_ws(ws: WebSocket, token: str = Query(...)):
        try:
            payload = decode_token(token)
            user_id = payload["sub"]
        except HTTPException:
            await ws.close(code=4401)
            return
        await manager.connect(user_id, ws)
        try:
            while True:
                # keep alive; we mostly push from server-side
                await ws.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(user_id, ws)
        except Exception as e:
            logger.warning("WS error for %s: %s", user_id, e)
            manager.disconnect(user_id, ws)


# ===========================
# VERIFICATION
# ===========================
def register_verification_routes(db):
    @extra_router.post("/verifications", response_model=Verification)
    async def submit_verification(
        payload: VerificationSubmit,
        user_id: str = Depends(get_current_user_id),
    ):
        user = await _get_user(db, user_id)
        if user["role"] != "veterinario":
            raise HTTPException(status_code=403, detail="Solo expertos pueden solicitar verificación")

        # Pre-analysis with Claude
        ai_analysis = ""
        ai_recommendation = "review"
        try:
            session_id = gen_id()
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message=(
                    "Eres un asistente de verificación de profesionales del agro en Colombia. "
                    "Te darán datos auto-reportados por un veterinario o experto. "
                    "Evalúa la coherencia de la información (no validas autenticidad de documentos, "
                    "solo coherencia y completitud). Responde en este formato exacto:\n"
                    "RECOMENDACION: [approve|review|reject]\n"
                    "RAZON: [breve explicación en 1-2 frases]"
                ),
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            prompt = (
                f"Nombre profesional: {payload.professional_name}\n"
                f"Tipo de documento: {payload.document_type}\n"
                f"Número/matrícula: {payload.professional_id}\n"
                f"Institución: {payload.institution or '(no provista)'}\n"
                f"Notas: {payload.notes or '(ninguna)'}\n"
                f"Especialidad declarada: {user.get('specialty') or '(ninguna)'}\n"
                f"URL/data documento: {'(adjunta)' if payload.document_url else '(sin documento)'}"
            )
            reply = await chat.send_message(UserMessage(text=prompt))
            ai_analysis = reply
            for line in reply.splitlines():
                if line.upper().startswith("RECOMENDACION"):
                    val = line.split(":", 1)[-1].strip().lower()
                    if val in ("approve", "review", "reject"):
                        ai_recommendation = val
                        break
        except Exception as e:
            logger.warning("AI verification analysis failed: %s", e)
            ai_analysis = f"AI analysis no disponible: {str(e)[:120]}"
            ai_recommendation = "review"

        status = "ai_approved" if ai_recommendation == "approve" else "pending"
        ver = Verification(
            user_id=user_id,
            user_email=user["email"],
            user_name=user["full_name"],
            document_type=payload.document_type,
            document_url=payload.document_url,
            professional_name=payload.professional_name,
            professional_id=payload.professional_id,
            institution=payload.institution,
            notes=payload.notes,
            ai_analysis=ai_analysis,
            ai_recommendation=ai_recommendation,
            status=status,
        )
        await db.verifications.insert_one(ver.model_dump())
        await db.users.update_one(
            {"id": user_id}, {"$set": {"verification_status": "pending"}}
        )
        return ver

    @extra_router.get("/verifications/mine", response_model=Optional[Verification])
    async def my_verification(user_id: str = Depends(get_current_user_id)):
        doc = await db.verifications.find_one(
            {"user_id": user_id}, {"_id": 0}, sort=[("created_at", -1)]
        )
        return Verification(**doc) if doc else None


# ===========================
# ADMIN
# ===========================
def register_admin_routes(db):
    async def _admin(user_id: str) -> dict:
        user = await _get_user(db, user_id)
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Solo administradores")
        return user

    @extra_router.get("/admin/verifications", response_model=List[Verification])
    async def admin_list_verifications(
        status: Optional[str] = None,
        user_id: str = Depends(get_current_user_id),
    ):
        await _admin(user_id)
        query = {}
        if status:
            query["status"] = status
        docs = await db.verifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        return [Verification(**d) for d in docs]

    @extra_router.post("/admin/verifications/{ver_id}/review", response_model=Verification)
    async def admin_review(
        ver_id: str,
        payload: AdminReviewRequest,
        user_id: str = Depends(get_current_user_id),
    ):
        admin = await _admin(user_id)
        ver = await db.verifications.find_one({"id": ver_id}, {"_id": 0})
        if not ver:
            raise HTTPException(status_code=404, detail="Verificación no encontrada")
        new_status = "approved" if payload.decision == "approve" else "rejected"
        await db.verifications.update_one(
            {"id": ver_id},
            {"$set": {
                "status": new_status,
                "admin_notes": payload.admin_notes,
                "reviewed_by": admin["id"],
                "reviewed_at": now_iso(),
            }},
        )
        await db.users.update_one(
            {"id": ver["user_id"]},
            {"$set": {
                "verified": payload.decision == "approve",
                "verification_status": new_status,
            }},
        )
        updated = await db.verifications.find_one({"id": ver_id}, {"_id": 0})
        return Verification(**updated)

    @extra_router.get("/admin/me")
    async def admin_check(user_id: str = Depends(get_current_user_id)):
        user = await _get_user(db, user_id)
        return {"is_admin": _is_admin(user)}


# ===========================
# COLOMBIA PAYMENTS HELPERS
# ===========================
def co_provider_checkout(
    provider: str,
    reference: str,
    amount_cop: float,
    customer_email: str,
    description: str,
    success_url: str,
    cancel_url: str,
) -> dict:
    """Returns dict with session_id, checkout_url, currency, mocked."""
    if provider == "wompi":
        result = wompi().create_checkout(
            reference=reference,
            amount_cop=amount_cop,
            customer_email=customer_email,
            description=description,
            redirect_url=success_url.replace("{CHECKOUT_SESSION_ID}", reference),
        )
        result["currency"] = "COP"
        return result
    if provider == "mercadopago":
        result = mercadopago().create_preference(
            reference=reference,
            amount_cop=amount_cop,
            customer_email=customer_email,
            description=description,
            success_url=success_url.replace("{CHECKOUT_SESSION_ID}", reference),
            cancel_url=cancel_url,
        )
        result["currency"] = "COP"
        return result
    raise ValueError(f"Unknown provider: {provider}")


def register_all(app, db):
    register_chat_routes(db)
    register_verification_routes(db)
    register_admin_routes(db)
    app.include_router(extra_router)
