"""Iteration 3 — Image upload endpoint + Discount codes admin/redeem flows.

Focus per review_request:
  1. POST /api/uploads/image  (base64 data URL, PNG/JPG allowed, non-image rejected, >5MB rejected)
  2. POST /api/admin/discount-codes  (admin only, auto-generated code, plan_id + months)
  3. POST /api/memberships/redeem-code  (activate membership without payment)
  4. Regression: /api/memberships/start-trial once-only + /api/memberships/checkout still works
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------
def _login(email: str, password: str = "rurapp123") -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login("admin@rurapp.co")


@pytest.fixture(scope="session")
def producer_token():
    return _login("campesino@rurapp.co")


@pytest.fixture(scope="session")
def vet_token():
    return _login("vet@rurapp.co")


@pytest.fixture(scope="session")
def client_token():
    return _login("cliente@rurapp.co")


@pytest.fixture(scope="session")
def fresh_producer_token():
    """Register a brand-new producer for trial + redeem tests (needs a clean membership state)."""
    ts = int(time.time() * 1000)
    email = f"test_prod_{ts}@rurapp.co"
    r = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": "rurapp123",
        "full_name": "TEST Fresh Producer",
        "role": "productor",
        "location": "Boyacá",
    }, timeout=30)
    assert r.status_code == 200, f"register: {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]["id"], email


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# =====================================================
# 1. IMAGE UPLOAD
# =====================================================
def _tiny_png_bytes(w=200, h=200) -> bytes:
    from PIL import Image
    img = Image.new("RGB", (w, h), (0, 128, 0))
    px = img.load()
    # Add pattern to avoid ultra-compressible <100 byte output
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            px[x, y] = ((x * 7) % 255, (y * 11) % 255, ((x + y) * 3) % 255)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _tiny_jpg_bytes(w=32, h=32) -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (200, 100, 50)).save(buf, format="JPEG")
    return buf.getvalue()


class TestImageUpload:
    def test_upload_png_success(self, producer_token):
        files = {"file": ("test.png", _tiny_png_bytes(), "image/png")}
        r = requests.post(f"{API}/uploads/image", files=files, headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "size" in data and "mime" in data
        assert data["url"].startswith("data:image/")
        assert ";base64," in data["url"]
        assert data["mime"] in ("image/jpeg", "image/png")
        assert isinstance(data["size"], int) and data["size"] > 0

    def test_upload_jpg_success(self, producer_token):
        files = {"file": ("photo.jpg", _tiny_jpg_bytes(200, 200), "image/jpeg")}
        r = requests.post(f"{API}/uploads/image", files=files, headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["url"].startswith("data:image/jpeg;base64,")

    def test_upload_non_image_rejected(self, producer_token):
        files = {"file": ("hello.txt", b"just some text bytes here...."*20, "text/plain")}
        r = requests.post(f"{API}/uploads/image", files=files, headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 400
        assert "Formato" in r.text or "soportado" in r.text.lower()

    def test_upload_oversize_rejected(self, producer_token):
        # 6 MB of raw random-looking JPEG data via PIL (uncompressible = big)
        import random
        from PIL import Image
        img = Image.new("RGB", (2000, 2000))
        px = img.load()
        for y in range(0, 2000, 10):
            for x in range(0, 2000, 10):
                px[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=100)
        raw = buf.getvalue()
        # Pad to ensure >5MB
        while len(raw) <= 5 * 1024 * 1024:
            raw = raw + raw
        files = {"file": ("big.jpg", raw[: 6 * 1024 * 1024], "image/jpeg")}
        r = requests.post(f"{API}/uploads/image", files=files, headers=_hdr(producer_token), timeout=60)
        assert r.status_code == 400
        assert "5 MB" in r.text or "supera" in r.text.lower()

    def test_upload_requires_auth(self):
        files = {"file": ("test.png", _tiny_png_bytes(), "image/png")}
        r = requests.post(f"{API}/uploads/image", files=files, timeout=30)
        assert r.status_code in (401, 403)


# =====================================================
# 2. PRODUCT CREATION WITH BASE64 IMAGE  (bug fix end-to-end)
# =====================================================
class TestProductWithBase64Image:
    def test_create_product_with_uploaded_image(self, producer_token):
        # Upload image first
        files = {"file": ("veg.png", _tiny_png_bytes(), "image/png")}
        up = requests.post(f"{API}/uploads/image", files=files, headers=_hdr(producer_token), timeout=30)
        assert up.status_code == 200
        img_url = up.json()["url"]
        assert img_url.startswith("data:image/")

        # Create product with the data URL
        payload = {
            "name": "TEST_Zanahoria orgánica",
            "description": "Producto de prueba para verificar imagen base64",
            "category": "verduras",
            "price": 5000,
            "unit": "kg",
            "stock": 10,
            "image_url": img_url,
        }
        r = requests.post(f"{API}/products", json=payload, headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 200, r.text
        prod = r.json()
        assert prod["image_url"] == img_url
        pid = prod["id"]

        # GET back and verify persistence
        r2 = requests.get(f"{API}/products/{pid}", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["image_url"].startswith("data:image/")

        # And it appears in /products/mine
        r3 = requests.get(f"{API}/products/mine", headers=_hdr(producer_token), timeout=30)
        assert r3.status_code == 200
        assert any(p["id"] == pid for p in r3.json())

        # Cleanup
        requests.delete(f"{API}/products/{pid}", headers=_hdr(producer_token), timeout=30)


# =====================================================
# 3. ADMIN DISCOUNT CODES
# =====================================================
class TestDiscountCodesAdmin:
    def test_admin_create_auto_code(self, admin_token):
        r = requests.post(f"{API}/admin/discount-codes", json={
            "months": 12,
            "max_uses": 3,
        }, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        dc = r.json()
        assert dc["code"].startswith("RURA-"), dc["code"]
        assert len(dc["code"]) == 5 + 8  # RURA- + 8 chars
        assert dc["months"] == 12
        assert dc["max_uses"] == 3
        assert dc["uses"] == 0
        assert dc["active"] is True
        assert dc["plan_id"] is None

    def test_admin_create_explicit_code_and_plan(self, admin_token):
        code_str = f"RURA-TEST{int(time.time()) % 10000}"
        r = requests.post(f"{API}/admin/discount-codes", json={
            "code": code_str,
            "months": 6,
            "max_uses": 1,
            "plan_id": "pro",
        }, headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        dc = r.json()
        assert dc["code"] == code_str.upper()
        assert dc["plan_id"] == "pro"

    def test_admin_duplicate_code_rejected(self, admin_token):
        code_str = f"RURA-DUP{int(time.time()) % 10000}"
        r1 = requests.post(f"{API}/admin/discount-codes", json={"code": code_str, "months": 3}, headers=_hdr(admin_token))
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/admin/discount-codes", json={"code": code_str, "months": 3}, headers=_hdr(admin_token))
        assert r2.status_code == 400
        assert "existe" in r2.text.lower() or "ya" in r2.text.lower()

    def test_admin_list_codes(self, admin_token):
        r = requests.get(f"{API}/admin/discount-codes", headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_non_admin_forbidden(self, producer_token):
        r = requests.post(f"{API}/admin/discount-codes", json={"months": 6}, headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 403

    def test_unauthenticated_rejected(self):
        r = requests.post(f"{API}/admin/discount-codes", json={"months": 6}, timeout=30)
        assert r.status_code in (401, 403)


# =====================================================
# 4. REDEEM DISCOUNT CODE
# =====================================================
class TestDiscountCodeRedeem:
    def test_redeem_valid_code_activates_membership(self, admin_token, fresh_producer_token):
        tok, uid, email = fresh_producer_token
        # Admin creates a fresh code
        r = requests.post(f"{API}/admin/discount-codes", json={"months": 6, "max_uses": 2}, headers=_hdr(admin_token))
        code = r.json()["code"]

        # Producer redeems
        r2 = requests.post(f"{API}/memberships/redeem-code",
                           json={"code": code, "plan_id": "basico"},
                           headers=_hdr(tok), timeout=30)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["months"] == 6
        assert body["plan_id"] == "basico"

        # Verify status
        s = requests.get(f"{API}/memberships/status", headers=_hdr(tok), timeout=30)
        assert s.status_code == 200
        st = s.json()
        assert st["membership_active"] is True
        assert st["membership_plan"] == "basico"
        assert st["on_trial"] is False
        assert st["membership_expires_at"] is not None
        # ~= now + 180 days (6*30)  → days_left between 175 and 180
        assert st["days_left"] is not None and 170 <= st["days_left"] <= 181

    def test_redeem_same_code_twice_same_user_blocked(self, admin_token, fresh_producer_token):
        tok, _uid, _email = fresh_producer_token
        r = requests.post(f"{API}/admin/discount-codes", json={"months": 3, "max_uses": 10}, headers=_hdr(admin_token))
        code = r.json()["code"]
        r1 = requests.post(f"{API}/memberships/redeem-code", json={"code": code, "plan_id": "basico"}, headers=_hdr(tok))
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/memberships/redeem-code", json={"code": code, "plan_id": "basico"}, headers=_hdr(tok))
        assert r2.status_code == 400
        assert "canjeaste" in r2.text.lower() or "ya" in r2.text.lower()

    def test_redeem_invalid_code(self, producer_token):
        r = requests.post(f"{API}/memberships/redeem-code",
                          json={"code": "RURA-NOEXISTE99", "plan_id": "basico"},
                          headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 404

    def test_redeem_wrong_plan(self, admin_token, fresh_producer_token):
        # Create a code locked to "pro"
        r = requests.post(f"{API}/admin/discount-codes", json={"months": 3, "plan_id": "pro"}, headers=_hdr(admin_token))
        code = r.json()["code"]
        # New user tries to redeem for basico → 400
        ts = int(time.time() * 1000)
        reg = requests.post(f"{API}/auth/register", json={
            "email": f"test_prod_wp_{ts}@rurapp.co", "password": "rurapp123",
            "full_name": "TEST WP", "role": "productor",
        })
        tok = reg.json()["access_token"]
        r2 = requests.post(f"{API}/memberships/redeem-code",
                           json={"code": code, "plan_id": "basico"}, headers=_hdr(tok))
        assert r2.status_code == 400
        assert "pro" in r2.text.lower()

    def test_redeem_client_forbidden(self, admin_token, client_token):
        r = requests.post(f"{API}/admin/discount-codes", json={"months": 3}, headers=_hdr(admin_token))
        code = r.json()["code"]
        r2 = requests.post(f"{API}/memberships/redeem-code",
                           json={"code": code, "plan_id": "basico"}, headers=_hdr(client_token))
        assert r2.status_code == 403


# =====================================================
# 5. REGRESSION: trial + checkout
# =====================================================
class TestTrialRegression:
    def test_start_trial_once(self):
        ts = int(time.time() * 1000)
        reg = requests.post(f"{API}/auth/register", json={
            "email": f"test_trial_{ts}@rurapp.co", "password": "rurapp123",
            "full_name": "TEST Trial", "role": "productor",
        })
        tok = reg.json()["access_token"]

        # First trial → ok
        r1 = requests.post(f"{API}/memberships/start-trial",
                           json={"plan_id": "basico", "origin_url": "https://x.co"},
                           headers=_hdr(tok), timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json()["days"] == 7

        # Status reflects trial
        s = requests.get(f"{API}/memberships/status", headers=_hdr(tok)).json()
        assert s["on_trial"] is True and s["trial_used"] is True

        # Second attempt → 400
        r2 = requests.post(f"{API}/memberships/start-trial",
                           json={"plan_id": "basico", "origin_url": "https://x.co"},
                           headers=_hdr(tok), timeout=30)
        assert r2.status_code == 400


class TestCheckoutRegression:
    def test_membership_checkout_stripe(self, producer_token):
        r = requests.post(f"{API}/memberships/checkout",
                          json={"plan_id": "basico",
                                "origin_url": "https://rural-market-16.preview.emergentagent.com",
                                "payment_provider": "stripe"},
                          headers=_hdr(producer_token), timeout=45)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["checkout_url"].startswith("http")
        assert body["session_id"]
        assert body["provider"] == "stripe"

    def test_membership_checkout_wompi_mocked(self, producer_token):
        r = requests.post(f"{API}/memberships/checkout",
                          json={"plan_id": "basico",
                                "origin_url": "https://rural-market-16.preview.emergentagent.com",
                                "payment_provider": "wompi"},
                          headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["provider"] == "wompi"

    def test_membership_checkout_mercadopago_mocked(self, producer_token):
        r = requests.post(f"{API}/memberships/checkout",
                          json={"plan_id": "basico",
                                "origin_url": "https://rural-market-16.preview.emergentagent.com",
                                "payment_provider": "mercadopago"},
                          headers=_hdr(producer_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["provider"] == "mercadopago"
