
from unittest.mock import patch

import database


class FakeQuery:
    def count(self):
        return 1


class FakeDB:
    def query(self, model):
        return FakeQuery()

    def close(self):
        pass


with patch.object(database, "init_db", lambda: None), \
     patch.object(database, "SessionLocal", FakeDB):
    from fastapi.testclient import TestClient
    from main import app


client = TestClient(app)


def test_home_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "status": "Running",
        "message": "HR Chatbot Backend is Live"
    }


def test_openapi_schema():
    response = client.get("/openapi.json")

    assert response.status_code == 200

    schema = response.json()

    assert schema["info"]["title"] == "HR Chatbot Backend"
    assert "/" in schema["paths"]


def test_api_routes_registered():
    paths = app.openapi()["paths"]

    expected_routes = [
        "/",
        "/chat",
        "/chat/stream",
        "/auth/login",
        "/auth/signup",
    ]

    for route in expected_routes:
        assert route in paths, f"Missing API route: {route}"

