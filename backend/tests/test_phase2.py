"""Phase 2 backend tests for Rurapp.

Covers: COL payment providers (Wompi/MercadoPago MOCKED), webhooks,
chat (REST), conversations, verifications, admin endpoints, geolocation.
"""
import os
import uuid
import json
import asyncio
import pytest
import requests

try:
    import websockets  # noqa
    HAS_WS = True
except ImportError:
    HAS_WS = False

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ORIGIN = BASE_URL

PROD_EMAIL = "campesino@rurapp.co"
VET_EMAIL = "vet@rurapp.co"
CLI_EMAIL = "cliente@rurapp.co"
ADMIN_EMAIL = "admin@rurapp.co"
PWD = "rurapp123"


def _login(s, email):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": PWD})
    assert r.status_code == 200, f"login {email}: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def prod_auth(s):
    d = _login(s, PROD_EMAIL)
    return {"token": d["access_token"], "user": d["user"],
            "headers": {"Authorization": f"Bearer {d['access_token']}"}}


@pytest.fixture(scope="session")
def vet_auth(s):
    d = _login(s, VET_EMAIL)
    return {"token": d["access_token"], "user": d["user"],
            "headers": {"Authorization": f"Bearer {d['access_token']}"}}


@pytest.fixture(scope="session")
def cli_auth(s):
    d = _login(s, CLI_EMAIL)
    return {"token": d["access_token"], "user": d["user"],
            "headers": {"Authorization": f"Bearer {d['access_token']}"}}


@pytest.fixture(scope="session")
def admin_auth(s):
    d = _login(s, ADMIN_EMAIL)
    return {"token": d["access_token"], "user": d["user"],
            "headers": {"Authorization": f"Bearer {d['access_token']}"}}


# ============================================================
# Geolocation: lat/lng on user
# ============================================================
class TestGeolocation:
    def test_seed_users_have_latlng(self, prod_auth, vet_auth, cli_auth):
        for a in (prod_auth, vet_auth, cli_auth):
            u = a["user"]
            assert "lat" in u and "lng" in u, f"user {u['email']} missing lat/lng"
            assert u["lat"] is not None and u["lng"] is not None, f"user {u['email']} lat/lng null"

    def test_update_me_with_latlng(self, s, cli_auth):
        new_lat, new_lng = 6.2442, -75.5812  # Medellín
        r = s.put(f"{API}/auth/me", headers=cli_auth["headers"],
                  json={"lat": new_lat, "lng": new_lng})
        assert r.status_code == 200
        assert r.json()["lat"] == new_lat
        assert r.json()["lng"] == new_lng
        # persistence
        r2 = s.get(f"{API}/auth/me", headers=cli_auth["headers"])
        assert r2.json()["lat"] == new_lat

    def test_register_with_latlng(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@test.co"
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "full_name": "Geo User",
            "role": "cliente", "lat": 4.7110, "lng": -74.0721,
        })
        assert r.status_code == 200, r.text
        assert r.json()["user"]["lat"] == 4.7110

    def test_users_list_includes_latlng(self, s):
        r = s.get(f"{API}/users", params={"role": "veterinario"})
        assert r.status_code == 200
        users = r.json()
        assert any(u.get("lat") is not None for u in users)


# ============================================================
# COL Payment Providers (MOCKED)
# ============================================================
class TestCOLPayments:
    @pytest.fixture(scope="class")
    def prod_product(self, s, prod_auth):
        r = s.post(f"{API}/products", headers=prod_auth["headers"], json={
            "name": f"TEST_COL_{uuid.uuid4().hex[:6]}",
            "description": "test", "category": "frutas",
            "price": 5.0, "unit": "kg", "stock": 50,
        })
        assert r.status_code == 200, r.text
        return r.json()

    @pytest.fixture(scope="class")
    def vet_service(self, s, vet_auth):
        r = s.post(f"{API}/services", headers=vet_auth["headers"], json={
            "title": f"TEST_COL_SVC_{uuid.uuid4().hex[:6]}",
            "description": "test", "category": "consulta_virtual",
            "price": 12.0, "duration_minutes": 30,
        })
        assert r.status_code == 200, r.text
        return r.json()

    @pytest.mark.parametrize("provider", ["wompi", "mercadopago"])
    def test_create_order_with_co_provider(self, s, cli_auth, prod_product, provider):
        r = s.post(f"{API}/orders", headers=cli_auth["headers"], json={
            "items": [{"product_id": prod_product["id"], "quantity": 1}],
            "delivery_address": "Bogotá",
            "origin_url": ORIGIN,
            "payment_provider": provider,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] == provider
        assert d["session_id"].startswith(f"mock_{'wompi' if provider == 'wompi' else 'mp'}_")
        assert "checkout_url" in d
        assert f"mocked={provider}" in d["checkout_url"]
        # Save for status test
        if provider == "wompi":
            pytest.wompi_session = d["session_id"]
            pytest.wompi_order_id = d["order_id"]
        else:
            pytest.mp_session = d["session_id"]
            pytest.mp_order_id = d["order_id"]

    @pytest.mark.parametrize("provider", ["wompi", "mercadopago"])
    def test_create_booking_with_co_provider(self, s, cli_auth, vet_service, provider):
        r = s.post(f"{API}/bookings", headers=cli_auth["headers"], json={
            "service_id": vet_service["id"],
            "scheduled_at": "2026-04-01T10:00:00Z",
            "origin_url": ORIGIN,
            "payment_provider": provider,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] == provider
        assert "checkout_url" in d
        assert f"mocked={provider}" in d["checkout_url"]

    @pytest.mark.parametrize("provider", ["wompi", "mercadopago"])
    def test_membership_checkout_with_co_provider(self, s, prod_auth, provider):
        r = s.post(f"{API}/memberships/checkout", headers=prod_auth["headers"], json={
            "plan_id": "basico",
            "origin_url": ORIGIN,
            "payment_provider": provider,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] == provider
        assert "checkout_url" in d
        assert f"mocked={provider}" in d["checkout_url"]

    def test_payment_status_wompi_mocked(self, s):
        sid = getattr(pytest, "wompi_session", None)
        if not sid:
            pytest.skip("no wompi session")
        r = s.get(f"{API}/payments/status/{sid}")
        assert r.status_code == 200, r.text
        body = r.json()
        # MOCKED wompi returns APPROVED -> should mark paid
        assert body["payment_status"] == "paid"
        assert body["status"] == "complete"
        assert body["type"] == "order"

    def test_payment_status_mp_mocked(self, s):
        sid = getattr(pytest, "mp_session", None)
        if not sid:
            pytest.skip("no mp session")
        r = s.get(f"{API}/payments/status/{sid}")
        assert r.status_code == 200, r.text
        body = r.json()
        # MOCKED MP returns approved -> should mark paid
        assert body["payment_status"] == "paid"
        assert body["status"] == "complete"
        assert body["type"] == "order"


# ============================================================
# COL Webhooks (no 500 on malformed payloads)
# ============================================================
class TestWebhooks:
    def test_wompi_webhook_empty(self, s):
        r = s.post(f"{API}/webhook/wompi", json={})
        assert r.status_code == 200
        assert r.json()["received"] is True

    def test_wompi_webhook_malformed(self, s):
        r = s.post(f"{API}/webhook/wompi", data="garbage", headers={"Content-Type": "application/json"})
        assert r.status_code == 200

    def test_wompi_webhook_payload_shape(self, s):
        r = s.post(f"{API}/webhook/wompi", json={
            "event": "transaction.updated",
            "data": {"transaction": {"id": "x", "status": "PENDING", "reference": "nope"}},
        })
        assert r.status_code == 200

    def test_mp_webhook_empty(self, s):
        r = s.post(f"{API}/webhook/mercadopago", json={})
        assert r.status_code == 200

    def test_mp_webhook_payload(self, s):
        r = s.post(f"{API}/webhook/mercadopago", json={
            "data": {"id": "1234"}, "type": "payment",
        })
        assert r.status_code == 200


# ============================================================
# CHAT (REST)
# ============================================================
class TestChat:
    @pytest.fixture(scope="class")
    def conv(self, s, cli_auth, vet_auth):
        # cliente -> veterinario
        r = s.post(f"{API}/conversations", headers=cli_auth["headers"], json={
            "other_user_id": vet_auth["user"]["id"],
        })
        assert r.status_code == 200, r.text
        return r.json()

    def test_create_conversation(self, conv, cli_auth, vet_auth):
        assert "id" in conv
        assert cli_auth["user"]["id"] in conv["participants"]
        assert vet_auth["user"]["id"] in conv["participants"]

    def test_create_conversation_idempotent(self, s, cli_auth, vet_auth, conv):
        r = s.post(f"{API}/conversations", headers=cli_auth["headers"], json={
            "other_user_id": vet_auth["user"]["id"],
        })
        assert r.status_code == 200
        assert r.json()["id"] == conv["id"]  # same conv returned

    def test_create_conversation_self_forbidden(self, s, cli_auth):
        r = s.post(f"{API}/conversations", headers=cli_auth["headers"], json={
            "other_user_id": cli_auth["user"]["id"],
        })
        assert r.status_code == 400

    def test_list_conversations(self, s, cli_auth, conv):
        r = s.get(f"{API}/conversations", headers=cli_auth["headers"])
        assert r.status_code == 200
        assert any(c["id"] == conv["id"] for c in r.json())

    def test_send_message(self, s, cli_auth, conv):
        r = s.post(f"{API}/messages", headers=cli_auth["headers"], json={
            "conversation_id": conv["id"],
            "content": "Hola, necesito ayuda con mis vacas.",
        })
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["sender_id"] == cli_auth["user"]["id"]
        assert msg["content"].startswith("Hola")

    def test_send_message_unauth(self, s, prod_auth, conv):
        # productor not a participant in cli<->vet conv
        r = s.post(f"{API}/messages", headers=prod_auth["headers"], json={
            "conversation_id": conv["id"], "content": "intruso",
        })
        assert r.status_code == 403

    def test_get_messages_resets_unread(self, s, vet_auth, conv):
        # First send a message FROM cli TO vet to create unread
        # Then vet fetches messages, should reset their unread
        r = s.get(f"{API}/conversations/{conv['id']}/messages", headers=vet_auth["headers"])
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 1
        # Verify unread reset
        list_r = s.get(f"{API}/conversations", headers=vet_auth["headers"])
        my_conv = next((c for c in list_r.json() if c["id"] == conv["id"]), None)
        assert my_conv is not None
        assert my_conv["unread_for"].get(vet_auth["user"]["id"], 0) == 0

    def test_get_messages_unauth(self, s, prod_auth, conv):
        r = s.get(f"{API}/conversations/{conv['id']}/messages", headers=prod_auth["headers"])
        assert r.status_code == 403

    def test_messages_requires_auth(self, s, conv):
        r = s.post(f"{API}/messages", json={
            "conversation_id": conv["id"], "content": "x",
        })
        assert r.status_code in (401, 403)


# ============================================================
# WebSocket /api/ws/chat
# ============================================================
@pytest.mark.skipif(not HAS_WS, reason="websockets not installed")
class TestWebSocket:
    def _ws_url(self, token):
        # convert https -> wss, http -> ws
        url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        return f"{url}/api/ws/chat?token={token}"

    def test_ws_invalid_token_rejected(self, cli_auth):
        async def run():
            import websockets
            try:
                async with websockets.connect(self._ws_url("invalid_token_123")) as ws:
                    # The server should close with 4401; receive will raise
                    await asyncio.wait_for(ws.recv(), timeout=5)
                    return "received"
            except websockets.exceptions.ConnectionClosed as e:
                return ("closed", e.code)
            except websockets.exceptions.InvalidStatusCode as e:
                return ("rejected", e.status_code)
            except Exception as e:
                return ("error", str(e))
        result = asyncio.run(run())
        # Should be closed (4401) or connection rejected
        assert result[0] in ("closed", "rejected", "error"), f"Expected rejection got {result}"

    def test_ws_valid_token_accepted(self, cli_auth):
        async def run():
            import websockets
            try:
                async with websockets.connect(
                    self._ws_url(cli_auth["token"]),
                    open_timeout=5,
                ) as ws:
                    # Connection established; should remain open until we close
                    await asyncio.sleep(0.5)
                    return "connected"
            except Exception as e:
                return f"error:{e}"
        result = asyncio.run(run())
        assert result == "connected", f"WS connection failed: {result}"


# ============================================================
# VERIFICATIONS
# ============================================================
class TestVerifications:
    def test_submit_verification_as_vet(self, s, vet_auth):
        r = s.post(f"{API}/verifications", headers=vet_auth["headers"], json={
            "professional_name": "Dr. Test Vet",
            "document_type": "matricula",
            "document_url": "https://example.com/diploma_test.pdf",
            "professional_id": "MV-12345",
            "institution": "Universidad Nacional de Colombia",
            "notes": "10 años de experiencia en bovinos",
        }, timeout=60)
        assert r.status_code == 200, r.text
        ver = r.json()
        assert ver["user_id"] == vet_auth["user"]["id"]
        assert ver["professional_name"] == "Dr. Test Vet"
        # ai_recommendation may be approve/review/reject (or fallback "review" on AI failure)
        assert ver["ai_recommendation"] in ("approve", "review", "reject")
        assert ver["status"] in ("ai_approved", "pending")

    def test_submit_verification_non_vet_forbidden(self, s, cli_auth):
        r = s.post(f"{API}/verifications", headers=cli_auth["headers"], json={
            "professional_name": "X",
            "document_type": "matricula",
            "document_url": "https://example.com/x.pdf",
            "professional_id": "X",
        })
        assert r.status_code == 403

    def test_my_verification(self, s, vet_auth):
        r = s.get(f"{API}/verifications/mine", headers=vet_auth["headers"])
        assert r.status_code == 200
        # could be null if no submission - we just submitted one above so should have one
        body = r.json()
        if body is not None:
            assert body["user_id"] == vet_auth["user"]["id"]

    def test_my_verification_empty_for_cli(self, s, cli_auth):
        r = s.get(f"{API}/verifications/mine", headers=cli_auth["headers"])
        assert r.status_code == 200
        # cliente never submitted -> null
        assert r.json() is None or r.json() == {}

    def test_verification_requires_auth(self, s):
        r = s.post(f"{API}/verifications", json={
            "professional_name": "x", "document_type": "x",
            "document_url": "https://x", "professional_id": "x",
        })
        assert r.status_code in (401, 403)


# ============================================================
# ADMIN
# ============================================================
class TestAdmin:
    def test_admin_me(self, s, admin_auth):
        r = s.get(f"{API}/admin/me", headers=admin_auth["headers"])
        assert r.status_code == 200
        assert r.json()["is_admin"] is True

    def test_admin_me_for_non_admin(self, s, cli_auth):
        r = s.get(f"{API}/admin/me", headers=cli_auth["headers"])
        assert r.status_code == 200
        assert r.json()["is_admin"] is False

    def test_admin_list_verifications(self, s, admin_auth):
        r = s.get(f"{API}/admin/verifications", headers=admin_auth["headers"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_list_with_status_filter(self, s, admin_auth):
        r = s.get(f"{API}/admin/verifications",
                  headers=admin_auth["headers"], params={"status": "pending"})
        assert r.status_code == 200
        for v in r.json():
            assert v["status"] == "pending"

    def test_admin_list_forbidden_for_non_admin(self, s, cli_auth):
        r = s.get(f"{API}/admin/verifications", headers=cli_auth["headers"])
        assert r.status_code == 403

    def test_admin_review_verification(self, s, admin_auth, vet_auth):
        # Get latest verification for vet
        r = s.get(f"{API}/admin/verifications", headers=admin_auth["headers"])
        assert r.status_code == 200
        vers = [v for v in r.json() if v["user_id"] == vet_auth["user"]["id"]]
        if not vers:
            pytest.skip("no verifications for vet user")
        ver_id = vers[0]["id"]
        r2 = s.post(
            f"{API}/admin/verifications/{ver_id}/review",
            headers=admin_auth["headers"],
            json={"decision": "approve", "admin_notes": "test approve"},
        )
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["status"] == "approved"
        assert body["admin_notes"] == "test approve"
        # Verify user.verified flag set
        u = s.get(f"{API}/users/{vet_auth['user']['id']}").json()
        assert u["verified"] is True

    def test_admin_review_forbidden_for_non_admin(self, s, cli_auth):
        r = s.post(
            f"{API}/admin/verifications/fakeid/review",
            headers=cli_auth["headers"],
            json={"decision": "approve"},
        )
        assert r.status_code == 403

    def test_admin_review_not_found(self, s, admin_auth):
        r = s.post(
            f"{API}/admin/verifications/nope_xxx/review",
            headers=admin_auth["headers"],
            json={"decision": "reject"},
        )
        assert r.status_code == 404
