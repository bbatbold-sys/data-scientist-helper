import os
import json
import requests
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.storage import load_dataset, load_registry

router = APIRouter()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def _call_gemini(prompt: str) -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(503, "GEMINI_API_KEY is not set in Railway environment variables")
    try:
        resp = requests.post(
            GEMINI_URL,
            params={"key": key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except requests.HTTPError as e:
        raise HTTPException(502, f"Gemini API error {e.response.status_code}: {e.response.text[:200]}")
    except requests.RequestException as e:
        raise HTTPException(502, f"Gemini request failed: {e}")
    except (KeyError, IndexError):
        raise HTTPException(502, "Unexpected Gemini API response format")


def _dataset_summary(dataset_id: str) -> str:
    df = load_dataset(dataset_id)
    registry = load_registry()
    name = registry.get(dataset_id, {}).get("name", dataset_id)

    lines = [
        f"Dataset: {name}",
        f"Shape: {df.shape[0]} rows × {df.shape[1]} columns",
        f"Missing values: {df.isnull().sum().sum()} total ({df.isnull().mean().mean()*100:.1f}% avg)",
        f"Duplicate rows: {df.duplicated().sum()}",
        "",
        "Column overview:",
    ]
    for col in df.columns:
        s = df[col]
        dtype = str(s.dtype)
        nulls = s.isnull().sum()
        if pd.api.types.is_numeric_dtype(s):
            lines.append(f"  {col} ({dtype}): min={s.min():.3g}, max={s.max():.3g}, mean={s.mean():.3g}, nulls={nulls}")
        else:
            top = s.value_counts().head(3).index.tolist()
            lines.append(f"  {col} ({dtype}): {s.nunique()} unique, top={top}, nulls={nulls}")

    sample = df.head(5).to_string(max_cols=10)
    lines += ["", "Sample rows (first 5):", sample]
    return "\n".join(lines)


def _parse_json(text: str):
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.split("```")[0]
    return json.loads(text.strip())


@router.post("/{dataset_id}/analyze")
def analyze_dataset(dataset_id: str):
    try:
        summary = _dataset_summary(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    prompt = f"""You are an expert data scientist. Analyze this dataset summary and return ONLY a valid JSON object with these exact keys:
{{
  "summary": "2-3 sentence overview of the dataset",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "warnings": ["warning 1", "warning 2"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "quality_score": 0.75
}}

quality_score must be a number between 0.0 and 1.0 (1.0 = perfect data).
Provide 3-6 items each for insights, warnings, and recommendations.
Return ONLY valid JSON, no markdown, no explanation.

Dataset to analyze:
{summary}"""

    text = _call_gemini(prompt)

    try:
        result = _parse_json(text)
    except (json.JSONDecodeError, ValueError):
        result = {
            "summary": text[:500],
            "insights": [],
            "warnings": [],
            "recommendations": [],
            "quality_score": 0.5,
        }

    return result


class ChatBody(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/{dataset_id}/chat")
def chat_with_ai(dataset_id: str, body: ChatBody):
    try:
        summary = _dataset_summary(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    history_text = ""
    for msg in body.history[-6:]:
        role = "User" if msg.get("role") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"

    prompt = f"""You are a helpful data science assistant. The user is working with this dataset:

{summary}

Answer questions about this data concisely and accurately. When suggesting operations, be specific about column names and methods.

Conversation so far:
{history_text}
User: {body.message}
Assistant:"""

    response = _call_gemini(prompt)
    return {"response": response.strip()}


@router.post("/{dataset_id}/cleaning-suggestions")
def ai_cleaning_suggestions(dataset_id: str):
    try:
        summary = _dataset_summary(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    prompt = f"""You are an expert data scientist. Return ONLY a valid JSON array of cleaning suggestions (3-6 items).
Each item must have: {{"title": "...", "description": "...", "priority": "high|medium|low", "operation": "fill_missing|remove_duplicates|handle_outliers|normalize|encode|trim_text"}}
Return ONLY the JSON array, no markdown.

Dataset:
{summary}"""

    text = _call_gemini(prompt)

    try:
        suggestions = _parse_json(text)
    except (json.JSONDecodeError, ValueError):
        suggestions = []

    return {"suggestions": suggestions}
