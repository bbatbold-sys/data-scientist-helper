# Architecture Overview

## System Design

Data Scientist Helper is a full-stack web application with a Python backend and React frontend communicating over a REST API.

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│  ┌──────────┐   ┌─────────────────┐   ┌──────────────────┐ │
│  │ Sidebar  │   │  Main Workspace  │   │  AI Right Panel  │ │
│  │ Dataset  │   │ Preview/Clean/   │   │  Chat + Insights │ │
│  │  Cards   │   │ Merge/Visualize  │   │  Quality Score   │ │
│  └──────────┘   └─────────────────┘   └──────────────────┘ │
│                                                              │
│  React 18 + TypeScript + Zustand + React Query + Recharts   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/REST (axios)
                             │ VITE_API_URL env var
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                          │
│                                                              │
│  /api/datasets  →  Upload, list, preview, stats, delete     │
│  /api/clean     →  13 cleaning operations + undo history    │
│  /api/merge     →  Inner/left/right/outer joins             │
│  /api/ai        →  Claude analysis, chat, suggestions       │
│  /api/export    →  CSV, Excel, JSON, PDF report             │
│                                                              │
│  FastAPI + Pandas + Scikit-learn + Anthropic SDK            │
└────────────────────────┬───────────────┬────────────────────┘
                         │               │
               ┌─────────▼──────┐  ┌────▼────────┐
               │  File Storage  │  │  Anthropic  │
               │  (pickle + JSON│  │  Claude API │
               │   registry)    │  │             │
               └────────────────┘  └─────────────┘
```

## Frontend Architecture

### State Management
- **Zustand** (`store/useStore.ts`) — global state: datasets list, active dataset, active tab, dark mode
- **React Query** — server state: API calls with caching, background refetch, loading states
- Component-local state for UI (form inputs, selections, modals)

### Component Tree
```
App.tsx
├── Sidebar.tsx          — dataset list, upload, dark mode toggle
├── MainWorkspace.tsx    — tab bar + active tab content
│   ├── DataTable.tsx    — preview with TanStack Table
│   ├── CleaningWorkspace.tsx
│   ├── MergeWorkspace.tsx
│   ├── VisualizationWorkspace.tsx
│   └── AnalysisWorkspace.tsx
├── RightPanel.tsx       — AI assistant chat + quality gauge
└── UploadModal.tsx      — drag-and-drop file upload
```

### Data Flow
1. User uploads CSV/Excel/JSON → `POST /api/datasets/upload`
2. Backend parses with Pandas, computes stats, saves as pickle
3. Dataset appears in sidebar (React Query cache invalidation)
4. User opens dataset → `GET /api/datasets/{id}/preview` (paginated)
5. Cleaning operations → `POST /api/clean/{id}/operation` → backend mutates in-place, snapshot saved to history
6. AI analysis → `POST /api/ai/{id}/analyze` → Claude API → structured JSON response

## Backend Architecture

### Storage
Datasets are stored as **Python pickle files** in `backend/data/{id}.pkl`.

Registry (`backend/data/registry.json`) maps `id → {name, created_at}`.

History snapshots (`backend/data/history/{id}/`) store up to 20 rollback points per dataset.

### Cleaning Pipeline
Each cleaning operation follows this pattern:
1. Load current DataFrame from pickle
2. Push current state to history stack
3. Apply transformation (Pandas/Scikit-learn)
4. Save new state back to pickle
5. Return `{success, dataset: DatasetInfo, before_stats, after_stats, message}`

### AI Integration
The AI layer (`routers/ai_insights.py`) builds a natural-language summary of the dataset and sends it to Claude claude-sonnet-4-6. Responses are structured JSON parsed and returned to the frontend.

## Deployment Architecture

```
GitHub Repository
├── /backend  →  Railway (Python service)
│               Port: $PORT (env var)
│               Build: pip install -r requirements.txt
│               Start: uvicorn main:app --host 0.0.0.0 --port $PORT
│
└── /frontend  →  Vercel (static + CDN)
                  Build: npm run build
                  Env: VITE_API_URL=https://your-railway-url.up.railway.app
```

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Backend framework | FastAPI | Async support, auto OpenAPI docs, type safety |
| Data processing | Pandas | Industry standard, rich API for all cleaning ops |
| Dataset storage | Pickle files | Zero config, preserves all Pandas types/dtypes |
| Frontend framework | React + Vite | Fastest dev experience, ecosystem maturity |
| State management | Zustand | Lightweight, no boilerplate vs Redux |
| Server state | React Query | Caching, background sync, loading states built-in |
| Charts | Recharts | React-native, composable, TypeScript-first |
| AI model | claude-sonnet-4-6 | Best cost/performance for data analysis |
