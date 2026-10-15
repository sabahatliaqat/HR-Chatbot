
"""
auth.py
Minimal JWT-based auth — no SQL database.

Employee accounts are stored in users.json.
HR uses a fixed account configured through .env.
"""

import os
import json
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()

USERS_FILE = "users.json"

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 12

HR_EMAIL = os.getenv("HR_EMAIL")
HR_PASSWORD_HASH = os.getenv("HR_PASSWORD_HASH")

if not JWT_SECRET:
    raise ValueError("JWT_SECRET not found in .env file")


# Users JSON read/write
def load_users() -> dict:
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_users(users: dict) -> None:
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


# Password hashing
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# JWT
def create_token(email: str, role: str) -> str:
    payload = {
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc)
        + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# Password validation
def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not any(c.isalpha() for c in password):
        raise ValueError("Password must include at least one letter.")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must include at least one number.")


# Employee signup
def signup_employee(email: str, password: str) -> dict:
    users = load_users()

    if HR_EMAIL and email.strip().lower() == HR_EMAIL.strip().lower():
        raise ValueError("This email is reserved.")

    if email in users:
        raise ValueError("An account with this email already exists.")

    validate_password(password)

    users[email] = {
        "password_hash": hash_password(password),
        "role": "employee",
    }

    save_users(users)

    return {"email": email, "role": "employee"}


# Login
def login(email: str, password: str, requested_role: str) -> dict:
    if requested_role == "hr":
        print(
            "DEBUG HR config:",
            bool(HR_EMAIL),
            bool(HR_PASSWORD_HASH),
        )

        if not HR_EMAIL or not HR_PASSWORD_HASH:
            raise ValueError("HR login is not configured on this server.")

        if email.strip().lower() != HR_EMAIL.strip().lower():
            raise ValueError("Invalid HR credentials.")

        if not verify_password(password, HR_PASSWORD_HASH):
            raise ValueError("Invalid HR credentials.")

        return {"email": email, "role": "hr"}

    users = load_users()
    user = users.get(email)

    if not user or not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid email or password.")

    if user["role"] != requested_role:
        raise ValueError("This account is not registered for that role.")

    return {"email": email, "role": user["role"]}


# Role-based access control
def require_role(required_role: str):
    def dependency(authorization: str = Header(None)):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Missing or invalid Authorization header.",
            )

        token = authorization.split(" ", 1)[1]

        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Session expired, please log in again.",
            )
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token.")

        if payload.get("role") != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires the {required_role} role.",
            )

        return payload

    return dependency


# Authentication for any logged-in user
def require_login(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header.",
        )

    token = authorization.split(" ", 1)[1]

    try:
        return decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Session expired, please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


# Optional authentication for guest or logged-in users
def get_optional_user(authorization: str = Header(None)) -> dict | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1]

    try:
        return decode_token(token)
    except jwt.PyJWTError:
        return None

    
