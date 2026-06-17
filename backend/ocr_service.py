"""OCR via Claude Sonnet 4.5 Vision."""
import os
import re
import base64
import logging
import requests
from typing import Optional, Tuple
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def _fetch_image_as_base64(url_or_data: str) -> Optional[str]:
    """Returns base64 string from an http(s) URL or a data: URI."""
    if not url_or_data:
        return None
    try:
        if url_or_data.startswith("data:"):
            # data:image/png;base64,XXXX
            return url_or_data.split(",", 1)[1] if "," in url_or_data else None
        if url_or_data.startswith(("http://", "https://")):
            r = requests.get(url_or_data, timeout=10)
            r.raise_for_status()
            return base64.b64encode(r.content).decode("utf-8")
    except Exception as e:
        logger.warning("Image fetch failed (%s): %s", url_or_data[:80], e)
    return None


async def ocr_verify_document(
    document_url: str,
    expected_name: str,
    expected_id: str,
    expected_institution: Optional[str] = None,
    document_type: str = "tarjeta_profesional",
) -> dict:
    """
    Uses Claude Vision to:
    - Extract text from the document image
    - Verify name/id/institution coherence vs self-reported data
    - Return recommendation: approve, review, reject

    Returns dict with: extracted_text, recommendation, confidence, notes
    """
    if not EMERGENT_LLM_KEY:
        return {
            "extracted_text": "",
            "recommendation": "review",
            "confidence": 0.0,
            "notes": "OCR no configurado (sin EMERGENT_LLM_KEY)",
            "matches": {"name": None, "id": None, "institution": None},
        }

    image_b64 = _fetch_image_as_base64(document_url)
    if not image_b64:
        return {
            "extracted_text": "",
            "recommendation": "review",
            "confidence": 0.0,
            "notes": "No se pudo descargar el documento",
            "matches": {"name": None, "id": None, "institution": None},
        }

    system_message = (
        "Eres un asistente OCR para validar documentos profesionales del agro en Colombia. "
        "Recibes una imagen de documento (tarjeta profesional, cédula profesional o diploma) "
        "y datos auto-reportados por el usuario. Tu tarea:\n"
        "1. Extraer el TEXTO LITERAL visible en el documento.\n"
        "2. Comparar con los datos auto-reportados.\n"
        "3. Decidir si los datos coinciden, son ilegibles o no coinciden.\n\n"
        "Responde EXACTAMENTE en este formato:\n"
        "EXTRACTED_TEXT: <todo el texto que veas>\n"
        "NAME_MATCH: <yes|no|unclear>\n"
        "ID_MATCH: <yes|no|unclear>\n"
        "INSTITUTION_MATCH: <yes|no|unclear|na>\n"
        "RECOMENDACION: <approve|review|reject>\n"
        "RAZON: <1-2 frases>"
    )

    reply = ""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr_{expected_id[:8]}",
            system_message=system_message,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        prompt = (
            f"Datos auto-reportados:\n"
            f"- Nombre: {expected_name}\n"
            f"- Número/matrícula: {expected_id}\n"
            f"- Institución: {expected_institution or '(no provista)'}\n"
            f"- Tipo de documento: {document_type}\n\n"
            f"Analiza la imagen adjunta del documento."
        )
        msg = UserMessage(
            text=prompt,
            file_contents=[ImageContent(image_base64=image_b64)],
        )
        reply = await chat.send_message(msg)
    except Exception as e:
        logger.exception("OCR Claude Vision failed: %s", e)
        return {
            "extracted_text": "",
            "recommendation": "review",
            "confidence": 0.0,
            "notes": f"OCR error: {str(e)[:120]}",
            "matches": {"name": None, "id": None, "institution": None},
        }

    parsed = _parse_response(reply)
    matches = parsed["matches"]
    yes_count = sum(1 for v in matches.values() if v == "yes")
    confidence = yes_count / max(1, sum(1 for v in matches.values() if v != "na"))
    return {
        "extracted_text": parsed["extracted_text"],
        "recommendation": parsed["recommendation"],
        "confidence": round(confidence, 2),
        "notes": parsed["razon"],
        "matches": matches,
        "raw": reply,
    }


def _parse_response(reply: str) -> dict:
    """Parse Claude's structured response."""
    out = {
        "extracted_text": "",
        "matches": {"name": "unclear", "id": "unclear", "institution": "unclear"},
        "recommendation": "review",
        "razon": "",
    }
    # EXTRACTED_TEXT can be multi-line; capture until next KEY:
    m = re.search(r"EXTRACTED_TEXT:\s*(.*?)(?=\n[A-Z_]+:|$)", reply, re.S)
    if m:
        out["extracted_text"] = m.group(1).strip()
    for key, target in [
        ("NAME_MATCH", "name"), ("ID_MATCH", "id"), ("INSTITUTION_MATCH", "institution"),
    ]:
        m = re.search(rf"{key}:\s*(yes|no|unclear|na)", reply, re.I)
        if m:
            out["matches"][target] = m.group(1).lower()
    m = re.search(r"RECOMENDACION:\s*(approve|review|reject)", reply, re.I)
    if m:
        out["recommendation"] = m.group(1).lower()
    m = re.search(r"RAZON:\s*(.*?)(?=\n[A-Z_]+:|$)", reply, re.S)
    if m:
        out["razon"] = m.group(1).strip()
    return out
