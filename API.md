# API Documentation

Base URL: `http://localhost:8000` (dev) or your Railway URL (prod)

Interactive docs available at `{BASE_URL}/docs` (Swagger UI).

---

## Datasets

### Upload Dataset
`POST /api/datasets/upload`

**Form data:** `file` (multipart) — CSV, Excel (.xlsx/.xls), or JSON

**Response:**
```json
{
  "id": "uuid",
  "name": "filename",
  "rows": 1000,
  "cols": 12,
  "missing_count": 45,
  "duplicate_count": 3,
  "outlier_count": 8,
  "memory_mb": 0.124,
  "dtypes_summary": { "numeric": 8, "categorical": 3, "datetime": 1 },
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00",
  "columns": ["col1", "col2", ...]
}
```

### List Datasets
`GET /api/datasets/`

**Response:** `DatasetInfo[]`

### Preview Dataset
`GET /api/datasets/{id}/preview`

**Query params:**
| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `page_size` | 50 | Rows per page (max 500) |
| `search` | `""` | Search all columns |
| `sort_col` | `""` | Column to sort by |
| `sort_dir` | `"asc"` | `"asc"` or `"desc"` |

**Response:**
```json
{
  "data": [{"col1": "val", "col2": 123}, ...],
  "total_rows": 1000,
  "page": 1,
  "page_size": 50,
  "columns": ["col1", "col2"]
}
```

### Column Statistics
`GET /api/datasets/{id}/column-stats`

**Response:** Array of `ColumnStat`:
```json
[{
  "column": "age",
  "dtype": "float64",
  "nulls": 12,
  "null_pct": 1.2,
  "unique": 45,
  "min": 18.0,
  "max": 95.0,
  "mean": 42.3,
  "std": 15.7
}]
```

### Rename Dataset
`PUT /api/datasets/{id}/rename`
```json
{ "name": "new_name" }
```

### Delete Dataset
`DELETE /api/datasets/{id}`

---

## Cleaning

All cleaning endpoints use `POST /api/clean/{id}/{operation}` and return:
```json
{
  "success": true,
  "message": "Operation description",
  "dataset": { ...DatasetInfo },
  "before_stats": { "rows": 1000, "cols": 12, "missing": 45, "duplicates": 3 },
  "after_stats":  { "rows": 997,  "cols": 12, "missing": 0,  "duplicates": 0 }
}
```

### Fill Missing Values
`POST /api/clean/{id}/fill-missing`
```json
{
  "column": "age",       // or "all" for all columns
  "method": "median",    // mean | median | mode | ffill | bfill | custom | drop
  "custom_value": null   // only for method="custom"
}
```

### Remove Duplicates
`POST /api/clean/{id}/remove-duplicates`
*(no body)*

### Handle Outliers
`POST /api/clean/{id}/handle-outliers`
```json
{
  "columns": ["salary", "age"],
  "method": "iqr",    // iqr | zscore
  "action": "cap"     // cap | remove
}
```

### Change Data Type
`POST /api/clean/{id}/change-dtype`
```json
{ "column": "date_str", "dtype": "datetime" }
// dtype options: int | float | str | datetime | bool | category
```

### Normalize / Standardize
`POST /api/clean/{id}/normalize`
```json
{ "columns": ["salary", "age"], "method": "minmax" }
// method: minmax | zscore
```

### Encode Categorical
`POST /api/clean/{id}/encode-categorical`
```json
{ "column": "gender", "method": "label" }
// method: label | onehot
```

### Drop Columns
`POST /api/clean/{id}/drop-columns`
```json
{ "columns": ["id", "unused_col"] }
```

### Rename Columns
`POST /api/clean/{id}/rename-columns`
```json
{ "mapping": { "old_name": "new_name" } }
```

### Trim Text
`POST /api/clean/{id}/trim-text`
*(no body — trims all string columns)*

### Split Column
`POST /api/clean/{id}/split-column`
```json
{ "column": "full_name", "delimiter": " ", "new_names": ["first", "last"] }
```

### Merge Columns
`POST /api/clean/{id}/merge-columns`
```json
{ "columns": ["first", "last"], "separator": " ", "new_name": "full_name" }
```

### Format Dates
`POST /api/clean/{id}/format-dates`
```json
{ "column": "date", "format": "%Y-%m-%d" }
```

### Get History
`GET /api/clean/{id}/history`
```json
[{ "id": "abc123", "operation": "fill_missing:age:median", "ts": "2024-01-01T00:00:00" }]
```

### Undo
`POST /api/clean/{id}/undo`

### Get Smart Suggestions
`GET /api/clean/{id}/suggestions`
```json
{ "suggestions": [{ "type": "fill_missing", "column": "age", "message": "...", "action": {}, "severity": "warning" }] }
```

---

## Merge

### Merge Two Datasets
`POST /api/merge/`
```json
{
  "left_id": "uuid1",
  "right_id": "uuid2",
  "left_key": "user_id",
  "right_key": "id",
  "how": "inner",       // inner | left | right | outer
  "new_name": "merged"
}
```
**Response:** `DatasetInfo` of the new merged dataset

### Preview Merge
`POST /api/merge/preview`
*(same body, returns first 20 rows only)*

---

## AI

### Analyze Dataset
`POST /api/ai/{id}/analyze`

Calls Claude API. Returns:
```json
{
  "summary": "This dataset contains...",
  "insights": ["Insight 1", "Insight 2"],
  "warnings": ["Column X has 45% missing values"],
  "recommendations": ["Fill missing in column X with median"],
  "quality_score": 0.72
}
```

### Chat with AI
`POST /api/ai/{id}/chat`
```json
{
  "message": "What's the distribution of the age column?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
**Response:** `{ "response": "The age column shows..." }`

### AI Cleaning Suggestions
`POST /api/ai/{id}/cleaning-suggestions`

**Response:** `{ "suggestions": [{ "title": "...", "description": "...", "priority": "high", "operation": "fill_missing" }] }`

---

## Export

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/export/{id}/csv` | GET | `text/csv` download |
| `/api/export/{id}/excel` | GET | `.xlsx` download |
| `/api/export/{id}/json` | GET | `application/json` download |
| `/api/export/{id}/pdf-report` | GET | `application/pdf` download |
