# RouteIQ API

Multi-modal route search backend (Google Flights, Kiwi, trains, cabs).

## Local setup

```bash
npm install
cp .env.example .env   # add GEMINI_API_KEY, APIFY_TOKEN
npm run railways:setup # builds vendor/indian-railways-mcp
npm run flights:setup  # Google Flights (needs uv)
npm run dev
```

Health: `http://localhost:4000/api/health`

## Deploy on Render

- **Root Directory:** `.` (this repo)
- **Build:** `npm run render:build`
- **Start:** `npm start`
- **Health check:** `/api/health`

Set env vars from `.env.example`. Use `SKYSCANNER_DISABLED=1` on cloud.

See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) if present, or Render dashboard env docs.

## Vendored MCP tools (`vendor/`)

| Folder | Purpose |
|--------|---------|
| `flights-mcp-server` | Google Flights via `uv` |
| `indian-railways-mcp` | Train schedules |
| `mcp-skyscanner` | Skyscanner (often CAPTCHA-blocked) |
