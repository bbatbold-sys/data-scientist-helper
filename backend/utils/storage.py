import os, json, uuid, pickle
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from pydantic import BaseModel

DATA_DIR = Path(__file__).parent.parent / "data"
REGISTRY_FILE = DATA_DIR / "registry.json"
HISTORY_DIR = DATA_DIR / "history"
MAX_HISTORY = 20


class DatasetInfo(BaseModel):
    id: str
    name: str
    rows: int
    cols: int
    missing_count: int
    duplicate_count: int
    outlier_count: int
    memory_mb: float
    dtypes_summary: dict
    created_at: str
    updated_at: str
    columns: list


def ensure_dirs():
    DATA_DIR.mkdir(exist_ok=True)
    HISTORY_DIR.mkdir(exist_ok=True)


def load_registry() -> dict:
    ensure_dirs()
    if REGISTRY_FILE.exists():
        with open(REGISTRY_FILE) as f:
            return json.load(f)
    return {}


def save_registry(registry: dict):
    ensure_dirs()
    with open(REGISTRY_FILE, "w") as f:
        json.dump(registry, f, indent=2)


def load_dataset(dataset_id: str) -> pd.DataFrame:
    path = DATA_DIR / f"{dataset_id}.pkl"
    if not path.exists():
        raise FileNotFoundError(f"Dataset {dataset_id} not found")
    with open(path, "rb") as f:
        return pickle.load(f)


def save_dataset(dataset_id: str, df: pd.DataFrame):
    ensure_dirs()
    path = DATA_DIR / f"{dataset_id}.pkl"
    with open(path, "wb") as f:
        pickle.dump(df, f)


def delete_dataset(dataset_id: str):
    path = DATA_DIR / f"{dataset_id}.pkl"
    if path.exists():
        path.unlink()
    hist_dir = HISTORY_DIR / dataset_id
    if hist_dir.exists():
        import shutil
        shutil.rmtree(hist_dir)
    registry = load_registry()
    registry.pop(dataset_id, None)
    save_registry(registry)


def compute_dataset_info(dataset_id: str, df: pd.DataFrame, name: str, created_at: str = None) -> DatasetInfo:
    now = datetime.utcnow().isoformat()
    missing_count = int(df.isnull().sum().sum())
    duplicate_count = int(df.duplicated().sum())

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    outlier_count = 0
    if numeric_cols:
        z = np.abs(stats.zscore(df[numeric_cols].fillna(df[numeric_cols].mean()), nan_policy="omit"))
        outlier_count = int((z > 3).any(axis=1).sum())

    dtypes_summary = {
        "numeric": int(df.select_dtypes(include=[np.number]).shape[1]),
        "categorical": int(df.select_dtypes(include=["object", "category"]).shape[1]),
        "datetime": int(df.select_dtypes(include=["datetime64"]).shape[1]),
    }

    return DatasetInfo(
        id=dataset_id,
        name=name,
        rows=len(df),
        cols=len(df.columns),
        missing_count=missing_count,
        duplicate_count=duplicate_count,
        outlier_count=outlier_count,
        memory_mb=round(df.memory_usage(deep=True).sum() / 1024 / 1024, 3),
        dtypes_summary=dtypes_summary,
        created_at=created_at or now,
        updated_at=now,
        columns=df.columns.tolist(),
    )


def get_dataset_info(dataset_id: str) -> DatasetInfo:
    registry = load_registry()
    if dataset_id not in registry:
        raise FileNotFoundError(f"Dataset {dataset_id} not found")
    df = load_dataset(dataset_id)
    meta = registry[dataset_id]
    return compute_dataset_info(dataset_id, df, meta["name"], meta.get("created_at"))


def list_datasets() -> list:
    registry = load_registry()
    result = []
    for did, meta in registry.items():
        try:
            df = load_dataset(did)
            info = compute_dataset_info(did, df, meta["name"], meta.get("created_at"))
            result.append(info)
        except Exception:
            pass
    return result


def update_registry_entry(dataset_id: str, name: str, created_at: str = None):
    registry = load_registry()
    now = datetime.utcnow().isoformat()
    registry[dataset_id] = {
        "name": name,
        "created_at": created_at or registry.get(dataset_id, {}).get("created_at", now),
    }
    save_registry(registry)


# ── History helpers ──────────────────────────────────────────────────────────

def _hist_dir(dataset_id: str) -> Path:
    d = HISTORY_DIR / dataset_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _hist_index_path(dataset_id: str) -> Path:
    return _hist_dir(dataset_id) / "index.json"


def load_history_index(dataset_id: str) -> list:
    p = _hist_index_path(dataset_id)
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return []


def save_history_index(dataset_id: str, index: list):
    with open(_hist_index_path(dataset_id), "w") as f:
        json.dump(index, f)


def push_history(dataset_id: str, df: pd.DataFrame, operation: str):
    index = load_history_index(dataset_id)
    snap_id = str(uuid.uuid4())[:8]
    snap_path = _hist_dir(dataset_id) / f"{snap_id}.pkl"
    with open(snap_path, "wb") as f:
        pickle.dump(df, f)
    index.append({"id": snap_id, "operation": operation, "ts": datetime.utcnow().isoformat()})
    if len(index) > MAX_HISTORY:
        old = index.pop(0)
        old_path = _hist_dir(dataset_id) / f"{old['id']}.pkl"
        if old_path.exists():
            old_path.unlink()
    save_history_index(dataset_id, index)


def pop_history(dataset_id: str) -> pd.DataFrame | None:
    index = load_history_index(dataset_id)
    if not index:
        return None
    last = index.pop()
    save_history_index(dataset_id, index)
    snap_path = _hist_dir(dataset_id) / f"{last['id']}.pkl"
    if snap_path.exists():
        with open(snap_path, "rb") as f:
            df = pickle.load(f)
        snap_path.unlink()
        return df
    return None
