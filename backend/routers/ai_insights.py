import os
import json
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai

from utils.storage import load_dataset, load_registry

router = APIRouter()

MODEL = "gemini-1.5-flash"


def _get_model():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(503, "GEMINI_API_KEY not configured")
    genai.configure(api_key=key)
    return genai.GenerativeModel(MODEL)


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


@router.post("/{dataset_id}/analyze")
def analyze_dataset(dataset_id: str):
    try:
        summary = _dataset_summary(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    model = _get_model()

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

    resp = model.generate_content(prompt)
    text = resp.text.strip()

    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.split("```")[0]

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
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

    model = _get_model()

    system_context = f"""You are a helpful data science assistant. The user is working with this dataset:

{summary}

Answer questions about this data concisely and accurately. When suggesting operations, be specific about column names and methods."""

    history_text = ""
    for msg in body.history[-6:]:
        role = "User" if msg.get("role") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"

    full_prompt = f"{system_context}\n\nConversation so far:\n{history_text}\nUser: {body.message}\nAssistant:"

    resp = model.generate_content(full_prompt)
    return {"response": resp.text.strip()}


@router.post("/{dataset_id}/cleaning-suggestions")
def ai_cleaning_suggestions(dataset_id: str):
    try:
        summary = _dataset_summary(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    model = _get_model()

    prompt = f"""You are an expert data scientist. Return ONLY a valid JSON array of cleaning suggestions (3-6 items).
Each item must have: {{"title": "...", "description": "...", "priority": "high|medium|low", "operation": "fill_missing|remove_duplicates|handle_outliers|normalize|encode|trim_text"}}
Return ONLY the JSON array, no markdown.

Dataset:
{summary}"""

    resp = model.generate_content(prompt)
    text = resp.text.strip()

    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.split("```")[0]

    try:
        suggestions = json.loads(text)
    except json.JSONDecodeError:
        suggestions = []

    return {"suggestions": suggestions}
