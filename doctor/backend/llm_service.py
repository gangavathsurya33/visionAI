# ============================================================
# MEDNEXUS AI DOCTOR - LLM SERVICE
# ============================================================

import os
import re
from typing import Any

from dotenv import load_dotenv
from groq import Groq


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is missing. "
        "Add GROQ_API_KEY to backend/.env"
    )


# ============================================================
# GROQ CLIENT
# ============================================================

groq_client = Groq(
    api_key=GROQ_API_KEY
)


# ============================================================
# MODEL
# ============================================================

DOCTOR_MODEL = "openai/gpt-oss-120b"


# ============================================================
# LIMITS
# ============================================================

MAX_HISTORY_MESSAGES = 20
MAX_MESSAGE_LENGTH = 10000
MAX_COMPLETION_TOKENS = 900


# ============================================================
# RESPONSE CLEANER
# ============================================================

def clean_doctor_response(
    text: str,
) -> str:

    if not text:
        return ""

    text = str(text).strip()

    # --------------------------------------------------------
    # COMPLETE REASONING BLOCKS
    # --------------------------------------------------------

    text = re.sub(
        r"<think\b[^>]*>.*?</think\s*>",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    text = re.sub(
        r"<thinking\b[^>]*>.*?</thinking\s*>",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    text = re.sub(
        r"<reasoning\b[^>]*>.*?</reasoning\s*>",
        "",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    # --------------------------------------------------------
    # TRUNCATED REASONING
    # --------------------------------------------------------

    lower = text.lower()

    positions = [
        position
        for position in (
            lower.find("<think"),
            lower.find("<thinking"),
            lower.find("<reasoning"),
        )
        if position >= 0
    ]

    if positions:

        first_position = min(positions)

        closing_positions = [
            position
            for position in (
                lower.find("</think>", first_position),
                lower.find("</thinking>", first_position),
                lower.find("</reasoning>", first_position),
            )
            if position >= 0
        ]

        if not closing_positions:
            text = text[:first_position]

    # --------------------------------------------------------
    # REMOVE STRAY TAGS
    # --------------------------------------------------------

    text = re.sub(
        r"</?(?:think|thinking|reasoning)\b[^>]*>",
        "",
        text,
        flags=re.IGNORECASE,
    )

    # --------------------------------------------------------
    # CLEAN
    # --------------------------------------------------------

    text = re.sub(
        r"\n[ \t]*\n[ \t]*\n+",
        "\n\n",
        text,
    )

    return text.strip()


# ============================================================
# NORMALIZE HISTORY
# ============================================================

def _normalize_history(
    history: list | None,
) -> list[dict[str, str]]:

    if not isinstance(history, list):
        return []

    result: list[dict[str, str]] = []

    for item in history[-MAX_HISTORY_MESSAGES:]:

        if not isinstance(item, dict):
            continue

        role = str(
            item.get("role") or ""
        ).strip().lower()

        # Frontend uses "doctor".
        # Groq requires "assistant".
        if role in {
            "doctor",
            "ai",
            "model",
        }:
            role = "assistant"

        if role not in {
            "user",
            "assistant",
        }:
            continue

        content = (
            item.get("text")
            or item.get("content")
            or ""
        )

        content = str(
            content
        ).strip()

        if not content:
            continue

        result.append(
            {
                "role": role,
                "content": content[
                    :MAX_MESSAGE_LENGTH
                ],
            }
        )

    return result


# ============================================================
# BUILD DOCTOR SYSTEM PROMPT
# ============================================================

def _build_doctor_system_prompt(
    age: Any,
    weight: Any,
    pathway: str | None,
    condition: str | None,
    severity: str | None,
    symptoms: str | None,
) -> str:

    pathway = (
        str(pathway or "unknown")
        .strip()
        .lower()
    )

    if pathway == "known":

        patient_context = f"""
The patient has selected a known medical condition.

Condition:
{condition or "Not provided"}

Patient-selected severity:
{severity or "Not provided"}
""".strip()

    else:

        patient_context = f"""
The patient has selected an unknown/active-symptom pathway.

Reported symptoms:
{symptoms or "Not provided"}
""".strip()

    return f"""
You are MEDNEXUS AI Doctor, a medical-information and triage
assistant conducting a conversational health assessment.

You are NOT a human doctor.

Your job is to have a natural back-and-forth conversation with
the patient, understand what they are experiencing, evaluate
the information they provide, and ask the next most useful
clinical follow-up question.

PATIENT INFORMATION:

Age:
{age if age is not None else "Not provided"}

Weight:
{weight if weight is not None else "Not provided"}

ASSESSMENT PATHWAY:

{patient_context}

CONVERSATION BEHAVIOR:

1. Respond directly to the patient's latest message.
2. Remember information already provided earlier in the conversation.
3. Do not repeatedly ask questions that the patient already answered.
4. Ask only the most useful next question when more information is needed.
5. If enough information is available, summarize what it may indicate
   and explain the appropriate next step.
6. Distinguish possible explanations from confirmed diagnoses.
7. Never claim certainty about a diagnosis.
8. Never claim that you physically examined the patient.
9. Never prescribe medication.
10. Never create personalized prescription dosages.
11. Never tell the patient to start, stop, increase, or decrease
    prescription medication.
12. Mention important warning signs when relevant.
13. If symptoms could represent an emergency, clearly recommend
    urgent professional medical evaluation.
14. Do not invent symptoms, test results, diagnoses, medicines,
    or medical history.
15. Do not expose internal reasoning.
16. Never output <think>, <thinking>, or <reasoning>.
17. Never describe your hidden reasoning.
18. Speak naturally and professionally.

CONVERSATION STYLE:

- Empathetic
- Calm
- Professional
- Clear
- Conversational
- Similar to a high-quality ChatGPT medical conversation
- Avoid robotic language
- Avoid unnecessary headings
- Do not repeat the entire patient history every turn
- Usually keep the response between 2 and 6 short sentences

IMPORTANT:

The user's latest message is the primary thing you must answer.

If you need more information, ask a focused follow-up question.

If you can already provide useful guidance, provide it instead of
asking unnecessary questions.

Return ONLY the patient-facing response.
""".strip()


# ============================================================
# COMMON GROQ GENERATION
# ============================================================

def _generate_doctor_response(
    messages: list[dict[str, str]],
) -> str:

    try:

        response = groq_client.chat.completions.create(
            model=DOCTOR_MODEL,
            messages=messages,
            temperature=0.3,
            max_completion_tokens=MAX_COMPLETION_TOKENS,
            stream=False,
            reasoning_format="hidden",
        )

    except Exception as exc:

        print(
            "DOCTOR GROQ ERROR:",
            repr(exc),
        )

        raise RuntimeError(
            "Unable to generate doctor response."
        ) from exc

    if not response:

        raise RuntimeError(
            "Groq returned no response."
        )

    if not getattr(
        response,
        "choices",
        None,
    ):

        raise RuntimeError(
            "Groq returned no choices."
        )

    message = response.choices[0].message

    content = getattr(
        message,
        "content",
        None,
    )

    if not content:

        raise RuntimeError(
            "Groq returned an empty response."
        )

    answer = clean_doctor_response(
        str(content)
    )

    if not answer:

        raise RuntimeError(
            "Groq returned an empty patient-facing response."
        )

    return answer


# ============================================================
# DOCTOR CONSULTATION
# ============================================================

def generate_doctor_consultation(
    age: Any,
    weight: Any,
    pathway: str | None,
    condition: str | None,
    severity: str | None,
    symptoms: str | None,
    history: list | None,
    new_message: str,
) -> str:

    new_message = str(
        new_message or ""
    ).strip()

    if not new_message:

        raise ValueError(
            "Patient message cannot be empty."
        )

    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": _build_doctor_system_prompt(
                age=age,
                weight=weight,
                pathway=pathway,
                condition=condition,
                severity=severity,
                symptoms=symptoms,
            ),
        }
    ]

    normalized_history = _normalize_history(
        history
    )

    # --------------------------------------------------------
    # ADD EXISTING CONVERSATION
    # --------------------------------------------------------

    for item in normalized_history:

        messages.append(
            item
        )

    # --------------------------------------------------------
    # ENSURE CURRENT MESSAGE IS PRESENT
    # --------------------------------------------------------

    current_already_present = False

    if normalized_history:

        last_message = normalized_history[-1]

        if (
            last_message["role"] == "user"
            and last_message["content"].strip()
            == new_message
        ):

            current_already_present = True

    if not current_already_present:

        messages.append(
            {
                "role": "user",
                "content": new_message[
                    :MAX_MESSAGE_LENGTH
                ],
            }
        )

    # --------------------------------------------------------
    # GENERATE
    # --------------------------------------------------------

    return _generate_doctor_response(
        messages
    )


# ============================================================
# NORMAL DOCTOR CHAT
# ============================================================

def generate_doctor_chat(
    history: list | None,
    message: str,
    age: Any = None,
    weight: Any = None,
    pathway: str | None = None,
    condition: str | None = None,
    severity: str | None = None,
    symptoms: str | None = None,
) -> str:

    message = str(
        message or ""
    ).strip()

    if not message:

        raise ValueError(
            "Doctor message cannot be empty."
        )

    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": _build_doctor_system_prompt(
                age=age,
                weight=weight,
                pathway=pathway,
                condition=condition,
                severity=severity,
                symptoms=symptoms,
            ),
        }
    ]

    normalized_history = _normalize_history(
        history
    )

    for item in normalized_history:

        messages.append(
            item
        )

    current_already_present = False

    if normalized_history:

        last_message = normalized_history[-1]

        if (
            last_message["role"] == "user"
            and last_message["content"].strip()
            == message
        ):

            current_already_present = True

    if not current_already_present:

        messages.append(
            {
                "role": "user",
                "content": message[
                    :MAX_MESSAGE_LENGTH
                ],
            }
        )

    return _generate_doctor_response(
        messages
    )