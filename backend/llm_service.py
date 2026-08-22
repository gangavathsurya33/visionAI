# backend/llm_service.py

import base64
import os
from typing import Any

from dotenv import load_dotenv
from groq import Groq

import re


GENERAL_MODEL = "openai/gpt-oss-120b"

DOCUMENT_MODEL = "openai/gpt-oss-120b"

VISION_MODEL = "qwen/qwen3.6-27b"

WEB_MODEL = "groq/compound"

def clean_ai_response(text: str) -> str:
    """
    Remove model reasoning from user-facing output.

    Handles:
    - complete <think>...</think>
    - complete <thinking>...</thinking>
    - complete <reasoning>...</reasoning>
    - incomplete/truncated reasoning blocks
    - stray reasoning tags
    """

    if not text:
        return ""

    text = str(text).strip()

    # --------------------------------------------------------
    # REMOVE COMPLETE THINKING BLOCKS
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
    # HANDLE TRUNCATED THINKING
    # --------------------------------------------------------

    lower = text.lower()

    think_positions = [
        position
        for position in (
            lower.find("<think"),
            lower.find("<thinking"),
            lower.find("<reasoning"),
        )
        if position >= 0
    ]

    if think_positions:

        first_think = min(think_positions)

        # If a reasoning block starts but has no corresponding
        # closing tag, remove everything from that point onward.
        closing_positions = [
            position
            for position in (
                lower.find("</think>", first_think),
                lower.find("</thinking>", first_think),
                lower.find("</reasoning>", first_think),
            )
            if position >= 0
        ]

        if not closing_positions:
            text = text[:first_think]

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
    # REMOVE COMMON INTERNAL-REASONING PREFIXES
    # ONLY WHEN THEY ARE CLEARLY MODEL META-TEXT
    # --------------------------------------------------------

    text = re.sub(
        r"^\s*(?:Here'?s\s+my\s+thinking|"
        r"Let'?s\s+analyze|"
        r"Let'?s\s+look|"
        r"I\s+need\s+to\s+analyze).*?:\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )

    # --------------------------------------------------------
    # CLEAN EMPTY LINES
    # --------------------------------------------------------

    text = re.sub(
        r"\n[ \t]*\n[ \t]*\n+",
        "\n\n",
        text,
    )

    return text.strip()
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
# MODELS
# ============================================================

# Text model for normal medical conversations.
GENERAL_MODEL = "openai/gpt-oss-120b"

# Text model for extracted PDF/TXT/CSV documents.
DOCUMENT_MODEL = "openai/gpt-oss-120b"

# Vision model for images and scanned PDFs.
VISION_MODEL = "qwen/qwen3.6-27b"
# Compound provides Groq's built-in web search.
WEB_MODEL = "groq/compound"


# ============================================================
# LIMITS
# ============================================================

MAX_HISTORY_MESSAGES = 20

MAX_DOCUMENT_TEXT = 50000

MAX_OUTPUT_TOKENS = 1600


# ============================================================
# COMMON RESPONSE HELPER
# ============================================================

def _extract_response_text(response: Any) -> str:
    """
    Safely extract the user-facing response from Groq.
    """

    if not response:
        raise RuntimeError(
            "Groq returned no response object."
        )

    choices = getattr(
        response,
        "choices",
        None,
    )

    if not choices:
        raise RuntimeError(
            "Groq returned no choices."
        )

    message = choices[0].message

    content = getattr(
        message,
        "content",
        None,
    )

    reasoning = getattr(
        message,
        "reasoning",
        None,
    )

    # --------------------------------------------------------
    # NORMAL FINAL ANSWER
    # --------------------------------------------------------

    if content:

        cleaned = clean_ai_response(
            str(content)
        )

        if cleaned:
            return cleaned

    # --------------------------------------------------------
    # DEBUG INFORMATION
    # --------------------------------------------------------

    print(
        "GROQ RESPONSE DEBUG:",
        {
            "message_type": type(message).__name__,
            "content": repr(content),
            "reasoning_present": bool(reasoning),
            "finish_reason": getattr(
                choices[0],
                "finish_reason",
                None,
            ),
        },
    )

    raise RuntimeError(
        "Groq returned no user-facing answer."
    )

# ============================================================
# BASIC TEXT GENERATION
# ============================================================

def _generate(
    messages: list[dict[str, Any]],
    model: str = GENERAL_MODEL,
    max_tokens: int = 1200,
    temperature: float = 0.3,
) -> str:

    response = groq_client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_completion_tokens=max_tokens,
        stream=False,
        include_reasoning=False,
    )

    return _extract_response_text(response)

# ============================================================
# CHAT TITLE
# ============================================================

def fallback_title(
    text: str,
) -> str:
    """
    Generate a deterministic fallback title.
    """

    text = (
        str(text or "")
        .replace("\n", " ")
        .strip()
    )

    if not text:
        return "Medical Document Chat"

    words = text.split()

    title = " ".join(words[:7])

    if len(title) > 55:
        title = title[:55].rstrip()

    if not title:
        return "Medical Document Chat"

    return title[0].upper() + title[1:]


def generate_chat_title(
    user_message: str,
    filename: str | None = None,
) -> str:
    """
    Generate a clean, short title for the document-assistant sidebar.
    """

    base = str(user_message or "").strip()

    if not base and filename:
        base = f"Analyze {filename}"

    if not base:
        return "Medical Document Chat"

    try:
        response = groq_client.chat.completions.create(
            model=GENERAL_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """
You generate a short title for a medical document
assistant conversation.

STRICT RULES:
- Return ONLY the final title.
- Maximum 6 words.
- Do NOT provide reasoning.
- Do NOT provide analysis.
- Do NOT use <think>.
- Do NOT use <thinking>.
- Do NOT use <reasoning>.
- Do NOT use Markdown.
- Do NOT use quotation marks.
- Do NOT say "Chat".
- Do NOT say "AI".
- Do NOT invent medical information.
- Use only the user's message or uploaded filename.
- Make the title useful and specific.
""",
                },
                {
                    "role": "user",
                    "content": base[:2000],
                },
            ],
            temperature=0.2,
            max_completion_tokens=30,
            stream=False,
            reasoning_format="hidden",
        )

        raw_title = _extract_response_text(response)

        # Remove any hidden reasoning the model may still return.
        title = clean_ai_response(raw_title)

        # Extra protection against leaked reasoning.
        title = re.sub(
            r"<think\b[^>]*>.*?</think\s*>",
            "",
            title,
            flags=re.IGNORECASE | re.DOTALL,
        )

        title = re.sub(
            r"<thinking\b[^>]*>.*?</thinking\s*>",
            "",
            title,
            flags=re.IGNORECASE | re.DOTALL,
        )

        title = re.sub(
            r"<reasoning\b[^>]*>.*?</reasoning\s*>",
            "",
            title,
            flags=re.IGNORECASE | re.DOTALL,
        )

        # Remove accidental Markdown / quotes.
        title = (
            title
            .replace('"', "")
            .replace("'", "")
            .replace("**", "")
            .replace("#", "")
            .replace("\n", " ")
            .strip()
        )

        # Collapse repeated whitespace.
        title = re.sub(r"\s+", " ", title).strip()

        # Safety check:
        # If the model still returned obvious reasoning,
        # do not save it as the chat title.
        lower_title = title.lower()

        reasoning_markers = [
            "<think>",
            "<thinking>",
            "<reasoning>",
            "analyze user input",
            "analysis:",
            "reasoning:",
            "let's analyze",
            "here's a thinking process",
        ]

        if any(marker in lower_title for marker in reasoning_markers):
            raise ValueError(
                "Model returned reasoning instead of a clean title."
            )

        if title:
            # Maximum 6 words.
            words = title.split()

            if len(words) > 6:
                title = " ".join(words[:6])

            return title[:255]

    except Exception as exc:
        print(
            "TITLE GENERATION ERROR:",
            repr(exc),
        )

    # Deterministic fallback.
    return fallback_title(base)

# ============================================================
# TEXT DOCUMENT ANALYSIS
# ============================================================

def analyze_text_document(
    document_text: str,
    user_message: str,
) -> str:
    """
    Analyze text extracted from PDF/TXT/CSV.
    """

    document_text = str(
        document_text or ""
    ).strip()

    user_message = str(
        user_message or ""
    ).strip()

    if not document_text:
        raise ValueError(
            "No document text was supplied."
        )

    if not user_message:
        user_message = (
            "Analyze this medical document."
        )

    prompt = f"""
You are MEDNEXUS AI Document Assistant.

You are analyzing a medical document that
has been converted into text.

USER REQUEST:
{user_message}

DOCUMENT CONTENT:
----------------
{document_text[:MAX_DOCUMENT_TEXT]}
----------------

Analyze the document carefully.

IMPORTANT RULES:

1. Use only information actually present in the document.
2. Never invent medicine names.
3. Never invent dosage.
4. Never invent laboratory values.
5. Never invent diagnoses.
6. Never invent dates or patient information.
7. If something is unclear, say it is unclear.
8. Explain medical terminology in simple language.
9. Do not tell the patient to start, stop, increase,
   or decrease prescription medication.
10. Do not claim that you physically examined the patient.
11. This is medical information, not a diagnosis.
12. If the document contains abnormal values, quote or
    identify them accurately and explain their general
    significance without diagnosing.

Use this structure:

## Document Summary

Briefly explain what the document appears to contain.

## What I Can Read

List information clearly present in the document.

## Medicines / Findings

List visible medicines, laboratory findings,
diagnoses, measurements, or other important details.

## What It May Mean

Explain the information in simple language.

## Important Points

Mention important safety considerations.

## What Is Unclear

Clearly identify information that cannot be reliably read.

## Answer to Your Question

Directly answer the user's question.
"""

    return _generate(
        [
            {
                "role": "system",
                "content": """
You are a careful medical document analysis assistant.

Accuracy is more important than guessing.

Never fabricate information from a document.
""",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        model=DOCUMENT_MODEL,
        max_tokens=MAX_OUTPUT_TOKENS,
        temperature=0.2,
    )


# ============================================================
# IMAGE / SCANNED DOCUMENT ANALYSIS
# ============================================================

def analyze_medical_document(
    images: list[str],
    user_message: str = "",
) -> str:
    """
    Analyze uploaded medical document images.

    `images` must contain base64 data URLs such as:

        data:image/jpeg;base64,...

    Supports:
    - prescriptions
    - medicine strips
    - lab reports
    - medical reports
    - discharge summaries
    - scanned PDFs
    - healthcare documents
    """

    if not images:
        raise ValueError(
            "No document images were supplied."
        )

    question = (
        str(user_message or "").strip()
        or "Analyze this medical document thoroughly."
    )

    # Groq's Llama 4 Scout supports multimodal
    # image understanding. Keep the number of
    # images within the documented limit.
    images = list(images)[:3]

    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": f"""
You are MedNexus AI, a professional medical-information assistant.

You are analyzing an uploaded medical document such as:
- prescription
- medicine strip
- laboratory report
- medical report
- discharge summary
- scanned healthcare document

USER REQUEST:

{question}

YOUR TASK:

Answer the user's request directly using only information that can
actually be read from the uploaded image.

IMPORTANT BEHAVIOR:

1. Give ONLY the useful final answer to the user.
2. Never reveal internal reasoning.
3. Never output <think>, </think>, <thinking>, </thinking>,
   <reasoning>, or </reasoning>.
4. Never describe your internal image-analysis process.
5. Never say things such as:
   - "The user wants me to..."
   - "Let's analyze..."
   - "Let's re-examine..."
   - "Wait..."
   - "Maybe..."
   - "I will assume..."
6. Do not expose uncertainty-analysis or chain-of-thought.
7. If something cannot be read reliably, simply say:
   "This part is unclear in the uploaded document."
8. Never guess a medicine name, dosage, frequency, date,
   diagnosis, laboratory value, or patient information.
9. Never invent missing information.
10. If the user asks about medicines, list only medicines
    that can actually be read.
11. If the user asks about dosage, report it only if it is
    clearly visible.
12. If the user asks about a diagnosis, distinguish what is
    written on the document from general interpretation.
13. Do not prescribe medication.
14. Do not tell the user to start, stop, increase, or decrease
    prescription medication.
15. Do not claim to be the patient's doctor.
16. Do not claim that you physically examined the patient.
17. If something appears potentially urgent, clearly recommend
    appropriate professional medical evaluation.

RESPONSE STYLE:

- Professional
- Clear
- Direct
- Concise
- Natural
- Helpful
- Like a high-quality ChatGPT medical-information response

IMPORTANT:

Answer the actual USER REQUEST first.

Do not force unnecessary sections when the user asks a simple question.

Use Markdown when useful.

For headings, use Markdown such as:

## Prescription Summary

### Medicines

Use bullet points for lists.

Use **bold** for important information.

Do not include internal reasoning or analysis.
""",
        }
    ]

    for image in images:
        if not image:
            continue

        # Ensure the model receives a proper data URL.
        if not str(image).startswith(
            "data:image/"
        ):
            raise ValueError(
                "Invalid document image format. "
                "Expected a base64 image data URL."
            )

        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": image,
                },
            }
        )

    if len(content) == 1:
        raise ValueError(
            "No valid document images were supplied."
        )

    response = groq_client.chat.completions.create(
    model=VISION_MODEL,
    messages=[
        {
            "role": "user",
            "content": content,
        }
    ],
    temperature=0.4,
    max_completion_tokens=2200,
    stream=False,
    reasoning_format="hidden",
    reasoning_effort="none",
)
    return _extract_response_text(response)


# ============================================================
# GENERAL MEDICAL CHAT
# ============================================================

def generate_medical_chat(
    history: list | None,
    message: str,
) -> str:
    """
    Generate a normal medical-information response.
    """

    history = history or []

    message = str(
        message or ""
    ).strip()

    if not message:
        raise ValueError(
            "Medical question cannot be empty."
        )

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": """
You are MedNexus AI.

You are an advanced medical-information and
health-guidance assistant.

Your job is to provide useful, clear,
professional medical information.

You should:

- understand the actual question
- answer directly
- explain medical concepts simply
- provide practical next steps
- mention important warning signs
- ask a useful follow-up question when necessary

SAFETY:

- Do not claim to physically examine the user.
- Do not claim certainty about a diagnosis.
- Do not invent medical facts.
- Do not tell the user to start or stop
  prescription medication.
- Do not create personalized prescription doses.
- Do not fabricate medicine names.
- Explain medication information carefully.
- Encourage professional medical advice when appropriate.
- For emergencies, recommend urgent medical care.

STYLE:

- professional
- natural
- conversational
- clear
- medium detail
- markdown allowed

Do not reveal internal reasoning.
""",
        }
    ]

    # Keep only the most recent messages.
    for item in history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")

        # Compatibility with older frontend/backend formats.
        if role in {"doctor", "ai", "model"}:
            role = "assistant"

        if role not in {
            "user",
            "assistant",
        }:
            continue

        content = (
            item.get("content")
            or item.get("text")
            or ""
        )

        content = str(
            content
        ).strip()

        if not content:
            continue

        messages.append(
            {
                "role": role,
                "content": content[:10000],
            }
        )

    messages.append(
        {
            "role": "user",
            "content": message,
        }
    )

    return _generate(
        messages,
        model=GENERAL_MODEL,
        max_tokens=1200,
        temperature=0.4,
    )


# ============================================================
# WEB MEDICAL SEARCH
# ============================================================

def web_medical_search(
    message: str,
    document_context: str | None = None,
) -> str:
    """
    Answer medical-information questions using Groq Compound,
    which can perform real-time web searches.

    IMPORTANT:
    Groq documents that Compound can use web search, but also
    explicitly states that Compound should not be used for
    protected health information.
    """

    message = str(
        message or ""
    ).strip()

    if not message:
        raise ValueError(
            "Medical search question cannot be empty."
        )

    context = ""

    if document_context:
        context = f"""
The user has provided information derived from
a medical document.

Use this only as contextual information.

Do not expose unnecessary private patient information.

DOCUMENT CONTEXT:
----------------
{str(document_context)[:30000]}
----------------
"""

    prompt = f"""
You are MedNexus AI Medical Information Assistant.

Answer the user's medical-information question
using current and reliable web information.

{context}

USER QUESTION:

{message}

INSTRUCTIONS:

- Prefer current authoritative medical information.
- Prefer government health agencies.
- Prefer major hospitals.
- Prefer recognized medical organizations.
- Prefer official medicine information.
- Do not claim a confirmed diagnosis.
- Do not prescribe medication.
- Do not tell the user to start or stop prescription medicine.
- Do not invent dosage information.
- Explain medicines carefully.
- Mention important warnings when relevant.
- If the situation appears to be an emergency,
  recommend urgent professional medical care.
- Distinguish current information from general knowledge.
- Use markdown.
- Give a useful synthesized answer instead of merely
  listing search results.
- Do not expose internal reasoning.

Use sections where appropriate:

## Summary

## What It Means

## Important Considerations

## When to Seek Medical Care
"""

    response = groq_client.chat.completions.create(
        model=WEB_MODEL,
        messages=[
            {
                "role": "system",
                "content": """
You are a careful medical-information assistant.

Prioritize accuracy, reliable sources,
and appropriate safety guidance.
""",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        max_completion_tokens=MAX_OUTPUT_TOKENS,
        stream=False,
    )

    return _extract_response_text(response)


# ============================================================
# GENERAL ANSWER COMPATIBILITY FUNCTION
# ============================================================

def generate_general_answer(
    history: list | None,
    message: str,
) -> str:
    """
    Backward-compatible wrapper.
    """

    try:
        return generate_medical_chat(
            history=history or [],
            message=message,
        )

    except Exception as exc:
        print(
            "GENERAL AI ERROR:",
            repr(exc),
        )

        raise RuntimeError(
            "Unable to generate medical response."
        ) from exc


# ============================================================
# DOCUMENT ANSWER COMPATIBILITY FUNCTION
# ============================================================

def generate_document_answer(
    prompt: str,
    document_text: str | None = None,
    image_data_url: str | None = None,
    history: list | None = None,
) -> str:
    """
    Compatibility function for older document-assistant code.

    Supports:

    - extracted PDF/TXT/CSV text
    - uploaded images
    - conversation history
    """

    history = history or []

    # --------------------------------------------------------
    # IMAGE DOCUMENT
    # --------------------------------------------------------

    if image_data_url:
        return analyze_medical_document(
            images=[image_data_url],
            user_message=prompt,
        )

    # --------------------------------------------------------
    # TEXT DOCUMENT
    # --------------------------------------------------------

    if document_text:
        document_text = str(
            document_text
        ).strip()

        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": """
You are MedNexus AI Document Assistant.

Analyze the supplied medical document text.

Do not invent information.

Clearly distinguish:

1. What the document actually says.
2. What is uncertain.
3. General medical interpretation.

Do not diagnose with certainty.

Do not prescribe or change medication.

Use simple professional language.
""",
            }
        ]

        for item in history[-12:]:
            if not isinstance(item, dict):
                continue

            role = item.get("role")

            if role in {"doctor", "ai", "model"}:
                role = "assistant"

            if role not in {
                "user",
                "assistant",
            }:
                continue

            content = (
                item.get("content")
                or item.get("text")
                or ""
            )

            if content:
                messages.append(
                    {
                        "role": role,
                        "content": str(content)[:10000],
                    }
                )

        messages.append(
            {
                "role": "user",
                "content": f"""
USER QUESTION:

{prompt}

DOCUMENT CONTENT:

{document_text[:MAX_DOCUMENT_TEXT]}

Analyze the document and answer the user's question.
""",
            }
        )

        return _generate(
            messages,
            model=DOCUMENT_MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.2,
        )

    # --------------------------------------------------------
    # NORMAL MEDICAL QUESTION
    # --------------------------------------------------------

    return generate_medical_chat(
        history=history,
        message=prompt,
    )


# ============================================================
# WEB ANSWER COMPATIBILITY FUNCTION
# ============================================================

def generate_web_answer(
    prompt: str,
    history: list | None = None,
) -> str:
    """
    Compatibility wrapper for older code.
    """

    return web_medical_search(
        message=prompt,
        document_context=None,
    )