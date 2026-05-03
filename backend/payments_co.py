"""Wompi (Colombia) and MercadoPago integrations with MOCKED fallbacks."""
import os
import hmac
import hashlib
import logging
import uuid
import requests
from typing import Optional

logger = logging.getLogger(__name__)


# ===========================
# Wompi (Colombia)
# ===========================
class WompiService:
    def __init__(self):
        self.public_key = os.environ.get("WOMPI_PUBLIC_KEY", "").strip()
        self.integrity_secret = os.environ.get("WOMPI_INTEGRITY_SECRET", "").strip()
        self.private_key = os.environ.get("WOMPI_PRIVATE_KEY", "").strip()
        self.environment = os.environ.get("WOMPI_ENVIRONMENT", "test")
        self.enabled = bool(self.public_key and self.integrity_secret)
        self.base_url = (
            "https://sandbox.wompi.co/v1" if self.environment == "test"
            else "https://production.wompi.co/v1"
        )
        if not self.enabled:
            logger.warning("[MOCKED WOMPI] Keys not set; Wompi flow will be simulated.")

    def _sign(self, reference: str, amount_cents: int, currency: str) -> str:
        msg = f"{reference}{amount_cents}{currency}{self.integrity_secret}"
        return hashlib.sha256(msg.encode()).hexdigest()

    def create_checkout(
        self,
        reference: str,
        amount_cop: float,
        customer_email: str,
        description: str,
        redirect_url: str,
    ) -> dict:
        amount_cents = int(round(amount_cop * 100))
        if not self.enabled:
            # MOCKED checkout: returns a fake URL that immediately redirects to success
            mock_id = f"mock_wompi_{uuid.uuid4().hex[:16]}"
            mock_url = f"{redirect_url}?session_id={mock_id}&mocked=wompi"
            logger.info("[MOCKED WOMPI] %s amount=%s ref=%s", mock_id, amount_cop, reference)
            return {
                "session_id": mock_id,
                "checkout_url": mock_url,
                "reference": reference,
                "amount_cents": amount_cents,
                "currency": "COP",
                "mocked": True,
            }
        # Real: use Wompi Checkout Web (URL-redirect flow)
        signature = self._sign(reference, amount_cents, "COP")
        params = {
            "public-key": self.public_key,
            "currency": "COP",
            "amount-in-cents": amount_cents,
            "reference": reference,
            "signature:integrity": signature,
            "redirect-url": redirect_url,
            "customer-data:email": customer_email,
        }
        from urllib.parse import urlencode
        url = f"https://checkout.wompi.co/p/?{urlencode(params)}"
        return {
            "session_id": reference,
            "checkout_url": url,
            "reference": reference,
            "amount_cents": amount_cents,
            "currency": "COP",
            "mocked": False,
        }

    def get_status(self, reference: str) -> dict:
        if not self.enabled:
            return {"status": "APPROVED", "reference": reference, "mocked": True}
        try:
            headers = {"Authorization": f"Bearer {self.private_key}"} if self.private_key else {}
            r = requests.get(
                f"{self.base_url}/transactions",
                params={"reference": reference},
                headers=headers, timeout=10,
            )
            data = r.json().get("data", [])
            if not data:
                return {"status": "PENDING", "reference": reference}
            tx = data[0]
            return {"status": tx.get("status"), "reference": reference, "transaction_id": tx.get("id")}
        except Exception as e:
            logger.warning("Wompi status fetch failed: %s", e)
            return {"status": "PENDING", "reference": reference, "error": str(e)}


# ===========================
# MercadoPago
# ===========================
class MercadoPagoService:
    def __init__(self):
        self.access_token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "").strip()
        self.public_key = os.environ.get("MERCADOPAGO_PUBLIC_KEY", "").strip()
        self.enabled = bool(self.access_token)
        if not self.enabled:
            logger.warning("[MOCKED MERCADOPAGO] Token not set; flow simulated.")

    def create_preference(
        self,
        reference: str,
        amount_cop: float,
        customer_email: str,
        description: str,
        success_url: str,
        cancel_url: str,
    ) -> dict:
        if not self.enabled:
            mock_id = f"mock_mp_{uuid.uuid4().hex[:16]}"
            mock_url = f"{success_url.split('?')[0]}?session_id={mock_id}&mocked=mercadopago"
            logger.info("[MOCKED MP] %s amount=%s ref=%s", mock_id, amount_cop, reference)
            return {
                "session_id": mock_id,
                "preference_id": mock_id,
                "checkout_url": mock_url,
                "mocked": True,
            }
        try:
            payload = {
                "items": [{
                    "title": description[:60],
                    "quantity": 1,
                    "unit_price": round(amount_cop, 2),
                    "currency_id": "COP",
                }],
                "payer": {"email": customer_email},
                "back_urls": {
                    "success": success_url,
                    "failure": cancel_url,
                    "pending": cancel_url,
                },
                "auto_return": "approved",
                "external_reference": reference,
            }
            r = requests.post(
                "https://api.mercadopago.com/checkout/preferences",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                    "X-Idempotency-Key": str(uuid.uuid4()),
                },
                json=payload, timeout=15,
            )
            r.raise_for_status()
            d = r.json()
            return {
                "session_id": d.get("id"),
                "preference_id": d.get("id"),
                "checkout_url": d.get("init_point") or d.get("sandbox_init_point"),
                "mocked": False,
            }
        except Exception as e:
            logger.exception("MP preference error: %s", e)
            raise

    def get_status(self, preference_id: str) -> dict:
        if not self.enabled:
            return {"status": "approved", "preference_id": preference_id, "mocked": True}
        try:
            r = requests.get(
                f"https://api.mercadopago.com/checkout/preferences/{preference_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                timeout=10,
            )
            data = r.json()
            return {"status": "approved" if data else "pending", "preference_id": preference_id}
        except Exception as e:
            logger.warning("MP status fetch failed: %s", e)
            return {"status": "pending", "preference_id": preference_id, "error": str(e)}


_wompi: Optional[WompiService] = None
_mp: Optional[MercadoPagoService] = None


def wompi() -> WompiService:
    global _wompi
    if _wompi is None:
        _wompi = WompiService()
    return _wompi


def mercadopago() -> MercadoPagoService:
    global _mp
    if _mp is None:
        _mp = MercadoPagoService()
    return _mp
