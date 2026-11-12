
"""
auth.py
JWT-based authentication for the HR chatbot.

Employee accounts are stored in users.json.
HR uses a fixed account configured through backend/.env.
"""

import json
import os
import re
import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException


BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
USERS_FILE = BASE_DIR / "users.json"

load_dotenv(dotenv_path=ENV_FILE)

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 12

HR_EMAIL = os.getenv("HR_EMAIL", "").strip().lower()
HR_PASSWORD_HASH = os.getenv("HR_PASSWORD_HASH", "").strip()

ALLOWED_ROLES = {"employee", "hr"}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


if len(JWT_SECRET.encode("utf-8")) < 32:
    raise ValueError(
        "JWT_SECRET must contain at least 32 bytes."
    )


def normalize_email(email: str) -> str:
    if not isinstance(email, str):
        raise ValueError("A valid email address is required.")

    normalized = email.strip().lower()

    if len(normalized) > 254 or not EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("Please enter a valid email address.")

    return normalized


def load_users() -> dict:
    if not USERS_FILE.exists():
        return {}

    try:
        with USERS_FILE.open("r", encoding="utf-8") as file:
            users = json.load(file)
    except (json.JSONDecodeError, OSError) as exc:
        raise RuntimeError(
            "Employee account storage could not be read."
        ) from exc

    if not isinstance(users, dict):
        raise RuntimeError("Employee account storage has an invalid format.")

    return users


def save_users(users: dict) -> None:
    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=USERS_FILE.parent,
            suffix=".tmp",
            delete=False,
        ) as file:
            json.dump(users, file, indent=2)
            file.flush()
            os.fsync(file.fileno())
            temporary_path = Path(file.name)

        os.replace(temporary_path, USERS_FILE)

    except OSError as exc:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink(missing_ok=True)

        raise RuntimeError(
            "Employee account storage could not be updated."
        ) from exc


def hash_password(password: str) -> str:
    if not isinstance(password, str):
        raise ValueError("Invalid password.")

    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError(
            "Password must not exceed 72 UTF-8 bytes."
        )

    return bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not isinstance(password, str) or not isinstance(hashed, str):
        return False

    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        return False

    try:
        return bcrypt.checkpw(
            password_bytes,
            hashed.encode("utf-8"),
        )
    except (ValueError, TypeError, UnicodeError):
        return False


def create_token(email: str, role: str) -> str:
    normalized_email = normalize_email(email)
    normalized_role = role.strip().lower()

    if normalized_role not in ALLOWED_ROLES:
        raise ValueError("Invalid account role.")

    now = datetime.now(timezone.utc)

    payload = {
        "sub": normalized_email,
        "email": normalized_email,
        "role": normalized_role,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRY_HOURS),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM],
        options={
            "require": ["exp", "email", "role"],
        },
    )

    try:
        email = normalize_email(payload.get("email", ""))
    except ValueError as exc:
        raise jwt.InvalidTokenError("Invalid token email.") from exc

    role = payload.get("role")

    if not isinstance(role, str) or role not in ALLOWED_ROLES:
        raise jwt.InvalidTokenError("Invalid account role.")

    subject = payload.get("sub")

    if "sub" in payload and (
        not isinstance(subject, str) or subject != email
    ):
        raise jwt.InvalidTokenError("Invalid token subject.")

    payload["email"] = email

    return payload


def validate_password(password: str) -> None:
    if not isinstance(password, str):
        raise ValueError("A valid password is required.")

    if len(password) < 8:
        raise ValueError(
            "Password must be at least 8 characters long."
        )

    if len(password.encode("utf-8")) > 72:
        raise ValueError(
            "Password must not exceed 72 UTF-8 bytes."
        )

    if not any(character.isalpha() for character in password):
        raise ValueError(
            "Password must include at least one letter."
        )

    if not any(character.isdigit() for character in password):
        raise ValueError(
            "Password must include at least one number."
        )


def find_employee(users: dict, email: str):
    normalized_email = normalize_email(email)

    for stored_email, user in users.items():
        if (
            isinstance(stored_email, str)
            and stored_email.strip().lower() == normalized_email
        ):
            return stored_email, user

    return None, None


def signup_employee(email: str, password: str) -> dict:
    normalized_email = normalize_email(email)

    if HR_EMAIL and normalized_email == HR_EMAIL:
        raise ValueError("This email is reserved.")

    validate_password(password)

    users = load_users()

    existing_email, _ = find_employee(users, normalized_email)

    if existing_email:
        raise ValueError(
            "An account with this email already exists."
        )

    users[normalized_email] = {
        "password_hash": hash_password(password),
        "role": "employee",
    }

    save_users(users)

    return {
        "email": normalized_email,
        "role": "employee",
    }


def login(email: str, password: str, requested_role: str) -> dict:
    normalized_email = normalize_email(email)

    if not isinstance(password, str) or not password:
        raise ValueError("Invalid email or password.")

    normalized_role = (
        requested_role.strip().lower()
        if isinstance(requested_role, str)
        else ""
    )

    if normalized_role not in ALLOWED_ROLES:
        raise ValueError("Invalid account role.")

    if normalized_role == "hr":
        if not HR_EMAIL or not HR_PASSWORD_HASH:
            raise ValueError(
                "HR login is not configured on this server."
            )

        if normalized_email != HR_EMAIL:
            raise ValueError("Invalid HR credentials.")

        if not verify_password(password, HR_PASSWORD_HASH):
            raise ValueError("Invalid HR credentials.")

        return {
            "email": normalized_email,
            "role": "hr",
        }

    users = load_users()
    _, user = find_employee(users, normalized_email)

    if not isinstance(user, dict):
        raise ValueError("Invalid email or password.")

    password_hash = user.get("password_hash")
    stored_role = user.get("role")

    if not verify_password(password, password_hash):
        raise ValueError("Invalid email or password.")

    if stored_role != "employee":
        raise ValueError(
            "This account is not registered for that role."
        )

    return {
        "email": normalized_email,
        "role": "employee",
    }


def _get_authorization_payload(authorization: str | None) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header.",
        )

    scheme, separator, token = authorization.partition(" ")

    if (
        scheme.lower() != "bearer"
        or not separator
        or not token.strip()
    ):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header.",
        )

    try:
        return decode_token(token.strip())

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Session expired, please log in again.",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token.",
        )


def require_role(required_role: str):
    normalized_required_role = required_role.strip().lower()

    if normalized_required_role not in ALLOWED_ROLES:
        raise ValueError("Invalid required role.")

    def dependency(
        authorization: str | None = Header(default=None),
    ):
        payload = _get_authorization_payload(authorization)

        if payload["role"] != normalized_required_role:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"This action requires the "
                    f"{normalized_required_role} role."
                ),
            )

        return payload

    return dependency


def require_login(
    authorization: str | None = Header(default=None),
) -> dict:
    return _get_authorization_payload(authorization)


def get_optional_user(
    authorization: str | None = Header(default=None),
) -> dict | None:
    if not authorization:
        return None

    try:
        return _get_authorization_payload(authorization)
    except HTTPException:
        return None
