# Deploy RouteIQ API on Render

Repo: [routeiq-backend](https://github.com/amitranjan9708/routeiq-backend)

## Web Service settings

| Setting | Value |
|--------|--------|
| Root Directory | `.` |
| Build Command | `npm run render:build` |
| Start Command | `npm start` |
| Health Check | `/api/health` |

## Environment variables

Copy from `.env.example`. Required:

- `GEMINI_API_KEY`
- `APIFY_TOKEN`

Recommended on Render:

```env
FLIGHT_PROVIDER=google
SKYSCANNER_DISABLED=1
GOOGLE_FLIGHTS_VENDOR_DIR=vendor/flights-mcp-server
INDIAN_RAILWAYS_MCP_SERVER=vendor/indian-railways-mcp/build/index.js
```

## Frontend

Host the React app separately (e.g. another Render Static Site). Set:

```env
VITE_API_URL=https://YOUR-SERVICE.onrender.com
```

## Verify

```bash
curl https://YOUR-SERVICE.onrender.com/api/health
```
