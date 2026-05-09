import uuid
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
import pandas as pd

from utils.storage import (
    compute_dataset_info,
    load_dataset,
    save_dataset,
    update_registry_entry,
)

router = APIRouter()


class MergeBody(BaseModel):
    left_id: str
    right_id: str
    left_key: str
    right_key: str
    how: str = "inner"
    new_name: str = "merged_dataset"


class ConcatBody(BaseModel):
    left_id: str
    right_id: str
    axis: str = "rows"   # "rows" or "columns"
    new_name: str = "concatenated_dataset"
    left_columns: list[str] | None = None
    right_columns: list[str] | None = None
    join: str = "inner"  # "inner" = only common columns, "outer" = all columns (fill missing with NaN)


def _apply_concat(body: ConcatBody):
    left = load_dataset(body.left_id)
    right = load_dataset(body.right_id)
    if body.left_columns:
        missing = [c for c in body.left_columns if c not in left.columns]
        if missing:
            raise HTTPException(400, f"Columns not in left dataset: {missing}")
        left = left[body.left_columns]
    if body.right_columns:
        missing = [c for c in body.right_columns if c not in right.columns]
        if missing:
            raise HTTPException(400, f"Columns not in right dataset: {missing}")
        right = right[body.right_columns]
    ax = 0 if body.axis == "rows" else 1
    join = body.join if ax == 0 else "outer"
    return pd.concat([left, right], axis=ax, ignore_index=(ax == 0), join=join)


@router.post("/concat")
def concat_datasets(body: ConcatBody):
    try:
        result = _apply_concat(body)
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(400, f"Concatenation failed: {e}")

    new_id = str(uuid.uuid4())
    save_dataset(new_id, result)
    update_registry_entry(new_id, body.new_name)
    return compute_dataset_info(new_id, result, body.new_name)


@router.post("/concat/preview")
def concat_preview(body: ConcatBody):
    try:
        result = _apply_concat(body)
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(400, f"Concatenation failed: {e}")

    preview = result.head(20)

    def safe(v):
        if pd.isna(v) if not isinstance(v, (list, dict)) else False:
            return None
        import numpy as np
        if isinstance(v, np.integer): return int(v)
        if isinstance(v, np.floating): return float(v)
        return v

    data = [{col: safe(row[col]) for col in preview.columns} for _, row in preview.iterrows()]
    return {"data": data, "columns": result.columns.tolist(), "total_rows": len(result)}


@router.post("/")
def merge_datasets(body: MergeBody):
    try:
        left = load_dataset(body.left_id)
        right = load_dataset(body.right_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    if body.left_key not in left.columns:
        raise HTTPException(400, f"Column '{body.left_key}' not in left dataset")
    if body.right_key not in right.columns:
        raise HTTPException(400, f"Column '{body.right_key}' not in right dataset")
    if body.how not in ("inner", "left", "right", "outer"):
        raise HTTPException(400, "Invalid join type")

    merged = pd.merge(left, right, left_on=body.left_key, right_on=body.right_key, how=body.how)
    new_id = str(uuid.uuid4())
    save_dataset(new_id, merged)
    update_registry_entry(new_id, body.new_name)
    return compute_dataset_info(new_id, merged, body.new_name)


@router.post("/preview")
def preview_merge(body: MergeBody):
    try:
        left = load_dataset(body.left_id)
        right = load_dataset(body.right_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    if body.left_key not in left.columns:
        raise HTTPException(400, f"Column '{body.left_key}' not in left dataset")
    if body.right_key not in right.columns:
        raise HTTPException(400, f"Column '{body.right_key}' not in right dataset")

    merged = pd.merge(left, right, left_on=body.left_key, right_on=body.right_key, how=body.how)
    preview = merged.head(20)

    def safe_val(v):
        if pd.isna(v) if not isinstance(v, (list, dict)) else False:
            return None
        import numpy as np
        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, (np.floating,)):
            return float(v)
        return v

    data = [{col: safe_val(row[col]) for col in preview.columns} for _, row in preview.iterrows()]
    return {"data": data, "columns": merged.columns.tolist(), "total_rows": len(merged)}
