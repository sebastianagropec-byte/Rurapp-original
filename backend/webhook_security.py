"""Webhook signature verification for Wompi and MercadoPago."""
import os
import hmac
import hashlib
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def verify_wompi_signature(
    body: bytes,
    signature_header: Optional[str],
    events_secret: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Wompi sends 'X-Event-Checksum' header containing SHA-256 of:
        properties_concatenated + timestamp + events_secret

    However Wompi events also include a `signature` object with `properties` (list)
    and `checksum` (string). The body itself includes:
        {"event": "...", "data": {...}, "timestamp": <ts>, "signature": {"properties": [...], "checksum": "<sha256>"}}
    The checksum should be computed by concatenating the values of the listed properties + the timestamp + secret.

    For simplicity, this helper validates the body's `signature.checksum`.
    """
    secret = events_secret or os.environ.get("WOMPI_EVENTS_SECRET", "").strip()
    if not secret:
        # MOCKED mode: accept all
        return True, "mocked (no WOMPI_EVENTS_SECRET)"
    try:
        import json
        payload = json.loads(body.decode("utf-8"))
        sig = payload.get("signature", {})
        props = sig.get("properties", [])
        checksum = sig.get("checksum", "")
        timestamp = payload.get("timestamp", "")
        # Build concat string from properties (e.g., "transaction.id", "transaction.status")
        parts = []
        for p in props:
            keys = p.split(".")
            value = payload.get("data", {})
            for k in keys:
                if isinstance(value, dict):
                    value = value.get(k)
                else:
                    value = None
                    break
            parts.append(str(value) if value is not None else "")
        concat = "".join(parts) + str(timestamp) + secret
        expected = hashlib.sha256(concat.encode()).hexdigest()
        if hmac.compare_digest(expected, checksum or ""):
            return True, "valid"
        return False, "checksum mismatch"
    except Exception as e:
        logger.warning("Wompi signature verify error: %s", e)
        return False, f"error: {e}"


def verify_mercadopago_signature(
    request_id: Optional[str],
    data_id: Optional[str],
    signature_header: Optional[str],
    secret: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    MercadoPago sends 'x-signature' header like:
        ts=1742540700,v1=<hmac_sha256_hex>
    The signed payload is:
        id:<data_id>;request-id:<x-request-id>;ts:<ts>;
    Hashed with HMAC-SHA256 using the webhook secret (defined in MP webhook config).
    """
    secret = secret or os.environ.get("MERCADOPAGO_WEBHOOK_SECRET", "").strip()
    if not secret:
        return True, "mocked (no MERCADOPAGO_WEBHOOK_SECRET)"
    if not signature_header or not data_id:
        return False, "missing signature header or data id"
    try:
        parts = dict(p.split("=", 1) for p in signature_header.split(",") if "=" in p)
        ts = parts.get("ts")
        v1 = parts.get("v1")
        if not ts or not v1:
            return False, "malformed signature header"
        manifest = f"id:{data_id};request-id:{request_id or ''};ts:{ts};"
        expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, v1):
            return True, "valid"
        return False, "hmac mismatch"
    except Exception as e:
        logger.warning("MP signature verify error: %s", e)
        return False, f"error: {e}"
