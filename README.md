# Corey Portal

CEO command center for Medically Modern — a unified view of Gmail, Slack, RingCentral, Monday.com, and employee Q&A, powered by Claude AI.

## Architecture

- **Frontend**: React + Vite + Tailwind → GitHub Pages
- **Backend**: Express + SQLite → Railway
- **AI Layer**: Claude (Anthropic API) for summarization, triage, drafting, and personal assistant

## Setup

### Backend
```bash
cd backend
cp .env.example .env  # fill in your keys
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deployment
- Frontend auto-deploys to GitHub Pages on push to `main`
- Backend deploys to Railway (connect the repo in Railway dashboard)
