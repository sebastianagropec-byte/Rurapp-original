"""Push notifications via Firebase Cloud Messaging (MOCKED when no credentials).

To enable real FCM:
1. Set FIREBASE_SERVICE_ACCOUNT_JSON env var with the service-account JSON content
2. Set FIREBASE_VAPID_PUBLIC_KEY for web push (frontend uses this)
3. Optionally pip install firebase-admin (only loaded when key is present)
"""
import os
import json
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self):
        self.account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        self.vapid_public_key = os.environ.get("FIREBASE_VAPID_PUBLIC_KEY", "").strip()
        self.enabled = bool(self.account_json)
        self._app = None
        if not self.enabled:
            logger.warning("[MOCKED PUSH] FIREBASE_SERVICE_ACCOUNT_JSON not set; push notifications will be logged only.")

    def _ensure_app(self):
        if not self.enabled or self._app is not None:
            return
        try:
            import firebase_admin
            from firebase_admin import credentials
            cred_dict = json.loads(self.account_json)
            cred = credentials.Certificate(cred_dict)
            self._app = firebase_admin.initialize_app(cred)
        except Exception as e:
            logger.exception("Failed to init Firebase Admin: %s", e)
            self.enabled = False

    async def send_to_tokens(
        self,
        tokens: List[str],
        title: str,
        body: str,
        link: Optional[str] = None,
        data: Optional[Dict[str, str]] = None,
    ) -> dict:
        if not tokens:
            return {"status": "skipped", "reason": "no tokens"}
        if not self.enabled:
            logger.info("[MOCKED PUSH] tokens=%d title=%r body=%r link=%s",
                       len(tokens), title, body[:80], link)
            return {"status": "mocked", "count": len(tokens)}
        self._ensure_app()
        try:
            from firebase_admin import messaging
            data_payload = data or {}
            if link:
                data_payload["link"] = link
            messages = [messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data=data_payload,
                token=t,
            ) for t in tokens]
            resp = messaging.send_all(messages)
            return {"status": "sent", "success": resp.success_count, "failure": resp.failure_count}
        except Exception as e:
            logger.exception("FCM send error: %s", e)
            return {"status": "error", "error": str(e)}


_service: Optional[PushService] = None


def push_service() -> PushService:
    global _service
    if _service is None:
        _service = PushService()
    return _service


async def push_to_user(db, user_id: str, title: str, body: str, link: str | None = None):
    """Convenience: fetch user's tokens and send notification."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "fcm_tokens": 1})
    if not user:
        return {"status": "no_user"}
    tokens = user.get("fcm_tokens", []) or []
    if not tokens:
        return {"status": "no_tokens"}
    return await push_service().send_to_tokens(tokens, title, body, link)
