import io
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd

from utils.storage import load_dataset, get_dataset_info, load_registry

router = APIRouter()


def _load_or_404(dataset_id: str) -> pd.DataFrame:
    try:
        return load_dataset(dataset_id)
    except FileNotFoundError:
        raise HTTPException(404, "Dataset not found")


def _get_name(dataset_id: str) -> str:
    registry = load_registry()
    return registry.get(dataset_id, {}).get("name", dataset_id)


@router.get("/{dataset_id}/csv")
def export_csv(dataset_id: str):
    df = _load_or_404(dataset_id)
    name = _get_name(dataset_id)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},
    )


@router.get("/{dataset_id}/excel")
def export_excel(dataset_id: str):
    df = _load_or_404(dataset_id)
    name = _get_name(dataset_id)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Data")
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}.xlsx"'},
    )


@router.get("/{dataset_id}/json")
def export_json(dataset_id: str):
    df = _load_or_404(dataset_id)
    name = _get_name(dataset_id)
    buf = io.StringIO()
    df.to_json(buf, orient="records", indent=2)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{name}.json"'},
    )


@router.get("/{dataset_id}/pdf-report")
def export_pdf_report(dataset_id: str):
    df = _load_or_404(dataset_id)
    name = _get_name(dataset_id)

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        )
        from reportlab.lib import colors
    except ImportError:
        raise HTTPException(500, "reportlab not installed")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph(f"Dataset Report: {name}", styles["Title"]))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
    story.append(Spacer(1, 0.3 * inch))

    # Overview
    story.append(Paragraph("Overview", styles["Heading2"]))
    overview_data = [
        ["Metric", "Value"],
        ["Rows", str(len(df))],
        ["Columns", str(len(df.columns))],
        ["Missing Values", str(df.isnull().sum().sum())],
        ["Duplicate Rows", str(df.duplicated().sum())],
        ["Memory (MB)", f"{df.memory_usage(deep=True).sum()/1024/1024:.3f}"],
    ]
    t = Table(overview_data, colWidths=[2.5 * inch, 3 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * inch))

    # Column stats
    story.append(Paragraph("Column Statistics", styles["Heading2"]))
    col_data = [["Column", "Type", "Missing", "Unique", "Min/Max or Top Values"]]
    for col in df.columns[:30]:  # limit to 30 cols for readability
        s = df[col]
        missing = f"{s.isnull().sum()} ({s.isnull().mean()*100:.1f}%)"
        unique = str(s.nunique())
        if pd.api.types.is_numeric_dtype(s):
            minmax = f"{s.min():.3g} / {s.max():.3g}"
        else:
            top = ", ".join(str(v) for v in s.value_counts().head(2).index)
            minmax = top[:30]
        col_data.append([col[:25], str(s.dtype), missing, unique, minmax])

    ct = Table(col_data, colWidths=[1.5*inch, 0.8*inch, 1.0*inch, 0.7*inch, 2.5*inch])
    ct.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("WORDWRAP", (0, 0), (-1, -1), True),
    ]))
    story.append(ct)

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}_report.pdf"'},
    )
