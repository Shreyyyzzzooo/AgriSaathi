"""Tests for User Authentication, Farmer Profile Persistence, and Chatbot History."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.session_store import init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_auth_registration_and_login_flow():
    test_user = "farmer_test_99"
    test_pass = "securepass123"

    # 1. Register new user
    reg_resp = client.post(
        "/api/auth/register",
        json={"username": test_user, "password": test_pass, "preferred_language": "hi"},
    )
    assert reg_resp.status_code in (201, 409)  # 201 if fresh, 409 if exists

    # 2. Duplicate username should return 409 (case insensitive check)
    dup_resp = client.post(
        "/api/auth/register",
        json={"username": test_user.upper(), "password": "differentpass"},
    )
    assert dup_resp.status_code == 409
    assert "already exists" in dup_resp.json()["detail"].lower()

    # 3. Login with correct password
    login_resp = client.post(
        "/api/auth/login",
        json={"username": test_user, "password": test_pass},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "token" in login_data
    token = login_data["token"]
    assert login_data["user"]["username"] == test_user

    # 4. Login with wrong password
    bad_login = client.post(
        "/api/auth/login",
        json={"username": test_user, "password": "wrongpassword"},
    )
    assert bad_login.status_code == 401

    # 5. Check GET /api/auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == test_user

    # 6. Update preferred language
    lang_resp = client.put("/api/auth/language", json={"language": "mr"}, headers=headers)
    assert lang_resp.status_code == 200
    me_resp2 = client.get("/api/auth/me", headers=headers)
    assert me_resp2.json()["preferred_language"] == "mr"


def test_farmer_profile_persistence():
    user = "profile_tester"
    password = "password123"
    reg = client.post("/api/auth/register", json={"username": user, "password": password})
    if reg.status_code == 201:
        token = reg.json()["token"]
    else:
        token = client.post("/api/auth/login", json={"username": user, "password": password}).json()["token"]

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Post farm setup via /api/farmer
    farm_data = {
        "location": "Pune, Maharashtra",
        "plot_size_ha": 2.5,
        "soil_type": "clay",
        "water_availability": "irrigated",
        "budget_inr": 150000,
        "farm_name": "Green Valley Farm",
        "state": "Maharashtra",
        "district": "Pune",
        "current_crop": "Wheat",
        "nitrogen": 140,
        "phosphorus": 60,
        "potassium": 50,
        "ph": 6.8,
    }
    post_resp = client.post("/api/farmer", json=farm_data, headers=headers)
    assert post_resp.status_code == 200
    assert "session_id" in post_resp.json()

    # 2. Retrieve profile via GET /api/farmer/profile
    get_resp = client.get("/api/farmer/profile", headers=headers)
    assert get_resp.status_code == 200
    profile = get_resp.json()["profile"]
    assert profile is not None
    assert profile["location"] == "Pune, Maharashtra"
    assert profile["district"] == "Pune"
    assert profile["state"] == "Maharashtra"
    assert profile["soil_type"] == "clay"
    assert profile["current_crop"] == "Wheat"
    assert profile["budget_inr"] == 150000

    # 3. Update location and verify it changes
    updated_data = {
        "location": "Indore, Madhya Pradesh",
        "plot_size_ha": 3.0,
        "soil_type": "loamy",
        "water_availability": "partial",
        "budget_inr": 80000,
    }
    update_resp = client.post("/api/farmer", json=updated_data, headers=headers)
    assert update_resp.status_code == 200

    get_resp2 = client.get("/api/farmer/profile", headers=headers)
    assert get_resp2.status_code == 200
    profile2 = get_resp2.json()["profile"]
    assert profile2 is not None
    assert profile2["location"] == "Indore, Madhya Pradesh"
    assert profile2["district"] == "Indore"
    assert profile2["state"] == "Madhya Pradesh"
    assert profile2["soil_type"] == "loamy"
    assert profile2["budget_inr"] == 80000


def test_chat_conversations_and_isolation():
    # User 1
    u1 = "chat_user_one"
    p1 = "pass1234"
    r1 = client.post("/api/auth/register", json={"username": u1, "password": p1})
    token1 = r1.json()["token"] if r1.status_code == 201 else client.post("/api/auth/login", json={"username": u1, "password": p1}).json()["token"]
    h1 = {"Authorization": f"Bearer {token1}"}

    # User 2
    u2 = "chat_user_two"
    p2 = "pass1234"
    r2 = client.post("/api/auth/register", json={"username": u2, "password": p2})
    token2 = r2.json()["token"] if r2.status_code == 201 else client.post("/api/auth/login", json={"username": u2, "password": p2}).json()["token"]
    h2 = {"Authorization": f"Bearer {token2}"}

    # 1. User 1 creates conversation
    conv_resp = client.post("/api/chat/conversations", json={"title": "New Conversation"}, headers=h1)
    assert conv_resp.status_code == 201
    conv_id = conv_resp.json()["id"]

    # 2. User 1 posts a message
    msg_resp = client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        json={"text": "What fertilizer should I use for wheat in clay soil?"},
        headers=h1,
    )
    assert msg_resp.status_code == 200
    bot_msg = msg_resp.json()
    assert bot_msg["sender"] == "bot"
    assert len(bot_msg["text"]) > 0

    # 3. Check conversation messages
    detail_resp = client.get(f"/api/chat/conversations/{conv_id}", headers=h1)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    # Should contain user message and bot reply
    assert len(detail["messages"]) == 2
    assert detail["messages"][0]["sender"] == "user"
    assert detail["messages"][1]["sender"] == "bot"

    # 4. Strict Isolation Check: User 2 cannot access User 1's conversation
    u2_access = client.get(f"/api/chat/conversations/{conv_id}", headers=h2)
    assert u2_access.status_code == 404

    # 5. User 1 deletes conversation
    del_resp = client.delete(f"/api/chat/conversations/{conv_id}", headers=h1)
    assert del_resp.status_code == 200

    # Verify it is gone
    gone_resp = client.get(f"/api/chat/conversations/{conv_id}", headers=h1)
    assert gone_resp.status_code == 404
