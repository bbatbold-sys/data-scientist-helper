import os
import json
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic

from utils.storage import load_dataset, load_registry

router = APIRouter()

MODEL = "claude-sonnet-4-6"


def _get_client():
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured")
    return anthropic.Anthropic(api_key=key)


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

    client = _get_client()

    system = """You are an expert data scientist. Analyze the dataset summary and return a JSON object with these exact keys:
{
  "summary": "2-3 sentence overview of the dataset",
  "insights": ["insight 1", "insight 2", ...],
  "warnings": ["warning 1", ...],
  "recommendations": ["recommendation 1", ...],
  "quality_score": 0.0-1.0
}

quality_score: 1.0 = perfect data, 0.0 = very poor quality. Base it on completeness, consistency, and outliers.
Provide 3-6 items each for insights, warnings, and recommendations. Be specific and actionable. Return only valid JSON."""

    resp = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": f"Analyze this dataset:\n\n{summary}"}],
    )

    text = resp.content[0].text.strip()
    # Extract JSON if wrapped in markdown
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

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

    client = _get_client()

    system = f"""You are a helpful data science assistant. The user is working with the following dataset:

{summary}

Answer questions about this data concisely and accurately. When suggesting operations, be specific about column names and methods. If asked to do something you cannot do directly, explain what steps the user should take in the app."""

    messages = []
    for msg in body.history[-10:]:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.message})

    resp = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        system=system,
        messages=messages,
    )

    return {"response": resp.content[0].text}


@router.post("/{dataset_id}/cleaning-suggestions")
def ai_cleaning_suggestions(dataset_id: str):
    try:
        summary = _dataset_summary(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    client = _get_client()

    system = """You are an expert data scientist. Given a dataset summary, return a JSON array of cleaning suggestions.
Each suggestion must have: {"title": "...", "description": "...", "priority": "high|medium|low", "operation": "fill_missing|remove_duplicates|handle_outliers|normalize|encode|trim_text"}
Return only valid JSON array, 3-8 suggestions."""

    resp = client.messages.create(
        model=MODEL,
        max_tokens=800,
        system=system,
        messages=[{"role": "user", "content": f"Suggest cleaning operations for:\n\n{summary}"}],
    )

    text = resp.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    try:
        suggestions = json.loads(text)
    except json.JSONDecodeError:
        suggestions = []

    return {"suggestions": suggestions}
