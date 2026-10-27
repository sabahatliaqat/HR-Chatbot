from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import signup_employee, login, create_token

router = APIRouter(tags=["Auth"])


class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str
    role: str  # "employee" or "hr"


@router.post("/auth/signup")
async def signup(request: SignupRequest):
    try:
        user = signup_employee(request.email, request.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
        user = login(request.email, request.password, request.role)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    token = create_token(user["email"], user["role"])
    return {
        "success": True,
        "token": token,
        "email": user["email"],
        "role": user["role"],
    }