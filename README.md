# Data Scientist Helper

A professional AI-powered data cleaning, visualization, and analysis platform. Upload datasets, clean them with one click, visualize with 9 chart types, and get AI-generated insights — all in a modern, responsive interface.

**Live Demo:** [your-app.vercel.app](https://your-app.vercel.app)  
**API Docs:** [your-backend.up.railway.app/docs](https://your-backend.up.railway.app/docs)

---

## Features

| Feature | Description |
|---------|-------------|
| **Dataset Management** | Upload CSV, Excel, JSON — sidebar shows rows, columns, missing values, duplicates, outliers, memory |
| **Interactive Preview** | Paginated table with search, sorting, null highlighting, column type indicators |
| **Data Cleaning** | 13 operations: fill missing (7 methods), remove duplicates, handle outliers (IQR/z-score), change types, normalize, encode, drop/rename/split/merge columns, trim text, format dates |
| **Undo History** | Every operation is snapshotted — undo up to 20 steps |
| **Smart Suggestions** | Heuristic scan detects issues and suggests fixes automatically |
| **Dataset Merging** | Visual join builder — inner/left/right/outer joins with live preview |
| **9 Chart Types** | Bar, Line, Scatter, Histogram, Pie, Correlation Matrix, Box Plot, Heatmap, Time Series |
| **AI Analysis** | Claude-powered full analysis: quality score, insights, warnings, recommendations |
| **AI Chat** | Ask questions about your dataset in natural language |
| **Export** | Download as CSV, Excel, JSON, or generated PDF report |
| **Dark Mode** | Full dark/light theme toggle |

## Tech Stack

**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · TanStack Table · Recharts · Zustand · React Query

**Backend:** Python · FastAPI · Pandas · NumPy · Scikit-learn · Anthropic SDK

**AI:** Claude claude-sonnet-4-6 (analysis, chat, suggestions)

**Deployment:** Railway (backend) · Vercel (frontend)

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- An [Anthropic API key](https://console.anthropic.com/) (for AI features)

### Backend Setup

```bash
cd backend

# Create and activate virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start the API server
uvicorn main:app --reload --port 8000
```

API will be available at http://localhost:8000  
Swagger docs at http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# .env already points to http://localhost:8000 by default

# Start the dev server
npm run dev
```

App will be available at http://localhost:5173

---

## Deployment

### Backend → Railway

1. Create a new project on [Railway](https://railway.app/)
2. Connect your GitHub repository
3. Set the **Root Directory** to `backend`
4. Add environment variables:
   ```
   ANTHROPIC_API_KEY=your_key_here
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
5. Railway auto-detects Python and uses the `Procfile` for the start command

### Frontend → Vercel

1. Import your GitHub repository on [Vercel](https://vercel.com/)
2. Set the **Root Directory** to `frontend`
3. Add environment variable:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   ```
4. Deploy — Vercel auto-detects Vite

---

## Claude Code Integration

This project uses a **Claude Code Skill** for domain expertise:

```
.claude/commands/ds-analyze.md
```

Use it in Claude Code to get expert data science advice:
```
/ds-analyze What cleaning steps should I apply to a sales dataset with 30% missing revenue values?
```

The skill provides:
- Data quality assessment framework
- Cleaning operation priority order
- Statistical interpretation guidelines
- Chart selection by data type
- Domain-specific advice (financial, healthcare, time series)

---

## Project Structure

```
data-scientist-helper-v2/
├── .claude/
│   └── commands/
│       └── ds-analyze.md      ← Claude Code skill
├── backend/
│   ├── main.py                ← FastAPI app
│   ├── requirements.txt
│   ├── Procfile               ← Railway start command
│   ├── nixpacks.toml          ← Railway build config
│   ├── .env.example
│   ├── routers/
│   │   ├── datasets.py        ← CRUD + preview
│   │   ├── cleaning.py        ← 13 cleaning ops
│   │   ├── merge.py           ← Join operations
│   │   ├── ai_insights.py     ← Claude integration
│   │   └── export_data.py     ← CSV/Excel/JSON/PDF
│   └── utils/
│       └── storage.py         ← Pickle storage + history
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/client.ts      ← All API calls
│   │   ├── store/useStore.ts  ← Zustand global state
│   │   ├── types/index.ts
│   │   └── components/
│   │       ├── Layout/        ← Sidebar, Main, RightPanel
│   │       ├── DataTable/     ← TanStack Table
│   │       ├── Cleaning/      ← Cleaning workspace
│   │       ├── Merge/         ← Join builder
│   │       ├── Visualization/ ← 9 chart types
│   │       ├── Analysis/      ← AI analysis view
│   │       └── Upload/        ← Drag-and-drop modal
│   ├── vercel.json
│   └── package.json
├── ARCHITECTURE.md            ← System design
├── API.md                     ← API reference
└── README.md
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design diagram, component tree, data flow, and key technical decisions.

## API Reference

See [API.md](./API.md) for complete endpoint documentation with request/response examples.

---

## Development Notes

- All cleaning operations are **non-destructive** — a snapshot is saved before every operation and can be undone
- Datasets are stored as pickle files in `backend/data/` — this directory is excluded from git
- The AI features require a valid `ANTHROPIC_API_KEY` — without it, analysis endpoints return 503
- The Vite dev proxy (`/api → localhost:8000`) is only active in development — production uses `VITE_API_URL`

---

## License

MIT
