"""Iteration 5 tests - Enhanced Rura AI assistant + regressions."""
import os
import re
import threading
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for in-container execution
    BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

PRODUCER = {"email": "campesino@rurapp.co", "password": "rurapp123"}
ADMIN = {"email": "admin@rurapp.co", "password": "rurapp123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def producer_token():
    return _login(PRODUCER)


@pytest.fixture(scope="module")
def producer_headers(producer_token):
    return {"Authorization": f"Bearer {producer_token}"}


# ---------- AI CHAT ----------
TAG_RE = re.compile(r"\[\[(PRO|URGENT|TOPIC):[^\]]*\]\]", re.I)


def _chat(headers, message, session_id=None):
    payload = {"message": message}
    if session_id:
        payload["session_id"] = session_id
    r = requests.post(f"{API}/ai/chat", json=payload, headers=headers, timeout=90)
    if r.status_code == 503 and "Budget" in r.text:
        pytest.skip("Emergent LLM budget exhausted")
    assert r.status_code == 200, f"AI chat failed: {r.status_code} {r.text}"
    return r.json()


def _assert_common(data):
    assert "session_id" in data and data["session_id"]
    assert "reply" in data and isinstance(data["reply"], str) and data["reply"].strip()
    assert "suggested_professional" in data
    assert data["suggested_professional"] in {"veterinario", "agronomo", "ninguno"}
    assert "urgent" in data and isinstance(data["urgent"], bool)
    assert "topic" in data
    # No raw tags leaked
    assert not TAG_RE.search(data["reply"]), f"Raw tag leaked in reply: {data['reply']!r}"


def test_ai_vet_urgent_case(producer_headers):
    data = _chat(producer_headers, "Mi vaca tiene sangre por la nariz y respira con dificultad")
    _assert_common(data)
    assert data["suggested_professional"] == "veterinario", f"expected veterinario, got {data['suggested_professional']}"
    assert data["urgent"] is True, f"expected urgent True, got {data}"


def test_ai_vet_non_urgent(producer_headers):
    data = _chat(producer_headers, "¿Cómo cuido un ternero recién nacido en invierno?")
    _assert_common(data)
    # Should still recommend veterinario (animal health domain)
    assert data["suggested_professional"] in {"veterinario", "ninguno"}


def test_ai_agronomo_case(producer_headers):
    data = _chat(producer_headers, "¿Qué fertilización le conviene a mi cultivo de papa en tierra fría?")
    _assert_common(data)
    assert data["suggested_professional"] == "agronomo", f"expected agronomo, got {data['suggested_professional']}"
    assert data["urgent"] is False


def test_ai_marketing_case(producer_headers):
    data = _chat(producer_headers, "¿Cómo le pongo precio justo a mi queso campesino para venderlo en Bogotá?")
    _assert_common(data)
    assert data["suggested_professional"] == "ninguno", f"expected ninguno, got {data['suggested_professional']}"
    assert data["urgent"] is False


def test_ai_history_returns_clean_reply(producer_headers):
    data = _chat(producer_headers, "Hola Rura, dame un consejo rápido sobre compostaje casero")
    _assert_common(data)
    sid = data["session_id"]
    time.sleep(0.5)
    h = requests.get(f"{API}/ai/history/{sid}", headers=producer_headers, timeout=30)
    assert h.status_code == 200
    msgs = h.json()
    assert isinstance(msgs, list) and len(msgs) >= 2
    for m in msgs:
        if m["role"] == "assistant":
            assert not TAG_RE.search(m["content"]), f"History has raw tag: {m['content']!r}"


# ---------- REGRESSIONS ----------
def test_users_unauth_no_sensitive_fields():
    r = requests.get(f"{API}/users", timeout=30)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list) and users, "users list empty"
    forbidden = {"email", "phone", "is_admin", "password", "password_hash"}
    for u in users[:20]:
        leaked = forbidden & set(u.keys())
        assert not leaked, f"User list leaks sensitive fields: {leaked} in {u}"


def test_products_limit_and_cap():
    r = requests.get(f"{API}/products", params={"limit": 2, "skip": 0}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) <= 2

    r2 = requests.get(f"{API}/products", params={"limit": 500}, timeout=30)
    assert r2.status_code == 200
    assert len(r2.json()) <= 100, f"products should cap at 100, got {len(r2.json())}"


def test_discount_code_concurrent_single_use(producer_headers):
    # Create a max_uses=1 discount code as admin
    admin_tok = _login(ADMIN)
    admin_h = {"Authorization": f"Bearer {admin_tok}"}

    code_value = f"TEST_IT5_{int(time.time())}"
    create_payload = {
        "code": code_value,
        "percent_off": 10,
        "max_uses": 1,
        "active": True,
    }
    r = requests.post(f"{API}/discount-codes", json=create_payload, headers=admin_h, timeout=30)
    if r.status_code == 404:
        pytest.skip("discount-codes endpoint not available")
    assert r.status_code in (200, 201), f"create failed {r.status_code} {r.text}"

    # Redeem concurrently
    results = []

    def _redeem():
        try:
            resp = requests.post(
                f"{API}/discount-codes/redeem",
                json={"code": code_value},
                headers=producer_headers,
                timeout=30,
            )
            results.append(resp.status_code)
        except Exception as e:
            results.append(f"err:{e}")

    threads = [threading.Thread(target=_redeem) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    successes = sum(1 for s in results if s == 200)
    assert successes == 1, f"expected exactly one 200 success, got {successes}; results={results}"
