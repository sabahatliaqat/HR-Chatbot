
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from auth import signup_employee, login, create_token


router = APIRouter(tags=["Auth"])


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    role: str

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        normalized = value.strip().lower()

        role_mapping = {
            "employee": "employee",
            "hr": "hr",
            "hr admin": "hr",
        }

        if normalized not in role_mapping:
            raise ValueError("Role must be Employee or HR Admin.")

        return role_mapping[normalized]


@router.post("/auth/signup")
async def signup(request: SignupRequest):
    try:
        user = signup_employee(
            request.email,
            request.password,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except RuntimeError:
        raise HTTPException(
            status_code=500,
            detail="Account registration could not be completed.",
        )

    token = create_token(user["email"], user["role"])

    return {
        "success": True,
        "token": token,
        "email": user["email"],
        "role": user["role"],
    }


@router.post("/auth/login")
async def login_route(request: LoginRequest):
    try:
        user = login(
            request.email,
            request.password,
            request.role,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc),
        )

    except RuntimeError:
        raise HTTPException(
            status_code=500,
            detail="Login could not be completed.",
        )

    token = create_token(user["email"], user["role"])

    return {
        "success": True,
        "token": token,
        "email": user["email"],
        "role": user["role"],
    }
