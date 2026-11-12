from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

import auth


@pytest.fixture
def temporary_users_file(tmp_path, monkeypatch):
    users_file = tmp_path / "users.json"
    monkeypatch.setattr(auth, "USERS_FILE", users_file)
    return users_file


def test_signup_employee_success(temporary_users_file):
    result = auth.signup_employee("Employee@Example.com", "password123")

    assert result == {
        "email": "employee@example.com",
        "role": "employee",
    }

    users = auth.load_users()
    assert "employee@example.com" in users
    assert users["employee@example.com"]["role"] == "employee"
    assert users["employee@example.com"]["password_hash"] != "password123"


def test_signup_rejects_duplicate_email(temporary_users_file):
    auth.signup_employee("employee@example.com", "password123")

    with pytest.raises(ValueError, match="already exists"):
        auth.signup_employee("EMPLOYEE@example.com", "password456")


def test_signup_rejects_weak_password(temporary_users_file):
    with pytest.raises(ValueError):
        auth.signup_employee("employee@example.com", "weak")


def test_password_hash_and_verification():
    hashed = auth.hash_password("password123")

    assert hashed != "password123"
    assert auth.verify_password("password123", hashed)
    assert not auth.verify_password("wrongpassword", hashed)


def test_password_rejects_more_than_72_bytes():
    with pytest.raises(ValueError, match="72 UTF-8 bytes"):
        auth.validate_password("a" * 73)


def test_employee_login_success(temporary_users_file):
    auth.signup_employee("employee@example.com", "password123")

    result = auth.login(
        "EMPLOYEE@example.com",
        "password123",
        "employee",
    )

    assert result == {
        "email": "employee@example.com",
        "role": "employee",
    }


def test_employee_login_rejects_wrong_password(temporary_users_file):
    auth.signup_employee("employee@example.com", "password123")

    with pytest.raises(ValueError, match="Invalid email or password"):
        auth.login("employee@example.com", "wrongpassword", "employee")


def test_hr_login_success(monkeypatch):
    password_hash = auth.hash_password("hrpassword123")

    monkeypatch.setattr(auth, "HR_EMAIL", "hr@example.com")
    monkeypatch.setattr(auth, "HR_PASSWORD_HASH", password_hash)

    result = auth.login("HR@EXAMPLE.COM", "hrpassword123", "hr")

    assert result == {
        "email": "hr@example.com",
        "role": "hr",
    }


def test_token_contains_standard_claims():
    token = auth.create_token("employee@example.com", "employee")
    payload = auth.decode_token(token)

    assert payload["email"] == "employee@example.com"
    assert payload["sub"] == "employee@example.com"
    assert payload["role"] == "employee"
    assert "iat" in payload
    assert "exp" in payload


def test_expired_token_is_rejected():
    payload = {
        "email": "employee@example.com",
        "role": "employee",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }

    token = jwt.encode(
        payload,
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM,
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        auth.decode_token(token)


def test_invalid_role_token_is_rejected():
    token = jwt.encode(
        {
            "email": "employee@example.com",
            "role": "admin",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError):
        auth.decode_token(token)


def test_require_role_rejects_employee_for_hr():
    token = auth.create_token("employee@example.com", "employee")
    dependency = auth.require_role("hr")

    with pytest.raises(HTTPException) as error:
        dependency(authorization=f"Bearer {token}")

    assert error.value.status_code == 403


def test_require_login_rejects_missing_header():
    with pytest.raises(HTTPException) as error:
        auth.require_login(authorization=None)

    assert error.value.status_code == 401


def test_optional_auth_returns_none_for_invalid_token():
    result = auth.get_optional_user(
        authorization="Bearer invalid-token",
    )

    assert result is None

def test_token_rejects_invalid_email_claim():
    token = jwt.encode(
        {
            "email": "invalid-email",
            "role": "employee",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError, match="Invalid token email"):
        auth.decode_token(token)


def test_token_rejects_non_string_role_claim():
    token = jwt.encode(
        {
            "email": "employee@example.com",
            "role": ["employee"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        auth.JWT_SECRET,
        algorithm=auth.JWT_ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError, match="Invalid account role"):
        auth.decode_token(token)