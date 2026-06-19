# Deploy — Frontend on Vercel

The backend is live at **https://16.170.244.106.nip.io** (AWS EC2 + Docker + Caddy).
These steps put the React frontend on Vercel and wire it to that backend.

---

## 1. Import the project
1. Go to <https://vercel.com> → **Add New… → Project**.
2. Import the GitHub repo `spotter-ai-fullstack-assessment`.

## 2. Configure the build
Vercel will detect Vite. Set:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| Framework Preset | Vite (auto-detected) |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` (default) |
| Install Command | `npm install` (default) |

> Setting **Root Directory = `frontend`** is the important part — the repo has the
> backend in the same repo.

## 3. Environment variable
Add one variable (Project → Settings → Environment Variables), for all environments:

```
VITE_API_BASE_URL = https://16.170.244.106.nip.io
```

## 4. Deploy
Click **Deploy**. You'll get a URL like `https://your-app.vercel.app`.

---

## 5. Allow the frontend origin on the backend (CORS) — required
The backend only accepts requests from origins you whitelist. After you know the
Vercel URL, update the backend env on EC2:

```bash
ssh -i django-key.pem ubuntu@16.170.244.106
cd ~/spotter-ai-fullstack-assessment
nano backend/.env
```
Set (use your real Vercel URL):
```
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-app.vercel.app,https://16.170.244.106.nip.io
```
Apply:
```bash
docker compose up -d --force-recreate backend
```

> If you skip this, the browser console will show a **CORS error** and requests
> fail. Add every Vercel domain you use (the production domain and any preview
> domains you test from).

---

## 6. Verify
1. Open `https://your-app.vercel.app`.
2. Plan a trip (pick cities from the dropdown).
3. Confirm the map + daily log sheets render. In DevTools → Network, the
   `POST /api/trips/` call should be `201` against `https://16.170.244.106.nip.io`.

---

## Redeploys
- **Frontend:** push to the default branch → Vercel auto-deploys. Changing
  `VITE_API_BASE_URL` requires a redeploy to take effect.
- **Backend:** `git pull && docker compose up -d --build` on EC2.

## Custom domain (optional)
Add a domain in Vercel for the frontend. For the backend, point a domain's A
record at the EC2 IP and put it in `Caddyfile` + `DJANGO_ALLOWED_HOSTS` (replaces
the nip.io host).
