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
