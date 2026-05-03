"""Rurapp backend API tests (pytest).

Covers: auth, users, products, services, orders, bookings, memberships,
payments status, reviews, articles, AI chat.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rural-market-16.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ORIGIN = BASE_URL

# seed creds
PROD_EMAIL = "campesino@rurapp.co"
VET_EMAIL = "vet@rurapp.co"
CLI_EMAIL = "cliente@rurapp.co"
PWD = "rurapp123"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _login(s, email, password=PWD):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()


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


# ---------- health ----------
class TestHealth:
    def test_health(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------- auth ----------
class TestAuth:
    def test_login_seed_users(self, prod_auth, vet_auth, cli_auth):
        assert prod_auth["user"]["role"] == "productor"
        assert prod_auth["user"]["membership_active"] is True
        assert vet_auth["user"]["role"] == "veterinario"
        assert vet_auth["user"]["membership_active"] is True
        assert cli_auth["user"]["role"] == "cliente"

    def test_login_invalid(self, s):
        r = s.post(f"{API}/auth/login", json={"email": PROD_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@test.co"  # lowercase (backend normalizes)
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "full_name": "Test User",
            "role": "cliente", "location": "Bogotá",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == email.lower()
        assert data["user"]["membership_active"] is True  # clients auto-active

        token = data["access_token"]
        r2 = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert r2.json()["email"] == email.lower()

    def test_register_duplicate(self, s):
        r = s.post(f"{API}/auth/register", json={
            "email": PROD_EMAIL, "password": "secret123", "full_name": "Dup",
            "role": "cliente",
        })
        assert r.status_code == 400

    def test_register_producer_no_membership(self, s):
        """Producer registers -> membership should NOT be auto-active."""
        email = f"TEST_{uuid.uuid4().hex[:8]}@test.co"
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "full_name": "Prod T",
            "role": "productor",
        })
        assert r.status_code == 200
        assert r.json()["user"]["membership_active"] is False

    def test_update_me(self, s, cli_auth):
        new_bio = f"bio-{uuid.uuid4().hex[:6]}"
        r = s.put(f"{API}/auth/me", headers=cli_auth["headers"],
                  json={"bio": new_bio, "location": "Medellín"})
        assert r.status_code == 200
        assert r.json()["bio"] == new_bio
        # Verify persistence
        r2 = s.get(f"{API}/auth/me", headers=cli_auth["headers"])
        assert r2.json()["bio"] == new_bio

    def test_me_requires_auth(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------- users ----------
class TestUsers:
    def test_list_users(self, s):
        r = s.get(f"{API}/users")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 3

    def test_list_users_role_filter(self, s):
        r = s.get(f"{API}/users", params={"role": "veterinario"})
        assert r.status_code == 200
        for u in r.json():
            assert u["role"] == "veterinario"

    def test_list_users_location_filter(self, s):
        r = s.get(f"{API}/users", params={"location": "boyac"})
        assert r.status_code == 200
        assert all("boyac" in (u.get("location") or "").lower() for u in r.json())

    def test_get_user(self, s, prod_auth):
        r = s.get(f"{API}/users/{prod_auth['user']['id']}")
        assert r.status_code == 200
        assert r.json()["email"] == PROD_EMAIL

    def test_get_user_not_found(self, s):
        r = s.get(f"{API}/users/nope-xx")
        assert r.status_code == 404


# ---------- products ----------
@pytest.fixture(scope="class")
def prod_product(s, prod_auth):
    payload = {
        "name": f"TEST_Prod_{uuid.uuid4().hex[:6]}",
        "description": "Producto de prueba",
        "category": "frutas",
        "price": 5.5,
        "unit": "kg",
        "stock": 100,
        "sustainable_practices": ["organico"],
    }
    r = s.post(f"{API}/products", headers=prod_auth["headers"], json=payload)
    assert r.status_code == 200, r.text
    return r.json()


class TestProducts:
    def test_create_product(self, prod_product):
        assert prod_product["producer_name"]
        assert prod_product["active"] is True
        assert prod_product["price"] == 5.5

    def test_create_product_non_producer_forbidden(self, s, cli_auth):
        r = s.post(f"{API}/products", headers=cli_auth["headers"], json={
            "name": "x", "description": "x", "category": "frutas",
            "price": 1, "unit": "kg", "stock": 1,
        })
        assert r.status_code == 403

    def test_create_product_no_membership_402(self, s):
        """New producer without membership should get 402."""
        email = f"TEST_{uuid.uuid4().hex[:8]}@test.co"
        reg = s.post(f"{API}/auth/register", json={
            "email": email, "password": "secret123", "full_name": "NoMem Prod",
            "role": "productor",
        })
        token = reg.json()["access_token"]
        r = s.post(f"{API}/products",
                   headers={"Authorization": f"Bearer {token}"},
                   json={"name": "x", "description": "x", "category": "frutas",
                         "price": 1, "unit": "kg", "stock": 1})
        assert r.status_code == 402

    def test_list_products(self, s, prod_product):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert prod_product["id"] in ids

    def test_list_products_filters(self, s, prod_product):
        r = s.get(f"{API}/products", params={"category": "frutas"})
        assert r.status_code == 200
        assert all(p["category"] == "frutas" for p in r.json())

        r2 = s.get(f"{API}/products", params={"search": "TEST_Prod"})
        assert r2.status_code == 200
        assert any(prod_product["id"] == p["id"] for p in r2.json())

    def test_get_product(self, s, prod_product):
        r = s.get(f"{API}/products/{prod_product['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == prod_product["id"]

    def test_my_products(self, s, prod_auth, prod_product):
        r = s.get(f"{API}/products/mine", headers=prod_auth["headers"])
        assert r.status_code == 200
        assert any(p["id"] == prod_product["id"] for p in r.json())

    def test_update_product(self, s, prod_auth, prod_product):
        r = s.put(f"{API}/products/{prod_product['id']}",
                  headers=prod_auth["headers"], json={"price": 9.99})
        assert r.status_code == 200
        assert r.json()["price"] == 9.99
        # persistence
        g = s.get(f"{API}/products/{prod_product['id']}")
        assert g.json()["price"] == 9.99

    def test_update_product_foreign_forbidden(self, s, vet_auth, prod_product):
        r = s.put(f"{API}/products/{prod_product['id']}",
                  headers=vet_auth["headers"], json={"price": 1})
        assert r.status_code in (403, 404)  # vet not producer; 403 expected

    def test_delete_product_foreign_forbidden(self, s, cli_auth, prod_product):
        r = s.delete(f"{API}/products/{prod_product['id']}",
                     headers=cli_auth["headers"])
        assert r.status_code == 403


# ---------- services ----------
@pytest.fixture(scope="class")
def vet_service(s, vet_auth):
    payload = {
        "title": f"TEST_Svc_{uuid.uuid4().hex[:6]}",
        "description": "Servicio virtual de prueba",
        "category": "consulta_virtual",
        "price": 15.0,
        "duration_minutes": 30,
    }
    r = s.post(f"{API}/services", headers=vet_auth["headers"], json=payload)
    assert r.status_code == 200, r.text
    return r.json()


class TestServices:
    def test_create_service(self, vet_service):
        assert vet_service["expert_name"]
        assert vet_service["price"] == 15.0

    def test_create_service_non_vet_forbidden(self, s, prod_auth):
        r = s.post(f"{API}/services", headers=prod_auth["headers"], json={
            "title": "x", "description": "x", "category": "consulta_virtual",
            "price": 1, "duration_minutes": 30,
        })
        assert r.status_code == 403

    def test_list_services(self, s, vet_service):
        r = s.get(f"{API}/services")
        assert r.status_code == 200
        assert any(sv["id"] == vet_service["id"] for sv in r.json())

    def test_list_services_filter(self, s):
        r = s.get(f"{API}/services", params={"category": "consulta_virtual"})
        assert r.status_code == 200
        assert all(sv["category"] == "consulta_virtual" for sv in r.json())

    def test_get_service(self, s, vet_service):
        r = s.get(f"{API}/services/{vet_service['id']}")
        assert r.status_code == 200

    def test_my_services(self, s, vet_auth, vet_service):
        r = s.get(f"{API}/services/mine", headers=vet_auth["headers"])
        assert r.status_code == 200
        assert any(sv["id"] == vet_service["id"] for sv in r.json())

    def test_update_service(self, s, vet_auth, vet_service):
        r = s.put(f"{API}/services/{vet_service['id']}",
                  headers=vet_auth["headers"], json={"price": 20.0})
        assert r.status_code == 200
        assert r.json()["price"] == 20.0

    def test_update_service_foreign_forbidden(self, s, prod_auth, vet_service):
        r = s.put(f"{API}/services/{vet_service['id']}",
                  headers=prod_auth["headers"], json={"price": 1})
        assert r.status_code == 403


# ---------- orders + payments ----------
class TestOrders:
    def test_create_order_checkout_url(self, s, cli_auth, prod_product):
        r = s.post(f"{API}/orders", headers=cli_auth["headers"], json={
            "items": [{"product_id": prod_product["id"], "quantity": 2}],
            "delivery_address": "Calle 1, Bogotá",
            "origin_url": ORIGIN,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "checkout_url" in d and d["checkout_url"].startswith("http")
        assert "session_id" in d
        assert "order_id" in d
        pytest.session_id_order = d["session_id"]

    def test_my_orders(self, s, cli_auth):
        r = s.get(f"{API}/orders/mine", headers=cli_auth["headers"])
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_received_orders(self, s, prod_auth):
        r = s.get(f"{API}/orders/received", headers=prod_auth["headers"])
        assert r.status_code == 200  # may be empty since pending_payment excluded

    def test_order_stock_insufficient(self, s, cli_auth, prod_product):
        r = s.post(f"{API}/orders", headers=cli_auth["headers"], json={
            "items": [{"product_id": prod_product["id"], "quantity": 999999}],
            "delivery_address": "X", "origin_url": ORIGIN,
        })
        assert r.status_code == 400

    def test_payment_status_order(self, s):
        sid = getattr(pytest, "session_id_order", None)
        if not sid:
            pytest.skip("no session id")
        r = s.get(f"{API}/payments/status/{sid}")
        assert r.status_code == 200
        body = r.json()
        assert "status" in body
        assert "payment_status" in body
        assert body["type"] == "order"


# ---------- bookings ----------
class TestBookings:
    def test_create_booking_checkout(self, s, cli_auth, vet_service):
        r = s.post(f"{API}/bookings", headers=cli_auth["headers"], json={
            "service_id": vet_service["id"],
            "scheduled_at": "2026-03-01T10:00:00Z",
            "origin_url": ORIGIN,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("http")
        pytest.session_id_booking = d["session_id"]

    def test_my_bookings(self, s, cli_auth):
        r = s.get(f"{API}/bookings/mine", headers=cli_auth["headers"])
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_received_bookings(self, s, vet_auth):
        r = s.get(f"{API}/bookings/received", headers=vet_auth["headers"])
        assert r.status_code == 200

    def test_payment_status_booking(self, s):
        sid = getattr(pytest, "session_id_booking", None)
        if not sid:
            pytest.skip()
        r = s.get(f"{API}/payments/status/{sid}")
        assert r.status_code == 200
        assert r.json()["type"] == "booking"


# ---------- memberships ----------
class TestMemberships:
    def test_plans(self, s):
        r = s.get(f"{API}/memberships/plans")
        assert r.status_code == 200
        plans = r.json()
        ids = [p["id"] for p in plans]
        assert "basico" in ids and "pro" in ids
        basico = next(p for p in plans if p["id"] == "basico")
        pro = next(p for p in plans if p["id"] == "pro")
        assert basico["price"] == 9.99
        assert pro["price"] == 24.99

    def test_membership_checkout(self, s, prod_auth):
        r = s.post(f"{API}/memberships/checkout", headers=prod_auth["headers"],
                   json={"plan_id": "basico", "origin_url": ORIGIN})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("http")
        assert "session_id" in d

    def test_membership_checkout_invalid_plan(self, s, prod_auth):
        r = s.post(f"{API}/memberships/checkout", headers=prod_auth["headers"],
                   json={"plan_id": "nope", "origin_url": ORIGIN})
        assert r.status_code == 400

    def test_membership_checkout_forbidden_for_cliente(self, s, cli_auth):
        r = s.post(f"{API}/memberships/checkout", headers=cli_auth["headers"],
                   json={"plan_id": "basico", "origin_url": ORIGIN})
        assert r.status_code == 403


# ---------- reviews ----------
class TestReviews:
    def test_create_review_and_agg(self, s, cli_auth, prod_product):
        r = s.post(f"{API}/reviews", headers=cli_auth["headers"], json={
            "target_type": "product", "target_id": prod_product["id"],
            "rating": 5, "comment": "Excelente",
        })
        assert r.status_code == 200
        assert r.json()["rating"] == 5

        # list
        r2 = s.get(f"{API}/reviews",
                   params={"target_type": "product", "target_id": prod_product["id"]})
        assert r2.status_code == 200
        assert len(r2.json()) >= 1

        # aggregate on product
        r3 = s.get(f"{API}/products/{prod_product['id']}")
        assert r3.json()["rating_count"] >= 1
        assert r3.json()["rating_avg"] >= 1.0


# ---------- articles ----------
class TestArticles:
    def test_create_article_as_vet(self, s, vet_auth):
        r = s.post(f"{API}/articles", headers=vet_auth["headers"], json={
            "title": "TEST_Artículo",
            "content": "Contenido educativo sobre salud animal.",
            "category": "salud_animal",
            "tags": ["bovinos"],
        })
        assert r.status_code == 200
        art = r.json()
        assert art["author_role"] == "veterinario"
        pytest.article_id = art["id"]

    def test_create_article_forbidden_cliente(self, s, cli_auth):
        r = s.post(f"{API}/articles", headers=cli_auth["headers"], json={
            "title": "x", "content": "y", "category": "salud_animal",
        })
        assert r.status_code == 403

    def test_list_and_get_article(self, s):
        r = s.get(f"{API}/articles")
        assert r.status_code == 200
        aid = getattr(pytest, "article_id", None)
        if aid:
            r2 = s.get(f"{API}/articles/{aid}")
            assert r2.status_code == 200

    def test_like_article(self, s, cli_auth):
        aid = getattr(pytest, "article_id", None)
        if not aid:
            pytest.skip()
        r = s.post(f"{API}/articles/{aid}/like", headers=cli_auth["headers"])
        assert r.status_code == 200
        r2 = s.get(f"{API}/articles/{aid}")
        assert r2.json()["likes"] >= 1


# ---------- AI chat ----------
class TestAI:
    def test_ai_chat(self, s, cli_auth):
        r = s.post(f"{API}/ai/chat", headers=cli_auth["headers"], json={
            "message": "¿Cómo cuido una vaca con mastitis?",
        }, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data and len(data["reply"]) > 10
        assert "session_id" in data
        pytest.ai_session = data["session_id"]

    def test_ai_history(self, s, cli_auth):
        sid = getattr(pytest, "ai_session", None)
        if not sid:
            pytest.skip()
        r = s.get(f"{API}/ai/history/{sid}", headers=cli_auth["headers"])
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        roles = {m["role"] for m in msgs}
        assert "user" in roles and "assistant" in roles

    def test_ai_requires_auth(self, s):
        r = s.post(f"{API}/ai/chat", json={"message": "hola"})
        assert r.status_code in (401, 403)
