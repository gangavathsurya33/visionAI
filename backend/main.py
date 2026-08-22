import base64
import io
import json
import os
import uuid
from datetime import datetime, timedelta

from typing import Any

from starlette.middleware.sessions import SessionMiddleware
import pymupdf
from dotenv import load_dotenv

from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)

from fastapi.responses import RedirectResponse
from oauth import oauth
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from jose import JWTError, jwt
from passlib.context import CryptContext
from PIL import Image
from pydantic import BaseModel, EmailStr, Field
from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database import get_db, init_db

from models import (
    User,
    DocumentChatSession,
    DocumentChatMessage,
)

from llm_service import (
    analyze_medical_document,
    web_medical_search,
    generate_medical_chat,
    generate_chat_title,
)


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# CONFIGURATION
# ============================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "change-this-secret-in-production",
)

JWT_ALGORITHM = "HS256"

JWT_EXPIRE_MINUTES = 60 * 24


# ============================================================
# APPLICATION URLS
# ============================================================

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:3000",
)

BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "http://localhost:8000",
)


# ============================================================
# ENVIRONMENT
# ============================================================

ENVIRONMENT = os.getenv(
    "ENVIRONMENT",
    "development",
)

IS_PRODUCTION = (
    ENVIRONMENT == "production"
)


# ============================================================
# CORS
# ============================================================

FRONTEND_URLS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",

    "http://localhost:3001",
    "http://127.0.0.1:3001",

    "http://localhost:5173",
    "http://127.0.0.1:5173",

    FRONTEND_URL,
]


# ============================================================
# MODELS
# ============================================================

TEXT_MODEL = "qwen/qwen3.6-27b"


# ============================================================
# FILE SETTINGS
# ============================================================

MAX_UPLOAD_SIZE = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".txt",
    ".csv",
}

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


# ============================================================
# GROQ
# ============================================================

if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is missing in backend/.env"
    )


groq_client = Groq(
    api_key=GROQ_API_KEY
)


# ============================================================
# PASSWORD
# ============================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="MEDNEXUS AI",
    version="1.0.0",
    description="MEDNEXUS AI medical assistant backend",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="mednexus_oauth_session",
    max_age=600,
    same_site="lax",
    https_only=IS_PRODUCTION,
)


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():
    init_db()


# ============================================================
# PYDANTIC MODELS
# ============================================================

class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255,
    )

    email: EmailStr

    password: str = Field(
        min_length=6,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RenameRequest(BaseModel):
    session_name: str = Field(
        min_length=1,
        max_length=255,
    )


# ============================================================
# AUTH HELPERS
# ============================================================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    password_hash: str,
) -> bool:

    return pwd_context.verify(
        plain_password,
        password_hash,
    )


def create_access_token(
    user_id: int,
) -> str:

    expires = (
        datetime.utcnow()
        + timedelta(
            minutes=JWT_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": str(user_id),
        "exp": expires,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


# ============================================================
# GOOGLE OAUTH
# ============================================================

@app.get("/api/auth/google/login")
async def google_login(
    request: Request,
):
    redirect_uri = (
        f"{BACKEND_URL}"
        "/api/auth/google/callback"
    )

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
    )


@app.get("/api/auth/google/callback")
async def google_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    token = await oauth.google.authorize_access_token(
        request
    )

    user_info = token.get("userinfo")

    if not user_info:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to retrieve Google "
                "user information."
            ),
        )

    google_id = str(
        user_info["sub"]
    )

    email = (
        user_info["email"]
        .lower()
        .strip()
    )

    name = (
        user_info.get("name")
        or email.split("@")[0]
    )

    result = db.execute(
        select(User).where(
            User.oauth_provider == "google",
            User.oauth_provider_id == google_id,
        )
    )

    user = result.scalar_one_or_none()

    if not user:

        result = db.execute(
            select(User).where(
                User.email == email
            )
        )

        existing_user = (
            result.scalar_one_or_none()
        )

        if existing_user:

            existing_user.oauth_provider = "google"
            existing_user.oauth_provider_id = google_id

            db.commit()
            db.refresh(existing_user)

            user = existing_user

        else:

            user = User(
                name=name,
                email=email,
                password_hash=None,
                oauth_provider="google",
                oauth_provider_id=google_id,
            )

            db.add(user)

            db.commit()
            db.refresh(user)

    access_token = create_access_token(
        user.id
    )

    redirect = RedirectResponse(
        url=(
            f"{FRONTEND_URL}"
            "/oauth-success"
        )
    )

    redirect.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=JWT_EXPIRE_MINUTES * 60,
        path="/",
    )

    return redirect


# ============================================================
# CURRENT USER
# ============================================================

async def get_current_user(
    access_token: str | None = Cookie(
        default=None
    ),
    db: Session = Depends(get_db),
) -> User:

    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    try:

        payload = jwt.decode(
            access_token,
            SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token.",
            )

        user_id = int(user_id)

    except (
        JWTError,
        ValueError,
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
        )

    result = db.execute(
        select(User).where(
            User.id == user_id
        )
    )

    user = result.scalar_one_or_none()

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User no longer exists.",
        )

    return user


# ============================================================
# AUTHENTICATION
# ============================================================

@app.post("/api/auth/register")
async def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):

    name = payload.name.strip()
    email = payload.email.lower().strip()

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Name is required.",
        )

    result = db.execute(
        select(User).where(
            User.email == email
        )
    )

    existing_user = (
        result.scalar_one_or_none()
    )

    if existing_user:

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(
            payload.password
        ),
    )

    db.add(user)

    db.commit()
    db.refresh(user)

    token = create_access_token(
        user.id
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=JWT_EXPIRE_MINUTES * 60,
        path="/",
    )

    return {
        "success": True,
        "message": "Account created successfully.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }


# ============================================================
# GITHUB OAUTH
# ============================================================

@app.get("/api/auth/github/login")
async def github_login(
    request: Request,
):
    redirect_uri = (
        f"{BACKEND_URL}"
        "/api/auth/github/callback"
    )

    return await oauth.github.authorize_redirect(
        request,
        redirect_uri,
    )


@app.get("/api/auth/github/callback")
async def github_callback(
    request: Request,
    db: Session = Depends(get_db),
):
    token = await oauth.github.authorize_access_token(
        request
    )

    user_response = await oauth.github.get(
        "user",
        token=token,
    )

    github_user = user_response.json()

    github_id = str(
        github_user["id"]
    )

    name = (
        github_user.get("name")
        or github_user.get("login")
        or "GitHub User"
    )

    email_response = await oauth.github.get(
        "user/emails",
        token=token,
    )

    emails = email_response.json()

    email = None

    for item in emails:
        if (
            item.get("primary")
            and item.get("verified")
        ):
            email = item.get("email")
            break

    if not email:
        raise HTTPException(
            status_code=400,
            detail=(
                "GitHub did not provide a "
                "verified email address."
            ),
        )

    email = email.lower().strip()

    result = db.execute(
        select(User).where(
            User.oauth_provider == "github",
            User.oauth_provider_id == github_id,
        )
    )

    user = result.scalar_one_or_none()

    if not user:

        result = db.execute(
            select(User).where(
                User.email == email
            )
        )

        existing_user = (
            result.scalar_one_or_none()
        )

        if existing_user:

            existing_user.oauth_provider = "github"
            existing_user.oauth_provider_id = github_id

            db.commit()
            db.refresh(existing_user)

            user = existing_user

        else:

            user = User(
                name=name,
                email=email,
                password_hash=None,
                oauth_provider="github",
                oauth_provider_id=github_id,
            )

            db.add(user)

            db.commit()
            db.refresh(user)

    access_token = create_access_token(
        user.id
    )

    redirect = RedirectResponse(
        url=(
            f"{FRONTEND_URL}"
            "/oauth-success"
        )
    )

    redirect.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=JWT_EXPIRE_MINUTES * 60,
        path="/",
    )

    return redirect


# ============================================================
# LOGIN
# ============================================================

@app.post("/api/auth/login")
async def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):

    email = payload.email.lower().strip()

    result = db.execute(
        select(User).where(
            User.email == email
        )
    )

    user = result.scalar_one_or_none()

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not user.password_hash:

        raise HTTPException(
            status_code=401,
            detail="This account uses social login.",
        )

    if not verify_password(
        payload.password,
        user.password_hash,
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    token = create_access_token(
        user.id
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=JWT_EXPIRE_MINUTES * 60,
        path="/",
    )

    return {
        "success": True,
        "message": "Login successful.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }


# ============================================================
# LOGOUT
# ============================================================

@app.post("/api/auth/logout")
async def logout(
    response: Response,
):

    response.delete_cookie(
        key="access_token",
        path="/",
    )

    return {
        "success": True,
        "message": "Logged out successfully.",
    }


# ============================================================
# CURRENT USER API
# ============================================================

@app.get("/api/auth/me")
async def current_user(
    user: User = Depends(
        get_current_user
    ),
):

    return {
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        },
    }


# ============================================================
# FILE HELPERS
# ============================================================

def get_extension(
    filename: str,
) -> str:

    filename = filename.lower().strip()

    if "." not in filename:
        return ""

    return "." + filename.rsplit(
        ".",
        1
    )[1]


def validate_file(
    filename: str,
    content_type: str,
):

    extension = get_extension(
        filename
    )

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Upload PDF, JPG, JPEG, PNG, WEBP, TXT, or CSV."
            ),
        )

    return extension


def image_to_data_url(
    image: Image.Image,
) -> str:

    image = image.convert("RGB")

    buffer = io.BytesIO()

    image.save(
        buffer,
        format="JPEG",
        quality=85,
    )

    encoded = base64.b64encode(
        buffer.getvalue()
    ).decode("utf-8")

    return (
        "data:image/jpeg;base64,"
        + encoded
    )


def pdf_to_images(
    data: bytes,
    max_pages: int = 5,
) -> list[str]:

    try:

        document = pymupdf.open(
            stream=data,
            filetype="pdf",
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=f"Unable to read PDF: {str(exc)}",
        )

    images = []

    try:

        page_count = min(
            document.page_count,
            max_pages,
        )

        for index in range(
            page_count
        ):

            page = document.load_page(
                index
            )

            pixmap = page.get_pixmap(
                matrix=pymupdf.Matrix(
                    1.5,
                    1.5,
                ),
                alpha=False,
            )

            image = Image.frombytes(
                "RGB",
                (
                    pixmap.width,
                    pixmap.height,
                ),
                pixmap.samples,
            )

            images.append(
                image_to_data_url(
                    image
                )
            )

    finally:

        document.close()

    return images


def extract_pdf_text(
    data: bytes,
) -> str:

    try:

        reader = PdfReader(
            io.BytesIO(data)
        )

        pages = []

        for page in reader.pages:

            text = page.extract_text()

            if text:
                pages.append(
                    text.strip()
                )

        return "\n\n".join(
            pages
        ).strip()

    except Exception as exc:

        print(
            "PDF TEXT EXTRACTION ERROR:",
            repr(exc),
        )

        return ""


# ============================================================
# TEXT DOCUMENT ANALYSIS
# ============================================================

def analyze_text_document(
    document_text: str,
    user_message: str,
) -> str:

    prompt = f"""
You are MEDNEXUS AI Document Assistant.

You are analyzing a medical document that has been
converted into text.

USER REQUEST:
{user_message}

DOCUMENT CONTENT:
----------------
{document_text[:50000]}
----------------

Analyze the document carefully.

Important rules:

1. Only use information actually present in the document.
2. Never invent medicine names.
3. Never invent dosage.
4. Never invent laboratory values.
5. Never invent diagnoses.
6. If something is unclear, say it is unclear.
7. Explain medical terminology in simple language.
8. Do not tell the patient to start, stop,
   increase or decrease prescription medication.
9. Do not claim that you physically examined the patient.
10. This is medical information, not a diagnosis.

Use this structure:

## Document Summary

## What I Can Read

## Medicines / Findings

## What It May Mean

## Important Points

## What Is Unclear

## Answer to Your Question

If the document contains abnormal values,
mention them exactly as written and explain
what they generally mean without diagnosing.
"""

    response = groq_client.chat.completions.create(
        model=TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": """
You are a careful medical document analysis assistant.
Accuracy is more important than guessing.
""",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
        max_completion_tokens=1600,
    )

    if not response.choices:

        raise RuntimeError(
            "Document AI returned no response."
        )

    answer = (
        response
        .choices[0]
        .message
        .content
    )

    if not answer:

        raise RuntimeError(
            "Document AI returned an empty response."
        )

    return answer.strip()


# ============================================================
# GENERAL CHAT ANSWER
# ============================================================

def generate_general_answer(
    history: list,
    message: str,
) -> str:

    try:

        return generate_medical_chat(
            history=history,
            message=message,
        )

    except Exception as exc:

        print(
            "GENERAL AI ERROR:",
            repr(exc),
        )

        raise RuntimeError(
            "Unable to generate medical response."
        )


# ============================================================
# DOCUMENT ASSISTANT
# ============================================================

@app.post("/api/document-assistant")
async def document_assistant(
    message: str = Form(""),
    mode: str = Form("AI Analysis"),
    history: str = Form("[]"),
    session_id: str | None = Form(None),
    file: UploadFile | None = File(None),

    user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    # ========================================================
    # PARSE HISTORY
    # ========================================================

    try:

        parsed_history = json.loads(
            history
        )

        if not isinstance(
            parsed_history,
            list,
        ):
            parsed_history = []

    except Exception:

        parsed_history = []

    clean_message = (
        message.strip()
    )

    # ========================================================
    # VALIDATE INPUT
    # ========================================================

    if (
        not clean_message
        and file is None
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Enter a question or upload "
                "a medical document."
            ),
        )

    # ========================================================
    # GET / CREATE SESSION
    # ========================================================

    session = None

    if session_id:

        result = db.execute(
            select(
                DocumentChatSession
            ).where(
                DocumentChatSession.id
                == session_id,
                DocumentChatSession.user_id
                == user.id,
            )
        )

        session = (
            result.scalar_one_or_none()
        )

        if not session:

            raise HTTPException(
                status_code=404,
                detail="Document chat not found.",
            )

    else:

        new_session_id = str(
            uuid.uuid4()
        )

        session = DocumentChatSession(
            id=new_session_id,
            user_id=user.id,
            session_name="New Chat",
        )

        db.add(session)

        db.flush()

    # ========================================================
    # READ FILE
    # ========================================================

    document_text = None
    document_images = []
    filename = None

    if file:

        filename = (
            file.filename
            or "uploaded_file"
        )

        content_type = (
            file.content_type
            or ""
        ).lower()

        extension = validate_file(
            filename,
            content_type,
        )

        file_bytes = await file.read()

        if not file_bytes:

            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty.",
            )

        if len(file_bytes) > MAX_UPLOAD_SIZE:

            raise HTTPException(
                status_code=413,
                detail=(
                    "File must be 20 MB or smaller."
                ),
            )

        # ====================================================
        # PDF
        # ====================================================

        if (
            extension == ".pdf"
            or content_type
            == "application/pdf"
        ):

            document_text = (
                extract_pdf_text(
                    file_bytes
                )
            )

            if not document_text:

                document_images = (
                    pdf_to_images(
                        file_bytes,
                        max_pages=5,
                    )
                )

        # ====================================================
        # IMAGE
        # ====================================================

        elif extension in {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        }:

            encoded = base64.b64encode(
                file_bytes
            ).decode("utf-8")

            document_images = [
                (
                    f"data:{content_type};"
                    f"base64,{encoded}"
                )
            ]

        # ====================================================
        # TXT / CSV
        # ====================================================

        elif extension in {
            ".txt",
            ".csv",
        }:

            document_text = (
                file_bytes
                .decode(
                    "utf-8",
                    errors="ignore",
                )
                .strip()
            )

            if not document_text:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "The uploaded text file is empty."
                    ),
                )

    # ========================================================
    # DEFAULT MESSAGE FOR FILE
    # ========================================================

    final_message = clean_message

    if not final_message and file:

        final_message = f"""
Analyze this uploaded medical document.

File name:
{filename}

Please explain:

1. What type of document this appears to be.
2. The important information contained in it.
3. Medicines and their general purpose if visible.
4. Important laboratory values or findings.
5. Anything that may require professional follow-up.
6. Anything unclear or unreadable.

Do not invent information that is not visible.
"""

    # ========================================================
    # SAVE USER MESSAGE
    # ========================================================

    db.add(
        DocumentChatMessage(
            session_id=session.id,
            sender="user",
            message=final_message,
            file_name=filename,
        )
    )

    db.flush()

    # ========================================================
    # GENERATE AI ANSWER
    # ========================================================

    try:

        # ====================================================
        # WEB SEARCH
        # ====================================================

        if mode == "Web Search":

            document_context = None

            if document_images:

                document_context = (
                    analyze_medical_document(
                        images=document_images,
                        user_message=final_message,
                    )
                )

            elif document_text:

                document_context = (
                    analyze_text_document(
                        document_text=document_text,
                        user_message=final_message,
                    )
                )

            answer = web_medical_search(
                message=final_message,
                document_context=document_context,
            )

        # ====================================================
        # AI ANALYSIS
        # ====================================================

        else:

            if document_images:

                answer = analyze_medical_document(
                    images=document_images,
                    user_message=final_message,
                )

            elif document_text:

                answer = analyze_text_document(
                    document_text=document_text,
                    user_message=final_message,
                )

            else:

                answer = generate_general_answer(
                    history=parsed_history,
                    message=final_message,
                )

        if not answer:

            raise RuntimeError(
                "AI returned an empty response."
            )

        answer = answer.strip()

    except HTTPException:

        db.rollback()
        raise

    except Exception as exc:

        db.rollback()

        print(
            "DOCUMENT ASSISTANT ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "The AI Document Assistant "
                "is temporarily unavailable."
            ),
        )

    # ========================================================
    # SAVE AI MESSAGE
    # ========================================================

    db.add(
        DocumentChatMessage(
            session_id=session.id,
            sender="ai",
            message=answer,
            file_name=None,
        )
    )

    # ========================================================
    # AUTOMATIC TITLE
    # ========================================================

    current_name = (
        session.session_name
        or ""
    ).strip()

    if (
        not current_name
        or current_name == "New Chat"
    ):

        generated_title = generate_chat_title(
            user_message=clean_message,
            filename=filename,
        )

        if generated_title:

            session.session_name = (
                generated_title
            )

        print(
            "DOCUMENT CHAT TITLE:",
            session.session_name,
        )

    # ========================================================
    # UPDATE TIMESTAMP
    # ========================================================

    if hasattr(
        session,
        "updated_at",
    ):

        session.updated_at = (
            datetime.utcnow()
        )

    # ========================================================
    # COMMIT EVERYTHING
    # ========================================================

    db.commit()

    db.refresh(
        session
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "success": True,

        "session_id": session.id,

        "session_name": (
            session.session_name
            or "New Chat"
        ),

        "reply": answer,

        "filename": filename,

        "mode": mode,
    }


# ============================================================
# DOCUMENT HISTORY
# ============================================================

@app.get("/api/document/history")
async def document_history(
    user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    result = db.execute(
        select(
            DocumentChatSession
        )
        .where(
            DocumentChatSession.user_id
            == user.id
        )
        .order_by(
            DocumentChatSession.updated_at.desc()
        )
    )

    sessions = result.scalars().all()

    return {
        "success": True,

        "sessions": [
            {
                "id": item.id,

                "session_name": (
                    item.session_name
                    or "New Chat"
                ),

                "created_at": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),

                "updated_at": (
                    item.updated_at.isoformat()
                    if item.updated_at
                    else None
                ),
            }

            for item in sessions
        ],
    }


# ============================================================
# GET ONE DOCUMENT CHAT
# ============================================================

@app.get(
    "/api/document/history/{session_id}"
)
async def document_session(
    session_id: str,

    user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    result = db.execute(
        select(
            DocumentChatSession
        ).where(
            DocumentChatSession.id
            == session_id,

            DocumentChatSession.user_id
            == user.id,
        )
    )

    session = (
        result.scalar_one_or_none()
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Document chat not found.",
        )

    result = db.execute(
        select(
            DocumentChatMessage
        )
        .where(
            DocumentChatMessage.session_id
            == session_id
        )
        .order_by(
            DocumentChatMessage.created_at.asc()
        )
    )

    messages = result.scalars().all()

    return {
        "success": True,

        "session": {
            "id": session.id,

            "session_name": (
                session.session_name
                or "New Chat"
            ),
        },

        "messages": [
            {
                "id": item.id,

                "sender": item.sender,

                "message": item.message,

                "file_name": item.file_name,

                "created_at": (
                    item.created_at.isoformat()
                    if item.created_at
                    else None
                ),
            }

            for item in messages
        ],
    }


# ============================================================
# RENAME DOCUMENT CHAT
# ============================================================

@app.patch(
    "/api/document/history/{session_id}"
)
async def rename_document_session(
    session_id: str,

    payload: RenameRequest,

    user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    new_name = (
        payload.session_name
        .strip()
    )

    if not new_name:

        raise HTTPException(
            status_code=400,
            detail="Chat name cannot be empty.",
        )

    result = db.execute(
        select(
            DocumentChatSession
        ).where(
            DocumentChatSession.id
            == session_id,

            DocumentChatSession.user_id
            == user.id,
        )
    )

    session = (
        result.scalar_one_or_none()
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Document chat not found.",
        )

    session.session_name = (
        new_name
    )

    if hasattr(
        session,
        "updated_at",
    ):

        session.updated_at = (
            datetime.utcnow()
        )

    db.commit()

    return {
        "success": True,
        "message": "Document chat renamed.",
        "session_name": new_name,
    }


# ============================================================
# DELETE ONE CHAT
# ============================================================

@app.delete(
    "/api/document/history/{session_id}"
)
async def delete_document_session(
    session_id: str,

    user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    result = db.execute(
        select(
            DocumentChatSession
        ).where(
            DocumentChatSession.id
            == session_id,

            DocumentChatSession.user_id
            == user.id,
        )
    )

    session = (
        result.scalar_one_or_none()
    )

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Document chat not found.",
        )

    db.execute(
        delete(
            DocumentChatMessage
        ).where(
            DocumentChatMessage.session_id
            == session_id
        )
    )

    db.delete(
        session
    )

    db.commit()

    return {
        "success": True,
        "message": "Document chat deleted.",
    }


# ============================================================
# CLEAR ALL DOCUMENT HISTORY
# ============================================================

@app.delete(
    "/api/document/history"
)
async def clear_document_history(
    user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):

    result = db.execute(
        select(
            DocumentChatSession.id
        ).where(
            DocumentChatSession.user_id
            == user.id
        )
    )

    session_ids = [
        row[0]
        for row in result.all()
    ]

    if session_ids:

        db.execute(
            delete(
                DocumentChatMessage
            ).where(
                DocumentChatMessage.session_id.in_(
                    session_ids
                )
            )
        )

        db.execute(
            delete(
                DocumentChatSession
            ).where(
                DocumentChatSession.id.in_(
                    session_ids
                )
            )
        )

    db.commit()

    return {
        "success": True,
        "message": (
            "Document chat history cleared."
        ),
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
async def health():

    return {
        "success": True,
        "service": "MEDNEXUS AI",
        "status": "online",
        "document_assistant": "online",
    }


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )