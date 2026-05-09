from datetime import datetime
from typing import Any, Optional
import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
from sklearn.preprocessing import LabelEncoder, MinMaxScaler, StandardScaler
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.storage import (
    compute_dataset_info,
    get_dataset_info,
    load_dataset,
    load_history_index,
    pop_history,
    push_history,
    save_dataset,
    load_registry,
)

router = APIRouter()


def _load_or_404(dataset_id: str) -> pd.DataFrame:
    try:
        return load_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")


def _ok(dataset_id: str, df: pd.DataFrame, before: dict, after: dict, message: str):
    registry = load_registry()
    name = registry.get(dataset_id, {}).get("name", dataset_id)
    return {
        "success": True,
        "message": message,
        "dataset": compute_dataset_info(dataset_id, df, name),
        "before_stats": before,
        "after_stats": after,
    }


def _quick_stats(df: pd.DataFrame) -> dict:
    return {
        "rows": len(df),
        "cols": len(df.columns),
        "missing": int(df.isnull().sum().sum()),
        "duplicates": int(df.duplicated().sum()),
    }


class FillMissingBody(BaseModel):
    column: str = "all"
    method: str = "mean"
    custom_value: Optional[Any] = None


class OutlierBody(BaseModel):
    columns: list[str]
    method: str = "iqr"
    action: str = "remove"


class DtypeBody(BaseModel):
    column: str
    dtype: str


class NormalizeBody(BaseModel):
    columns: list[str]
    method: str = "minmax"


class EncodeBody(BaseModel):
    column: str
    method: str = "label"


class DropColsBody(BaseModel):
    columns: list[str]


class DropRowsBody(BaseModel):
    indices: list[int]


class RenameColsBody(BaseModel):
    mapping: dict[str, str]


class SplitColBody(BaseModel):
    column: str
    delimiter: str = ","
    new_names: list[str] = []


class MergeColsBody(BaseModel):
    columns: list[str]
    separator: str = " "
    new_name: str = "merged"


class FormatDateBody(BaseModel):
    column: str
    format: str = "%Y-%m-%d"


@router.post("/{dataset_id}/fill-missing")
def fill_missing(dataset_id: str, body: FillMissingBody):
    df = _load_or_404(dataset_id)
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"fill_missing:{body.column}:{body.method}")

    cols = df.columns.tolist() if body.column == "all" else [body.column]
    for col in cols:
        if col not in df.columns:
            continue
        if body.method == "mean" and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].mean())
        elif body.method == "median" and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].median())
        elif body.method == "mode":
            df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else np.nan)
        elif body.method == "ffill":
            df[col] = df[col].ffill()
        elif body.method == "bfill":
            df[col] = df[col].bfill()
        elif body.method == "custom" and body.custom_value is not None:
            df[col] = df[col].fillna(body.custom_value)
        elif body.method == "drop":
            df = df.dropna(subset=[col])

    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Filled missing values in '{body.column}' using {body.method}")


@router.post("/{dataset_id}/remove-duplicates")
def remove_duplicates(dataset_id: str):
    df = _load_or_404(dataset_id)
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), "remove_duplicates")
    removed = int(df.duplicated().sum())
    df = df.drop_duplicates()
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Removed {removed} duplicate rows")


@router.post("/{dataset_id}/handle-outliers")
def handle_outliers(dataset_id: str, body: OutlierBody):
    df = _load_or_404(dataset_id)
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"handle_outliers:{body.method}:{body.action}")

    cols = [c for c in body.columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    mask = pd.Series([False] * len(df), index=df.index)

    for col in cols:
        s = df[col].dropna()
        if body.method == "iqr":
            q1, q3 = s.quantile(0.25), s.quantile(0.75)
            iqr = q3 - q1
            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            col_mask = (df[col] < lower) | (df[col] > upper)
        elif body.method == "zscore":
            z = np.abs(scipy_stats.zscore(df[col].fillna(df[col].mean())))
            col_mask = pd.Series(z > 3, index=df.index)
        else:
            col_mask = pd.Series([False] * len(df), index=df.index)

        if body.action == "remove":
            mask = mask | col_mask
        elif body.action == "cap":
            if body.method == "iqr":
                df[col] = df[col].clip(lower=lower, upper=upper)
            elif body.method == "zscore":
                mean, std = df[col].mean(), df[col].std()
                df[col] = df[col].clip(lower=mean - 3 * std, upper=mean + 3 * std)

    if body.action == "remove":
        removed = int(mask.sum())
        df = df[~mask]
        msg = f"Removed {removed} outlier rows"
    else:
        msg = f"Capped outliers in {len(cols)} column(s)"

    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), msg)


@router.post("/{dataset_id}/change-dtype")
def change_dtype(dataset_id: str, body: DtypeBody):
    df = _load_or_404(dataset_id)
    if body.column not in df.columns:
        raise HTTPException(400, f"Column '{body.column}' not found")
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"change_dtype:{body.column}:{body.dtype}")

    try:
        if body.dtype == "int":
            df[body.column] = pd.to_numeric(df[body.column], errors="coerce").astype("Int64")
        elif body.dtype == "float":
            df[body.column] = pd.to_numeric(df[body.column], errors="coerce")
        elif body.dtype == "str":
            df[body.column] = df[body.column].astype(str)
        elif body.dtype == "datetime":
            df[body.column] = pd.to_datetime(df[body.column], errors="coerce")
        elif body.dtype == "bool":
            df[body.column] = df[body.column].astype(bool)
        elif body.dtype == "category":
            df[body.column] = df[body.column].astype("category")
    except Exception as e:
        raise HTTPException(400, f"Type conversion failed: {e}")

    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Changed '{body.column}' to {body.dtype}")


@router.post("/{dataset_id}/normalize")
def normalize(dataset_id: str, body: NormalizeBody):
    df = _load_or_404(dataset_id)
    before = _quick_stats(df)
    cols = [c for c in body.columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    if not cols:
        raise HTTPException(400, "No valid numeric columns selected")
    push_history(dataset_id, df.copy(), f"normalize:{body.method}")

    if body.method == "minmax":
        scaler = MinMaxScaler()
    else:
        scaler = StandardScaler()

    df[cols] = scaler.fit_transform(df[cols].fillna(df[cols].mean()))
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Normalized {len(cols)} column(s) using {body.method}")


@router.post("/{dataset_id}/encode-categorical")
def encode_categorical(dataset_id: str, body: EncodeBody):
    df = _load_or_404(dataset_id)
    if body.column not in df.columns:
        raise HTTPException(400, f"Column '{body.column}' not found")
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"encode:{body.column}:{body.method}")

    if body.method == "label":
        le = LabelEncoder()
        df[body.column] = le.fit_transform(df[body.column].astype(str))
    elif body.method == "onehot":
        dummies = pd.get_dummies(df[body.column], prefix=body.column)
        df = pd.concat([df.drop(columns=[body.column]), dummies], axis=1)

    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Encoded '{body.column}' using {body.method} encoding")


@router.post("/{dataset_id}/drop-columns")
def drop_columns(dataset_id: str, body: DropColsBody):
    df = _load_or_404(dataset_id)
    cols = [c for c in body.columns if c in df.columns]
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"drop_cols:{','.join(cols)}")
    df = df.drop(columns=cols)
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Dropped {len(cols)} column(s)")


@router.post("/{dataset_id}/drop-rows")
def drop_rows(dataset_id: str, body: DropRowsBody):
    df = _load_or_404(dataset_id)
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"drop_rows:{len(body.indices)}")
    df = df.drop(index=[i for i in body.indices if i in df.index]).reset_index(drop=True)
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Dropped {len(body.indices)} row(s)")


@router.post("/{dataset_id}/rename-columns")
def rename_columns(dataset_id: str, body: RenameColsBody):
    df = _load_or_404(dataset_id)
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), "rename_cols")
    df = df.rename(columns=body.mapping)
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Renamed {len(body.mapping)} column(s)")


@router.post("/{dataset_id}/trim-text")
def trim_text(dataset_id: str):
    df = _load_or_404(dataset_id)
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), "trim_text")
    str_cols = df.select_dtypes(include="object").columns
    for col in str_cols:
        df[col] = df[col].str.strip()
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Trimmed whitespace in {len(str_cols)} text column(s)")


@router.post("/{dataset_id}/split-column")
def split_column(dataset_id: str, body: SplitColBody):
    df = _load_or_404(dataset_id)
    if body.column not in df.columns:
        raise HTTPException(400, f"Column '{body.column}' not found")
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"split_col:{body.column}")
    split = df[body.column].astype(str).str.split(body.delimiter, expand=True)
    for i, part in enumerate(split.columns):
        new_name = body.new_names[i] if i < len(body.new_names) else f"{body.column}_{i+1}"
        df[new_name] = split[part]
    df = df.drop(columns=[body.column])
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Split '{body.column}' into {len(split.columns)} column(s)")


@router.post("/{dataset_id}/merge-columns")
def merge_columns(dataset_id: str, body: MergeColsBody):
    df = _load_or_404(dataset_id)
    cols = [c for c in body.columns if c in df.columns]
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"merge_cols:{','.join(cols)}")
    df[body.new_name] = df[cols].astype(str).agg(body.separator.join, axis=1)
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Merged {len(cols)} column(s) into '{body.new_name}'")


@router.post("/{dataset_id}/format-dates")
def format_dates(dataset_id: str, body: FormatDateBody):
    df = _load_or_404(dataset_id)
    if body.column not in df.columns:
        raise HTTPException(400, f"Column '{body.column}' not found")
    before = _quick_stats(df)
    push_history(dataset_id, df.copy(), f"format_dates:{body.column}")
    df[body.column] = pd.to_datetime(df[body.column], errors="coerce").dt.strftime(body.format)
    save_dataset(dataset_id, df)
    return _ok(dataset_id, df, before, _quick_stats(df), f"Formatted dates in '{body.column}'")


@router.get("/{dataset_id}/history")
def get_history(dataset_id: str):
    return load_history_index(dataset_id)


@router.post("/{dataset_id}/undo")
def undo(dataset_id: str):
    df_prev = pop_history(dataset_id)
    if df_prev is None:
        raise HTTPException(400, "No history to undo")
    save_dataset(dataset_id, df_prev)
    registry = load_registry()
    name = registry.get(dataset_id, {}).get("name", dataset_id)
    return {
        "success": True,
        "message": "Undo successful",
        "dataset": compute_dataset_info(dataset_id, df_prev, name),
    }


@router.get("/{dataset_id}/suggestions")
def get_suggestions(dataset_id: str):
    df = _load_or_404(dataset_id)
    suggestions = []

    missing_pct = df.isnull().mean() * 100
    for col, pct in missing_pct.items():
        if pct > 0:
            if pd.api.types.is_numeric_dtype(df[col]):
                suggestions.append({
                    "type": "fill_missing",
                    "column": col,
                    "message": f"'{col}' has {pct:.1f}% missing values. Fill with median.",
                    "action": {"column": col, "method": "median"},
                    "severity": "warning" if pct < 20 else "error",
                })
            else:
                suggestions.append({
                    "type": "fill_missing",
                    "column": col,
                    "message": f"'{col}' has {pct:.1f}% missing values. Fill with mode.",
                    "action": {"column": col, "method": "mode"},
                    "severity": "warning",
                })

    dups = df.duplicated().sum()
    if dups > 0:
        suggestions.append({
            "type": "remove_duplicates",
            "column": None,
            "message": f"Found {dups} duplicate rows. Remove them.",
            "action": {},
            "severity": "warning",
        })

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        z = np.abs(scipy_stats.zscore(df[numeric_cols].fillna(df[numeric_cols].mean()), nan_policy="omit"))
        outlier_rows = int((z > 3).any(axis=1).sum())
        if outlier_rows > 0:
            suggestions.append({
                "type": "handle_outliers",
                "column": None,
                "message": f"{outlier_rows} rows have extreme outlier values. Consider IQR capping.",
                "action": {"columns": numeric_cols, "method": "iqr", "action": "cap"},
                "severity": "warning",
            })

    str_cols = df.select_dtypes(include="object").columns
    for col in str_cols:
        if df[col].astype(str).str.contains(r"^\s|\s$", regex=True).any():
            suggestions.append({
                "type": "trim_text",
                "column": col,
                "message": f"'{col}' has leading/trailing whitespace. Trim it.",
                "action": {},
                "severity": "info",
            })
            break

    return {"suggestions": suggestions}
