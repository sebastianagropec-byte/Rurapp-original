"""Rurapp - FastAPI backend.

Marketplace + servicios + membresías para conectar el campo y la ciudad.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

from models import (
    UserCreate, UserLogin, UserPublic, UserUpdate, TokenResponse,
    ProductCreate, ProductUpdate, Product,
    ServiceCreate, ServiceUpdate, Service,
    OrderCreateRequest, Order, OrderItem,
    BookingCreateRequest, Booking,
    ReviewCreate, Review,
    ArticleCreate, Article,
    AIChatRequest, AIChatResponse,
    MembershipCheckoutRequest, PaymentTransaction,
    now_iso, gen_id,
)
from auth import (
    hash_password, verify_password, create_token,
    get_current_user_id, get_current_user_optional,
)

# Stripe
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)

# LLM
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Email + COL payments + extra routes
from email_service import (
    send_order_confirmation, send_booking_confirmation, send_membership_receipt,
)
from payments_co import wompi, mercadopago
from push_service import push_to_user
from webhook_security import verify_wompi_signature, verify_mercadopago_signature
from routes_extra import register_all as register_extra_routes, co_provider_checkout


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# === Configuration ===
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Membership plans (server-side fixed pricing)
MEMBERSHIP_PLANS = {
    "basico": {"name": "Plan Básico", "price": 9.99, "duration_days": 30,
               "description": "Publica hasta 10 productos/servicios"},
    "pro": {"name": "Plan Pro", "price": 24.99, "duration_days": 30,
            "description": "Publicaciones ilimitadas + destacado en búsquedas"},
}


app = FastAPI(title="Rurapp API")
api_router = APIRouter(prefix="/api")


# =========================
# Helpers
# =========================
async def get_user_doc(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


async def require_role(user_id: str, allowed: List[str]) -> dict:
    user = await get_user_doc(user_id)
    if user["role"] not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Solo permitido para: {', '.join(allowed)}",
        )
    return user


def public_user(doc: dict) -> dict:
    """Filter user doc to public fields."""
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


# =========================
# Health
# =========================
@api_router.get("/")
async def root():
    return {"app": "Rurapp", "status": "ok"}


# =========================
# AUTH
# =========================
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(payload: UserCreate):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")

    user_doc = {
        "id": gen_id(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
        "location": payload.location,
        "bio": payload.bio,
        "lat": payload.lat,
        "lng": payload.lng,
        "avatar_url": None,
        "sustainable_practices": [],
        "specialty": None,
        "verified": False,
        "verification_status": "none",
        "membership_active": payload.role == "cliente",  # clients don't need membership
        "membership_expires_at": None,
        "rating_avg": 0.0,
        "rating_count": 0,
        "is_admin": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_doc["id"], user_doc["role"])
    return TokenResponse(access_token=token, user=UserPublic(**public_user(user_doc)))


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=UserPublic(**public_user(dict(user))))


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user_id: str = Depends(get_current_user_id)):
    doc = await get_user_doc(user_id)
    return UserPublic(**doc)


@api_router.put("/auth/me", response_model=UserPublic)
async def update_me(
    payload: UserUpdate,
    user_id: str = Depends(get_current_user_id),
):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    doc = await get_user_doc(user_id)
    return UserPublic(**doc)


# =========================
# USERS (public profiles)
# =========================
@api_router.get("/users/{user_id}", response_model=UserPublic)
async def get_user_public(user_id: str):
    doc = await get_user_doc(user_id)
    return UserPublic(**doc)


@api_router.get("/users", response_model=List[UserPublic])
async def list_users(role: Optional[str] = None, location: Optional[str] = None):
    query = {}
    if role:
        query["role"] = role
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    docs = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    return [UserPublic(**d) for d in docs]


# =========================
# PRODUCTS
# =========================
@api_router.post("/products", response_model=Product)
async def create_product(
    payload: ProductCreate,
    user_id: str = Depends(get_current_user_id),
):
    user = await require_role(user_id, ["productor"])
    if not user.get("membership_active"):
        raise HTTPException(
            status_code=402,
            detail="Necesitas una membresía activa para publicar productos",
        )
    product = Product(
        producer_id=user_id,
        producer_name=user["full_name"],
        producer_location=user.get("location"),
        **payload.model_dump(),
    )
    await db.products.insert_one(product.model_dump())
    return product


@api_router.get("/products", response_model=List[Product])
async def list_products(
    category: Optional[str] = None,
    location: Optional[str] = None,
    producer_id: Optional[str] = None,
    search: Optional[str] = None,
):
    query = {"active": True}
    if category:
        query["category"] = category
    if location:
        query["producer_location"] = {"$regex": location, "$options": "i"}
    if producer_id:
        query["producer_id"] = producer_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Product(**d) for d in docs]


@api_router.get("/products/mine", response_model=List[Product])
async def my_products(user_id: str = Depends(get_current_user_id)):
    docs = await db.products.find(
        {"producer_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return [Product(**d) for d in docs]


@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return Product(**doc)


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    user_id: str = Depends(get_current_user_id),
):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if doc["producer_id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.products.update_one({"id": product_id}, {"$set": update})
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    return Product(**doc)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if doc["producer_id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# =========================
# SERVICES
# =========================
@api_router.post("/services", response_model=Service)
async def create_service(
    payload: ServiceCreate,
    user_id: str = Depends(get_current_user_id),
):
    user = await require_role(user_id, ["veterinario"])
    if not user.get("membership_active"):
        raise HTTPException(
            status_code=402,
            detail="Necesitas una membresía activa para publicar servicios",
        )
    service = Service(
        expert_id=user_id,
        expert_name=user["full_name"],
        expert_specialty=user.get("specialty"),
        expert_location=user.get("location"),
        **payload.model_dump(),
    )
    await db.services.insert_one(service.model_dump())
    return service


@api_router.get("/services", response_model=List[Service])
async def list_services(
    category: Optional[str] = None,
    location: Optional[str] = None,
    expert_id: Optional[str] = None,
    search: Optional[str] = None,
):
    query = {"active": True}
    if category:
        query["category"] = category
    if location:
        query["expert_location"] = {"$regex": location, "$options": "i"}
    if expert_id:
        query["expert_id"] = expert_id
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.services.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Service(**d) for d in docs]


@api_router.get("/services/mine", response_model=List[Service])
async def my_services(user_id: str = Depends(get_current_user_id)):
    docs = await db.services.find(
        {"expert_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return [Service(**d) for d in docs]


@api_router.get("/services/{service_id}", response_model=Service)
async def get_service(service_id: str):
    doc = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return Service(**doc)


@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(
    service_id: str,
    payload: ServiceUpdate,
    user_id: str = Depends(get_current_user_id),
):
    doc = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    if doc["expert_id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.services.update_one({"id": service_id}, {"$set": update})
    doc = await db.services.find_one({"id": service_id}, {"_id": 0})
    return Service(**doc)


@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    if doc["expert_id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    await db.services.delete_one({"id": service_id})
    return {"ok": True}


# =========================
# ORDERS (with payment)
# =========================
def _build_stripe(request: Request) -> StripeCheckout:
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


@api_router.post("/orders", response_model=dict)
async def create_order(
    payload: OrderCreateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    user = await get_user_doc(user_id)
    items_out: List[OrderItem] = []
    total = 0.0
    for item in payload.items:
        prod = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        if not prod or not prod.get("active"):
            raise HTTPException(status_code=400, detail="Producto inválido")
        if prod["stock"] < item.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para {prod['name']}")
        subtotal = round(prod["price"] * item.quantity, 2)
        total += subtotal
        items_out.append(OrderItem(
            product_id=prod["id"],
            product_name=prod["name"],
            producer_id=prod["producer_id"],
            quantity=item.quantity,
            unit_price=prod["price"],
            subtotal=subtotal,
        ))
    total = round(total, 2)

    order = Order(
        customer_id=user_id,
        customer_name=user["full_name"],
        items=items_out,
        total=total,
        delivery_address=payload.delivery_address,
        notes=payload.notes,
    )
    await db.orders.insert_one(order.model_dump())

    provider = payload.payment_provider or "stripe"
    success_url = f"{payload.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&order_id={order.id}"
    cancel_url = f"{payload.origin_url}/cart"

    if provider == "cod":
        # Pago contraentrega: confirm immediately, no gateway involved
        await db.orders.update_one(
            {"id": order.id}, {"$set": {"status": "preparing", "payment_method": "cod"}}
        )
        # Decrement stock right away (customer committed to receive)
        for item in items_out:
            await db.products.update_one(
                {"id": item.product_id}, {"$inc": {"stock": -item.quantity}},
            )
        # Send confirmation email + push to participants
        try:
            await send_order_confirmation(
                to_email=user["email"], customer_name=user["full_name"],
                order_id=order.id, total=total, items_count=len(items_out),
            )
        except Exception as e:
            logging.warning("cod order email error: %s", e)
        try:
            producer_ids = list({it.producer_id for it in items_out})
            for pid in producer_ids:
                await push_to_user(db, pid, "🧺 Nuevo pedido (contraentrega)",
                                   f"Pedido de {user['full_name']} · pago al recibir", "/pedidos-recibidos")
            await push_to_user(db, user_id, "✅ Pedido registrado",
                               f"Pagas al recibir: ${total:,.0f}", "/mis-pedidos")
        except Exception as e:
            logging.warning("cod order push error: %s", e)
        return {
            "order_id": order.id,
            "checkout_url": f"{payload.origin_url}/payment/success?cod=1&order_id={order.id}",
            "session_id": f"cod_{order.id}",
            "provider": "cod",
        }

    if provider == "stripe":
        stripe = _build_stripe(request)
        session = await stripe.create_checkout_session(CheckoutSessionRequest(
            amount=float(total), currency="usd",
            success_url=success_url, cancel_url=cancel_url,
            metadata={"type": "order", "order_id": order.id, "user_id": user_id},
        ))
        session_id, checkout_url, currency = session.session_id, session.url, "usd"
        amount_charged = float(total)
    else:
        # Wompi / MercadoPago use COP
        co = co_provider_checkout(
            provider=provider,
            reference=order.id,
            amount_cop=float(total),
            customer_email=user["email"],
            description=f"Pedido Rurapp #{order.id[:8]}",
            success_url=success_url,
            cancel_url=cancel_url,
        )
        session_id = co["session_id"]
        checkout_url = co["checkout_url"]
        currency = "cop"
        amount_charged = float(total)

    tx = PaymentTransaction(
        session_id=session_id,
        user_id=user_id, user_email=user["email"],
        type="order", reference_id=order.id,
        amount=amount_charged, currency=currency,
        provider=provider, status="initiated", payment_status="unpaid",
        metadata={"order_id": order.id, "mocked": str(co.get("mocked", False)) if provider != "stripe" else "false"},
    )
    await db.payment_transactions.insert_one(tx.model_dump())
    await db.orders.update_one(
        {"id": order.id}, {"$set": {"payment_session_id": session_id}}
    )
    return {"order_id": order.id, "checkout_url": checkout_url, "session_id": session_id, "provider": provider}


@api_router.get("/orders/mine", response_model=List[Order])
async def my_orders(user_id: str = Depends(get_current_user_id)):
    docs = await db.orders.find(
        {"customer_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return [Order(**d) for d in docs]


@api_router.get("/orders/received", response_model=List[Order])
async def received_orders(user_id: str = Depends(get_current_user_id)):
    """Orders containing products from this producer."""
    docs = await db.orders.find(
        {"items.producer_id": user_id, "status": {"$ne": "pending_payment"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return [Order(**d) for d in docs]


# =========================
# BOOKINGS (with payment)
# =========================
@api_router.post("/bookings", response_model=dict)
async def create_booking(
    payload: BookingCreateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    user = await get_user_doc(user_id)
    service = await db.services.find_one({"id": payload.service_id}, {"_id": 0})
    if not service or not service.get("active"):
        raise HTTPException(status_code=400, detail="Servicio inválido")

    booking = Booking(
        customer_id=user_id,
        customer_name=user["full_name"],
        expert_id=service["expert_id"],
        expert_name=service["expert_name"],
        service_id=service["id"],
        service_title=service["title"],
        price=service["price"],
        scheduled_at=payload.scheduled_at,
        notes=payload.notes,
    )
    await db.bookings.insert_one(booking.model_dump())

    provider = payload.payment_provider or "stripe"
    success_url = f"{payload.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking.id}"
    cancel_url = f"{payload.origin_url}/servicio/{service['id']}"

    if provider == "cod":
        # Pago contraentrega: confirm booking immediately
        await db.bookings.update_one(
            {"id": booking.id}, {"$set": {"status": "confirmed", "payment_method": "cod"}}
        )
        try:
            await send_booking_confirmation(
                to_email=user["email"], customer_name=user["full_name"],
                booking_id=booking.id, service_title=booking.service_title,
                expert_name=booking.expert_name, scheduled_at=booking.scheduled_at,
            )
        except Exception as e:
            logging.warning("cod booking email error: %s", e)
        try:
            await push_to_user(db, booking.expert_id, "📅 Nueva cita (pago al servicio)",
                               f"{user['full_name']} agendó: {booking.service_title}", "/citas-recibidas")
            await push_to_user(db, user_id, "✅ Cita confirmada",
                               f"{booking.service_title} con {booking.expert_name}", "/mis-citas")
        except Exception as e:
            logging.warning("cod booking push error: %s", e)
        return {
            "booking_id": booking.id,
            "checkout_url": f"{payload.origin_url}/payment/success?cod=1&booking_id={booking.id}",
            "session_id": f"cod_{booking.id}",
            "provider": "cod",
        }

    if provider == "stripe":
        stripe = _build_stripe(request)
        session = await stripe.create_checkout_session(CheckoutSessionRequest(
            amount=float(service["price"]), currency="usd",
            success_url=success_url, cancel_url=cancel_url,
            metadata={"type": "booking", "booking_id": booking.id, "user_id": user_id},
        ))
        session_id, checkout_url, currency = session.session_id, session.url, "usd"
    else:
        co = co_provider_checkout(
            provider=provider, reference=booking.id,
            amount_cop=float(service["price"]), customer_email=user["email"],
            description=f"{service['title']} - Rurapp",
            success_url=success_url, cancel_url=cancel_url,
        )
        session_id, checkout_url, currency = co["session_id"], co["checkout_url"], "cop"

    tx = PaymentTransaction(
        session_id=session_id,
        user_id=user_id, user_email=user["email"],
        type="booking", reference_id=booking.id,
        amount=float(service["price"]), currency=currency,
        provider=provider, status="initiated", payment_status="unpaid",
        metadata={"booking_id": booking.id},
    )
    await db.payment_transactions.insert_one(tx.model_dump())
    await db.bookings.update_one(
        {"id": booking.id}, {"$set": {"payment_session_id": session_id}}
    )
    return {"booking_id": booking.id, "checkout_url": checkout_url, "session_id": session_id, "provider": provider}


@api_router.get("/bookings/mine", response_model=List[Booking])
async def my_bookings(user_id: str = Depends(get_current_user_id)):
    docs = await db.bookings.find(
        {"customer_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return [Booking(**d) for d in docs]


@api_router.get("/bookings/received", response_model=List[Booking])
async def received_bookings(user_id: str = Depends(get_current_user_id)):
    docs = await db.bookings.find(
        {"expert_id": user_id, "status": {"$ne": "pending_payment"}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return [Booking(**d) for d in docs]


# =========================
# MEMBERSHIPS (Rurapp -> Producer/Vet)
# =========================
@api_router.get("/memberships/plans")
async def list_plans():
    return [{"id": k, **v} for k, v in MEMBERSHIP_PLANS.items()]


@api_router.post("/memberships/checkout")
async def membership_checkout(
    payload: MembershipCheckoutRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    user = await require_role(user_id, ["productor", "veterinario"])
    if payload.plan_id not in MEMBERSHIP_PLANS:
        raise HTTPException(status_code=400, detail="Plan inválido")
    plan = MEMBERSHIP_PLANS[payload.plan_id]
    provider = payload.payment_provider or "stripe"

    success_url = f"{payload.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&membership=1"
    cancel_url = f"{payload.origin_url}/membresia"

    if provider == "stripe":
        stripe = _build_stripe(request)
        session = await stripe.create_checkout_session(CheckoutSessionRequest(
            amount=float(plan["price"]), currency="usd",
            success_url=success_url, cancel_url=cancel_url,
            metadata={"type": "membership", "plan_id": payload.plan_id, "user_id": user_id},
        ))
        session_id, checkout_url, currency, amount = session.session_id, session.url, "usd", float(plan["price"])
    else:
        # Convert USD to COP for Wompi/MP using a rough rate (real apps fetch live FX)
        amount_cop = float(plan["price"]) * 4000  # ~4000 COP/USD
        ref = f"mem_{user_id[:8]}_{payload.plan_id}_{gen_id()[:8]}"
        co = co_provider_checkout(
            provider=provider, reference=ref,
            amount_cop=amount_cop, customer_email=user["email"],
            description=f"Membresía Rurapp · {plan['name']}",
            success_url=success_url, cancel_url=cancel_url,
        )
        session_id, checkout_url, currency, amount = co["session_id"], co["checkout_url"], "cop", amount_cop

    tx = PaymentTransaction(
        session_id=session_id,
        user_id=user_id, user_email=user["email"],
        type="membership", reference_id=payload.plan_id,
        amount=amount, currency=currency,
        provider=provider, status="initiated", payment_status="unpaid",
        metadata={"plan_id": payload.plan_id, "duration_days": plan["duration_days"]},
    )
    await db.payment_transactions.insert_one(tx.model_dump())
    return {"checkout_url": checkout_url, "session_id": session_id, "provider": provider}


# =========================
# PAYMENT STATUS
# =========================
@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")

    # If already settled, return
    if tx["payment_status"] == "paid" and tx["status"] == "complete":
        return {
            "status": tx["status"], "payment_status": tx["payment_status"],
            "type": tx["type"], "reference_id": tx["reference_id"],
        }

    provider = tx.get("provider", "stripe")

    try:
        if provider == "stripe":
            stripe = _build_stripe(request)
            status = await stripe.get_checkout_status(session_id)
            new_status = status.status
            new_payment_status = status.payment_status
        elif provider == "wompi":
            r = wompi().get_status(tx["reference_id"] or session_id)
            wstatus = (r.get("status") or "").upper()
            new_status = "complete" if wstatus == "APPROVED" else ("expired" if wstatus in ("DECLINED", "VOIDED") else "open")
            new_payment_status = "paid" if wstatus == "APPROVED" else "unpaid"
        elif provider == "mercadopago":
            r = mercadopago().get_status(session_id)
            mstatus = (r.get("status") or "").lower()
            new_status = "complete" if mstatus == "approved" else "open"
            new_payment_status = "paid" if mstatus == "approved" else "unpaid"
        else:
            new_status, new_payment_status = tx["status"], tx["payment_status"]

        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": new_status, "payment_status": new_payment_status,
                "updated_at": now_iso(),
            }},
        )

        if new_payment_status == "paid" and tx["payment_status"] != "paid":
            await _process_paid_transaction(tx)

        return {
            "status": new_status, "payment_status": new_payment_status,
            "type": tx["type"], "reference_id": tx["reference_id"],
        }
    except Exception as e:
        logging.warning("Status fetch failed for %s (%s): %s", session_id, provider, e)
        latest = await db.payment_transactions.find_one(
            {"session_id": session_id}, {"_id": 0}
        )
        return {
            "status": latest["status"], "payment_status": latest["payment_status"],
            "type": latest["type"], "reference_id": latest["reference_id"],
        }


async def _process_paid_transaction(tx: dict):
    """Idempotent business logic upon successful payment + email notifications."""
    if tx["type"] == "order":
        order = await db.orders.find_one({"id": tx["reference_id"]}, {"_id": 0})
        if order and order["status"] == "pending_payment":
            await db.orders.update_one(
                {"id": tx["reference_id"]}, {"$set": {"status": "paid"}}
            )
            for item in order["items"]:
                await db.products.update_one(
                    {"id": item["product_id"]},
                    {"$inc": {"stock": -item["quantity"]}},
                )
            try:
                await send_order_confirmation(
                    to_email=tx.get("user_email") or "",
                    customer_name=order["customer_name"],
                    order_id=order["id"], total=order["total"],
                    items_count=len(order["items"]),
                )
            except Exception as e:
                logging.warning("order email error: %s", e)
            # Push to producers receiving the order
            try:
                producer_ids = list({it["producer_id"] for it in order["items"]})
                for pid in producer_ids:
                    await push_to_user(db, pid, "🧺 Nuevo pedido", f"Recibiste un pedido de {order['customer_name']}", "/pedidos-recibidos")
                # And to customer
                await push_to_user(db, order["customer_id"], "✅ Pedido confirmado", f"Tu pedido por ${order['total']:,.0f} fue confirmado", "/mis-pedidos")
            except Exception as e:
                logging.warning("order push error: %s", e)

    elif tx["type"] == "booking":
        booking = await db.bookings.find_one({"id": tx["reference_id"]}, {"_id": 0})
        if booking and booking["status"] == "pending_payment":
            await db.bookings.update_one(
                {"id": tx["reference_id"]}, {"$set": {"status": "confirmed"}}
            )
            try:
                await send_booking_confirmation(
                    to_email=tx.get("user_email") or "",
                    customer_name=booking["customer_name"],
                    booking_id=booking["id"], service_title=booking["service_title"],
                    expert_name=booking["expert_name"], scheduled_at=booking["scheduled_at"],
                )
            except Exception as e:
                logging.warning("booking email error: %s", e)
            try:
                await push_to_user(db, booking["expert_id"], "📅 Nueva cita", f"{booking['customer_name']} agendó: {booking['service_title']}", "/citas-recibidas")
                await push_to_user(db, booking["customer_id"], "✅ Cita confirmada", f"{booking['service_title']} con {booking['expert_name']}", "/mis-citas")
            except Exception as e:
                logging.warning("booking push error: %s", e)

    elif tx["type"] == "membership":
        plan = MEMBERSHIP_PLANS.get(tx["reference_id"])
        if plan and tx.get("user_id"):
            from datetime import timedelta
            expires = (datetime.now(timezone.utc)
                       + timedelta(days=plan["duration_days"])).isoformat()
            await db.users.update_one(
                {"id": tx["user_id"]},
                {"$set": {
                    "membership_active": True,
                    "membership_expires_at": expires,
                }},
            )
            try:
                await send_membership_receipt(
                    to_email=tx.get("user_email") or "",
                    name="Usuario", plan_name=plan["name"],
                    amount=tx["amount"], expires_at=expires[:10],
                )
            except Exception as e:
                logging.warning("membership email error: %s", e)


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    stripe = _build_stripe(request)
    try:
        event = await stripe.handle_webhook(body, request.headers.get("Stripe-Signature"))
        if event.payment_status == "paid":
            tx = await db.payment_transactions.find_one(
                {"session_id": event.session_id}, {"_id": 0}
            )
            if tx and tx["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {
                        "status": "complete",
                        "payment_status": "paid",
                        "updated_at": now_iso(),
                    }},
                )
                await _process_paid_transaction(tx)
    except Exception as e:
        logging.exception("Webhook error: %s", e)
    return {"received": True}


# =========================
# REVIEWS
# =========================
@api_router.post("/reviews", response_model=Review)
async def create_review(
    payload: ReviewCreate,
    user_id: str = Depends(get_current_user_id),
):
    user = await get_user_doc(user_id)
    review = Review(
        author_id=user_id,
        author_name=user["full_name"],
        **payload.model_dump(),
    )
    await db.reviews.insert_one(review.model_dump())

    # Update aggregate rating on target
    coll_map = {"product": "products", "service": "services", "user": "users"}
    coll = coll_map.get(payload.target_type)
    if coll:
        all_reviews = await db.reviews.find(
            {"target_type": payload.target_type, "target_id": payload.target_id},
            {"_id": 0},
        ).to_list(2000)
        if all_reviews:
            avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
            await db[coll].update_one(
                {"id": payload.target_id},
                {"$set": {"rating_avg": round(avg, 2), "rating_count": len(all_reviews)}},
            )
    return review


@api_router.get("/reviews", response_model=List[Review])
async def list_reviews(target_type: str, target_id: str):
    docs = await db.reviews.find(
        {"target_type": target_type, "target_id": target_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return [Review(**d) for d in docs]


# =========================
# ARTICLES (Educational)
# =========================
@api_router.post("/articles", response_model=Article)
async def create_article(
    payload: ArticleCreate,
    user_id: str = Depends(get_current_user_id),
):
    user = await require_role(user_id, ["veterinario", "productor"])
    article = Article(
        author_id=user_id,
        author_name=user["full_name"],
        author_role=user["role"],
        **payload.model_dump(),
    )
    await db.articles.insert_one(article.model_dump())
    return article


@api_router.get("/articles", response_model=List[Article])
async def list_articles(category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    docs = await db.articles.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Article(**d) for d in docs]


@api_router.get("/articles/{article_id}", response_model=Article)
async def get_article(article_id: str):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return Article(**doc)


@api_router.post("/articles/{article_id}/like")
async def like_article(article_id: str, user_id: str = Depends(get_current_user_id)):
    await db.articles.update_one({"id": article_id}, {"$inc": {"likes": 1}})
    return {"ok": True}


# =========================
# AI ASSISTANT (Claude)
# =========================
@api_router.post("/ai/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    session_id = payload.session_id or gen_id()
    system_message = (
        "Eres 'Rura', un asistente experto en agro y veterinaria para "
        "campesinos colombianos en la plataforma Rurapp. Hablas en español de forma cercana, "
        "humana y simple. Das consejos prácticos sobre salud animal, cultivos, sostenibilidad, "
        "comercialización justa y prácticas del campo. Cuando no sepas algo, lo reconoces "
        "y sugieres consultar un veterinario o experto verificado en la plataforma. "
        "Mantén respuestas breves (máx 4-5 frases) y usa lenguaje accesible."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    reply = ""
    try:
        reply = await chat.send_message(UserMessage(text=payload.message))
    except Exception as e:
        logging.exception("AI chat error")
        msg = str(e)
        if "Budget" in msg or "budget" in msg:
            raise HTTPException(
                status_code=503,
                detail="El asistente Rura está temporalmente fuera de servicio (límite alcanzado). Intenta más tarde.",
            )
        raise HTTPException(status_code=500, detail=f"Error en asistente IA: {msg[:200]}")

    # Persist conversation
    await db.ai_messages.insert_one({
        "id": gen_id(),
        "session_id": session_id,
        "user_id": user_id,
        "role": "user",
        "content": payload.message,
        "created_at": now_iso(),
    })
    await db.ai_messages.insert_one({
        "id": gen_id(),
        "session_id": session_id,
        "user_id": user_id,
        "role": "assistant",
        "content": reply,
        "created_at": now_iso(),
    })

    return AIChatResponse(session_id=session_id, reply=reply)


@api_router.get("/ai/history/{session_id}")
async def ai_history(session_id: str, user_id: str = Depends(get_current_user_id)):
    docs = await db.ai_messages.find(
        {"session_id": session_id, "user_id": user_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return docs


# =========================
# Mount + middleware
# =========================
app.include_router(api_router)

# Register extra routes (chat, verification, admin)
register_extra_routes(app, db)

# Webhooks for COL providers
@app.post("/api/webhook/wompi")
async def wompi_webhook(request: Request):
    body = await request.body()
    sig_header = request.headers.get("X-Event-Checksum")
    valid, reason = verify_wompi_signature(body, sig_header)
    if not valid:
        logging.warning("Wompi webhook rejected: %s", reason)
        raise HTTPException(status_code=401, detail=f"Invalid signature: {reason}")
    try:
        import json as _json
        body_json = _json.loads(body.decode("utf-8")) if body else {}
        data = body_json.get("data", {}).get("transaction", {})
        ref = data.get("reference")
        wstatus = (data.get("status") or "").upper()
        if ref and wstatus == "APPROVED":
            tx = await db.payment_transactions.find_one(
                {"$or": [{"session_id": ref}, {"reference_id": ref}]}, {"_id": 0}
            )
            if tx and tx["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"id": tx["id"]},
                    {"$set": {"status": "complete", "payment_status": "paid", "updated_at": now_iso()}},
                )
                await _process_paid_transaction(tx)
    except Exception as e:
        logging.warning("Wompi webhook error: %s", e)
    return {"received": True, "verified": valid}


@app.post("/api/webhook/mercadopago")
async def mp_webhook(request: Request):
    body = await request.body()
    sig_header = request.headers.get("x-signature")
    req_id = request.headers.get("x-request-id")
    body_json = {}
    try:
        import json as _json
        body_json = _json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        pass
    data_id = (body_json.get("data") or {}).get("id") or body_json.get("resource") or request.query_params.get("id")
    valid, reason = verify_mercadopago_signature(req_id, str(data_id) if data_id else None, sig_header)
    if not valid:
        logging.warning("MP webhook rejected: %s", reason)
        raise HTTPException(status_code=401, detail=f"Invalid signature: {reason}")
    try:
        if data_id:
            tx = await db.payment_transactions.find_one(
                {"session_id": str(data_id)}, {"_id": 0}
            )
            if tx and tx["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"id": tx["id"]},
                    {"$set": {"status": "complete", "payment_status": "paid", "updated_at": now_iso()}},
                )
                await _process_paid_transaction(tx)
    except Exception as e:
        logging.warning("MP webhook error: %s", e)
    return {"received": True, "verified": valid}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

