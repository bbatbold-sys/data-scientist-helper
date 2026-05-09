import io, uuid
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from utils.storage import (
    compute_dataset_info,
    delete_dataset,
    get_dataset_info,
    list_datasets,
    load_dataset,
    save_dataset,
    update_registry_entry,
    load_registry,
)

router = APIRouter()


class RenameBody(BaseModel):
    name: str


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    content = await file.read()
    fname = file.filename or "dataset"
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif fname.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        elif fname.endswith(".json"):
            df = pd.read_json(io.BytesIO(content))
        else:
            raise HTTPException(400, "Unsupported file type. Use CSV, Excel, or JSON.")
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {e}")

    dataset_id = str(uuid.uuid4())
    name = fname.rsplit(".", 1)[0]
    save_dataset(dataset_id, df)
    update_registry_entry(dataset_id, name)
    return compute_dataset_info(dataset_id, df, name)


@router.get("/")
def get_all_datasets():
    return list_datasets()


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str):
    try:
        return get_dataset_info(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: str = Query(""),
    sort_col: str = Query(""),
    sort_dir: str = Query("asc"),
):
    try:
        df = load_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    if search:
        mask = df.apply(lambda col: col.astype(str).str.contains(search, case=False, na=False)).any(axis=1)
        df = df[mask]

    if sort_col and sort_col in df.columns:
        df = df.sort_values(by=sort_col, ascending=(sort_dir == "asc"))

    total = len(df)
    start = (page - 1) * page_size
    page_df = df.iloc[start : start + page_size]

    # Convert to JSON-serializable format
    data = []
    for _, row in page_df.iterrows():
        record = {}
        for col in page_df.columns:
            val = row[col]
            if pd.isna(val) if not isinstance(val, (list, dict)) else False:
                record[col] = None
            elif isinstance(val, (np.integer,)):
                record[col] = int(val)
            elif isinstance(val, (np.floating,)):
                record[col] = float(val)
            else:
                record[col] = str(val) if not isinstance(val, (bool, int, float, str, type(None))) else val
        data.append(record)

    return {
        "data": data,
        "total_rows": total,
        "page": page,
        "page_size": page_size,
        "columns": df.columns.tolist(),
    }


@router.get("/{dataset_id}/column-stats")
def column_stats(dataset_id: str):
    try:
        df = load_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")

    stats = []
    for col in df.columns:
        s = df[col]
        dtype = str(s.dtype)
        nulls = int(s.isnull().sum())
        null_pct = round(nulls / len(s) * 100, 2) if len(s) else 0
        unique = int(s.nunique())
        col_stat = {
            "column": col,
            "dtype": dtype,
            "nulls": nulls,
            "null_pct": null_pct,
            "unique": unique,
        }
        if pd.api.types.is_numeric_dtype(s):
            col_stat["min"] = float(s.min()) if not pd.isna(s.min()) else None
            col_stat["max"] = float(s.max()) if not pd.isna(s.max()) else None
            col_stat["mean"] = round(float(s.mean()), 4) if not pd.isna(s.mean()) else None
            col_stat["std"] = round(float(s.std()), 4) if not pd.isna(s.std()) else None
        else:
            top = s.value_counts().head(5)
            col_stat["top_values"] = [{"value": str(k), "count": int(v)} for k, v in top.items()]
        stats.append(col_stat)

    return stats


@router.delete("/{dataset_id}")
def remove_dataset(dataset_id: str):
    try:
        load_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")
    delete_dataset(dataset_id)
    return {"success": True}


@router.put("/{dataset_id}/rename")
def rename_dataset(dataset_id: str, body: RenameBody):
    registry = load_registry()
    if dataset_id not in registry:
        raise HTTPException(404, "Dataset not found")
    meta = registry[dataset_id]
    update_registry_entry(dataset_id, body.name, meta.get("created_at"))
    return get_dataset_info(dataset_id)
