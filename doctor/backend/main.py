
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import mysql.connector
import requests
from urllib.parse import unquote, urlparse
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# ============================================================
# LOAD MAIN PROJECT ENVIRONMENT
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    )
)

MAIN_BACKEND_ENV = os.path.join(
    BASE_DIR,
    "backend",
    ".env"
)

load_dotenv(MAIN_BACKEND_ENV)

from llm_service import (
    generate_doctor_consultation,
    generate_doctor_chat,
)

app = FastAPI(title="MedNexus API")


# ============================================================
# DATABASE CONNECTION
# ============================================================

# ============================================================
# DATABASE CONNECTION
# ============================================================

def db():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is missing from D:\\visionAI\\backend\\.env"
        )

    parsed = urlparse(database_url)

    username = unquote(parsed.username or "")
    password = unquote(parsed.password or "")

    # Remove SQLAlchemy driver prefix if present.
    # Examples:
    # mysql+asyncmy://
    # mysql+aiomysql://
    # mysql://
    host = parsed.hostname
    port = parsed.port or 3306

    database = (parsed.path or "/").lstrip("/")

    if not host:
        raise RuntimeError(
            "Invalid DATABASE_URL: database host is missing."
        )

    if not database:
        raise RuntimeError(
            "Invalid DATABASE_URL: database name is missing."
        )

    # Reuse the Aiven CA certificate from the main backend.
    ca_file = os.path.join(
        BASE_DIR,
        "backend",
        "ca.pem"
    )

    connection_args = {
        "host": host,
        "port": port,
        "user": username,
        "password": password,
        "database": database,
    }

    # Aiven MySQL uses TLS.
    if os.path.exists(ca_file):
        connection_args["ssl_ca"] = ca_file
        connection_args["ssl_verify_cert"] = True
        connection_args["ssl_verify_identity"] = True

    return mysql.connector.connect(
        **connection_args
    )


# ============================================================
# DATABASE SCHEMA
# ============================================================

def ensure_schema(connection):
    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS mednexus_conversations (
            id VARCHAR(191) PRIMARY KEY,
            client_id VARCHAR(191) NOT NULL,
            patient_age INT NOT NULL,
            body_weight DECIMAL(8,2) NOT NULL,
            assessment_mode VARCHAR(80) NOT NULL,
            condition_or_symptoms TEXT NOT NULL,
            severity VARCHAR(40),
            messages JSON NOT NULL,
            started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mednexus_client_ended (client_id, ended_at)
        )
        """
    )

    connection.commit()
    cursor.close()


# ============================================================
# CLIENT OWNER
# ============================================================

def owner(value):
    return value or "preview-client"

def normalize_messages(value):
    """
    Make sure the messages field is always returned
    as a JavaScript-compatible array.
    """

    if value is None:
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)

            if isinstance(parsed, list):
                return parsed

            return []

        except json.JSONDecodeError:
            return []

    return []


# ============================================================
# REQUEST MODELS
# ============================================================

class Conversation(BaseModel):
    id: str | None = None
    patientAge: int
    bodyWeight: float
    assessmentMode: str
    conditionOrSymptoms: str
    severity: str | None = None
    messages: list[dict[str, Any]]


class Consultation(BaseModel):
    intake: dict[str, Any] = {}
    history: list[dict[str, Any]] = []
    newMessage: str


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mednexus-doctor"
    }


# ============================================================
# HISTORY
# ============================================================

@app.get("/history")
def history(
    x_mednexus_client: str | None = Header(default=None)
):
    connection = db()
    ensure_schema(connection)

    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT *
        FROM mednexus_conversations
        WHERE client_id = %s
        ORDER BY ended_at DESC
        """,
        (owner(x_mednexus_client),)
    )

    rows = cursor.fetchall()

    for row in rows:
        row["messages"] = normalize_messages(row.get("messages"))

    cursor.close()
    connection.close()
    return rows


# ============================================================
# SAVE HISTORY
# ============================================================

@app.post("/history")
def save_history(
    item: Conversation,
    x_mednexus_client: str | None = Header(default=None)
):
    connection = db()
    ensure_schema(connection)

    cursor = connection.cursor()

    conversation_id = item.id or str(uuid.uuid4())

    cursor.execute(
        """
        INSERT INTO mednexus_conversations
        (
            id,
            client_id,
            patient_age,
            body_weight,
            assessment_mode,
            condition_or_symptoms,
            severity,
            messages
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            conversation_id,
            owner(x_mednexus_client),
            item.patientAge,
            item.bodyWeight,
            item.assessmentMode,
            item.conditionOrSymptoms,
            item.severity,
            json.dumps(item.messages),
        )
    )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "ok": True,
        "id": conversation_id
    }


# ============================================================
# DELETE HISTORY
# ============================================================

@app.delete("/history")
def delete_history(
    x_mednexus_client: str | None = Header(default=None)
):
    connection = db()
    ensure_schema(connection)

    cursor = connection.cursor()

    cursor.execute(
        """
        DELETE FROM mednexus_conversations
        WHERE client_id = %s
        """,
        (owner(x_mednexus_client),)
    )

    connection.commit()

    cursor.close()
    connection.close()

    return {
        "ok": True
    }


# ============================================================
# AI DOCTOR CONSULTATION
# ============================================================

@app.post("/consultation")
def consultation(payload: Consultation):

    if not payload.newMessage.strip():
        raise HTTPException(
            status_code=400,
            detail="Patient message cannot be empty."
        )

    intake = payload.intake

    # --------------------------------------------------------
    # Patient information
    # --------------------------------------------------------

    age = intake.get("age")
    weight = intake.get("weight")

    pathway = intake.get(
        "pathway",
        "unknown"
    )

    condition = intake.get(
        "condition"
    )

    severity = intake.get(
        "severity"
    )

    symptoms = intake.get(
        "symptoms"
    )

    # --------------------------------------------------------
    # Use the shared Doctor LLM service
    # --------------------------------------------------------

    try:

        reply = generate_doctor_consultation(
            age=age,
            weight=weight,
            pathway=pathway,
            condition=condition,
            severity=severity,
            symptoms=symptoms,
            history=payload.history,
            new_message=payload.newMessage,
        )

    except Exception as exc:

        print(
            "Doctor consultation LLM error:",
            repr(exc)
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "The AI Doctor service is temporarily "
                "unavailable. Please try again."
            )
        )

    # --------------------------------------------------------
    # IMPORTANT:
    # Frontend expects "reply"
    # --------------------------------------------------------

    return {
        "success": True,
        "reply": reply,
    }


# ============================================================
# AI DOCTOR CHAT
# ============================================================
#
# This endpoint is for normal text conversation with
# AI Doctor. It uses the same llm_service.py but a different
# prompt/function from the voice consultation.
# ============================================================

class DoctorChat(BaseModel):
    intake: dict[str, Any] = {}
    history: list[dict[str, Any]] = []
    message: str


@app.post("/chat")
def chat_with_doctor(payload: DoctorChat):

    if not payload.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    intake = payload.intake

    age = intake.get("age")
    weight = intake.get("weight")

    pathway = intake.get(
        "pathway",
        "unknown"
    )

    condition = intake.get(
        "condition"
    )

    severity = intake.get(
        "severity"
    )

    symptoms = intake.get(
        "symptoms"
    )

    try:

        reply = generate_doctor_chat(
            history=payload.history,
            message=payload.message,
            age=age,
            weight=weight,
            pathway=pathway,
            condition=condition,
            severity=severity,
            symptoms=symptoms,
        )

    except Exception as exc:

        print(
            "AI Doctor chat LLM error:",
            repr(exc)
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "The AI Doctor chat service is temporarily "
                "unavailable. Please try again."
            )
        )

    return {
        "success": True,
        "reply": reply,
    }

