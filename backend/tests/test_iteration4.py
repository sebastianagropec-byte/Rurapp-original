"""Iteration 4 backend tests - Focus on 3 fixes:
1. HIGH: PII leak fix on /api/users unauth endpoints (UserDirectory schema)
2. MEDIUM #1: Discount code redeem race condition + double-redeem prevention
3. MEDIUM #2: Pagination on /api/products, /api/services, /api/users
Also regression: image upload + trial + admin discount code CRUD.
"""
import os
import time
import uuid
import base64
import requests
import pytest
import concurrent.futures

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

FORBIDDEN_PII_KEYS = {
    "email", "phone", "is_admin",
    "membership_active", "membership_expires_at", "membership_plan",
    "on_trial", "trial_used", "trial_ends_at", "password_hash",
}


# ---- helpers ----
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _register_fresh(role="productor"):
    email = f"TEST_it4_{role}_{uuid.uuid4().hex[:8]}@rurapp.co"
    payload = {
        "email": email, "password": "rurapp123",
        "full_name": f"Test {role}", "role": role,
        "phone": "3000000000", "location": "Boyacá",
        "lat": 5.5, "lng": -73.3,
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return email, r.json()["access_token"], r.json()["user"]["id"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@rurapp.co", "rurapp123")


@pytest.fixture(scope="module")
def producer_token():
    return _login("campesino@rurapp.co", "rurapp123")


@pytest.fixture(scope="module")
def client_token():
    return _login("cliente@rurapp.co", "rurapp123")


# =========================================================
# HIGH FIX: PII leak on /api/users (unauthenticated)
# =========================================================
class TestPIILeakFix:
    def test_list_users_unauth_no_pii(self):
        r = requests.get(f"{API}/users", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for u in data:
            leaked = FORBIDDEN_PII_KEYS.intersection(u.keys())
            assert not leaked, f"PII leaked in list_users: {leaked} in user {u.get('id')}"
            # must contain safe public fields
            assert "id" in u and "full_name" in u and "role" in u
            # lat/lng if present must be rounded to 2 decimals
            for coord in ("lat", "lng"):
                v = u.get(coord)
                if v is not None:
                    assert round(v, 2) == v, f"{coord} not rounded to 2 decimals: {v}"

    def test_get_user_unauth_no_pii(self):
        # Grab a user id via list first
        r = requests.get(f"{API}/users?role=productor&limit=1", timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert users, "no productor users"
        uid = users[0]["id"]

        r2 = requests.get(f"{API}/users/{uid}", timeout=15)
        assert r2.status_code == 200
        u = r2.json()
        leaked = FORBIDDEN_PII_KEYS.intersection(u.keys())
        assert not leaked, f"PII leaked in get_user_public: {leaked}"
        assert u["id"] == uid
        assert "full_name" in u
        # coord rounding
        for coord in ("lat", "lng"):
            v = u.get(coord)
            if v is not None:
                assert round(v, 2) == v

    def test_list_users_filter_by_role_still_works(self):
        r = requests.get(f"{API}/users?role=veterinario", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for u in data:
            assert u["role"] == "veterinario"


# =========================================================
# MEDIUM FIX #2: Pagination
# =========================================================
class TestPagination:
    def test_products_default_limit_and_explicit(self):
        r = requests.get(f"{API}/products?limit=5", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 5

    def test_products_limit_cap(self):
        r = requests.get(f"{API}/products?limit=999", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 100, "products limit should cap at 100"

    def test_products_skip(self):
        r1 = requests.get(f"{API}/products?limit=3&skip=0", timeout=15)
        r2 = requests.get(f"{API}/products?limit=3&skip=1", timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        a, b = r1.json(), r2.json()
        if len(a) >= 2 and len(b) >= 1:
            # r2[0] should not equal r1[0] (skip=1)
            assert a[0]["id"] != b[0]["id"]

    def test_services_limit(self):
        r = requests.get(f"{API}/services?limit=5", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 5

    def test_services_limit_cap(self):
        r = requests.get(f"{API}/services?limit=999", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 100

    def test_users_limit(self):
        r = requests.get(f"{API}/users?limit=5", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 5

    def test_users_limit_cap(self):
        r = requests.get(f"{API}/users?limit=999", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 200

    def test_users_skip(self):
        r1 = requests.get(f"{API}/users?limit=2&skip=0", timeout=15)
        r2 = requests.get(f"{API}/users?limit=2&skip=1", timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        a, b = r1.json(), r2.json()
        if len(a) >= 2 and len(b) >= 1:
            assert a[0]["id"] != b[0]["id"]

    def test_products_filter_regression(self):
        # ensure filter still works with pagination
        r = requests.get(f"{API}/products?category=frutas&limit=10", timeout=15)
        assert r.status_code == 200


# =========================================================
# MEDIUM FIX #1: Discount code redeem — double-redeem + race
# =========================================================
class TestRedeemRace:
    def _create_code(self, admin_token, max_uses=1, months=1):
        code_str = f"RURA-IT4-{uuid.uuid4().hex[:8].upper()}"
        payload = {
            "code": code_str,
            "months": months,
            "max_uses": max_uses,
            "notes": "iteration4 test",
            "plan_id": "basico",
        }
        r = requests.post(
            f"{API}/admin/discount-codes",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200, f"create code: {r.status_code} {r.text}"
        return r.json()

    def test_sequential_redeem_success(self, admin_token):
        code = self._create_code(admin_token, max_uses=2, months=1)
        # fresh producer
        _, tok, _ = _register_fresh("productor")
        r = requests.post(
            f"{API}/memberships/redeem-code",
            json={"code": code["code"], "plan_id": "basico"},
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r.status_code == 200, f"redeem failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert body.get("months") == 1

    def test_double_redeem_same_user_blocked(self, admin_token):
        code = self._create_code(admin_token, max_uses=5, months=1)
        _, tok, _ = _register_fresh("productor")

        r1 = requests.post(
            f"{API}/memberships/redeem-code",
            json={"code": code["code"], "plan_id": "basico"},
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r1.status_code == 200

        r2 = requests.post(
            f"{API}/memberships/redeem-code",
            json={"code": code["code"], "plan_id": "basico"},
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r2.status_code == 400
        assert "canjeaste" in r2.json().get("detail", "").lower(), r2.text

        # verify uses was rolled back → still equals 1
        codes = requests.get(
            f"{API}/admin/discount-codes",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        ).json()
        found = [c for c in codes if c["code"] == code["code"]]
        assert found and found[0]["uses"] == 1, f"uses should be 1 after rollback, got {found[0]['uses'] if found else 'N/A'}"

    def test_parallel_redeem_max_uses_1(self, admin_token):
        """Fire 5 parallel redeems of a max_uses=1 code from 5 fresh users.
        Exactly ONE must succeed, other 4 must get 400 with limit message."""
        code = self._create_code(admin_token, max_uses=1, months=1)

        # register 5 fresh producers first (sequential — we only race the redeem)
        tokens = []
        for _ in range(5):
            _, t, _ = _register_fresh("productor")
            tokens.append(t)

        def redeem(tok):
            try:
                r = requests.post(
                    f"{API}/memberships/redeem-code",
                    json={"code": code["code"], "plan_id": "basico"},
                    headers={"Authorization": f"Bearer {tok}"},
                    timeout=20,
                )
                return r.status_code, r.json() if r.headers.get("content-type","" ).startswith("application/json") else r.text
            except Exception as e:
                return 599, str(e)

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
            results = list(ex.map(redeem, tokens))

        successes = [r for r in results if r[0] == 200]
        failures = [r for r in results if r[0] == 400]
        print(f"parallel results: {results}")
        assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}: {results}"
        assert len(failures) == 4, f"Expected 4 failures, got {len(failures)}: {results}"

        # every failure detail should mention limit
        for status, body in failures:
            detail = body.get("detail", "") if isinstance(body, dict) else str(body)
            assert "límite" in detail or "limit" in detail.lower() or "alcanzó" in detail, f"unexpected detail: {detail}"

        # admin sees uses==1
        codes = requests.get(
            f"{API}/admin/discount-codes",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        ).json()
        found = [c for c in codes if c["code"] == code["code"]]
        assert found and found[0]["uses"] == 1, f"expected uses=1, got {found[0]['uses'] if found else 'N/A'}"


# =========================================================
# REGRESSION: image upload
# =========================================================
class TestImageUploadRegression:
    def test_upload_png(self, producer_token):
        # 100x100 solid PNG
        try:
            from PIL import Image
            import io
            img = Image.new("RGB", (100, 100), (10, 200, 50))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            files = {"file": ("test.png", buf.getvalue(), "image/png")}
            r = requests.post(
                f"{API}/uploads/image",
                files=files,
                headers={"Authorization": f"Bearer {producer_token}"},
                timeout=30,
            )
            assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
            body = r.json()
            assert "url" in body and body["url"].startswith("data:image/")
            assert body.get("mime", "").startswith("image/")
            assert isinstance(body.get("size"), int)
        except ImportError:
            pytest.skip("PIL not available")


# =========================================================
# REGRESSION: trial + admin CRUD + non-admin 403
# =========================================================
class TestTrialAndAdminCRUD:
    def test_admin_create_list_delete_code(self, admin_token):
        code_str = f"RURA-IT4CRUD-{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(
            f"{API}/admin/discount-codes",
            json={"code": code_str, "months": 1, "max_uses": 1, "plan_id": "basico"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        code_id = r.json()["id"]

        r2 = requests.get(
            f"{API}/admin/discount-codes",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert any(c["id"] == code_id for c in r2.json())

        r3 = requests.delete(
            f"{API}/admin/discount-codes/{code_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r3.status_code == 200

    def test_non_admin_403(self, client_token):
        r = requests.get(
            f"{API}/admin/discount-codes",
            headers={"Authorization": f"Bearer {client_token}"},
            timeout=15,
        )
        assert r.status_code == 403

        r2 = requests.post(
            f"{API}/admin/discount-codes",
            json={"months": 1, "max_uses": 1},
            headers={"Authorization": f"Bearer {client_token}"},
            timeout=15,
        )
        assert r2.status_code == 403

    def test_start_trial_once_fresh_producer(self):
        _, tok, _ = _register_fresh("productor")
        r = requests.post(
            f"{API}/memberships/start-trial",
            json={"plan_id": "basico", "origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r.status_code == 200, f"start-trial: {r.status_code} {r.text}"

        # second start-trial must fail
        r2 = requests.post(
            f"{API}/memberships/start-trial",
            json={"plan_id": "basico", "origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r2.status_code >= 400, f"second start-trial should fail, got {r2.status_code}"
