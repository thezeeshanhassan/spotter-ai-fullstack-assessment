# Deploy — Backend on AWS EC2 (Docker), Frontend on Vercel

Goal: an **always-on** backend (no Render cold start) with **HTTPS** so the Vercel
frontend can call it. The backend runs in Docker behind **Caddy**, which obtains a
free Let's Encrypt certificate automatically.

> **Why HTTPS is mandatory:** the Vercel site is served over HTTPS. Browsers block
> an HTTPS page from calling an HTTP API ("mixed content"). The backend must be
> HTTPS — that's what Caddy + a domain give you.

---

## What you need
- An AWS account (EC2 `t3.micro`/`t2.micro` is free for 12 months, always-on).
- A domain or subdomain you can point at the server (e.g. `api.yourdomain.com`).
  No paid domain? See **No-domain options** at the bottom.
- Your OpenRouteService API key.

---

## 1. Launch the EC2 instance
1. EC2 → Launch instance → **Ubuntu 24.04 LTS**, type **t3.micro** (free tier).
2. Create/download a key pair (for SSH).
3. **Security group** inbound rules:
   - SSH `22` (your IP only)
   - HTTP `80` (anywhere) — needed for the TLS challenge
   - HTTPS `443` (anywhere)
4. Launch, then note the **public IPv4 address**.

## 2. Point your domain at it
Create a DNS **A record**: `api.yourdomain.com → <EC2 public IP>`.
Wait for it to resolve (`ping api.yourdomain.com`).

## 3. Install Docker on the instance
SSH in (`ssh -i key.pem ubuntu@<IP>`), then:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu && newgrp docker
```

## 4. Get the code + configure
```bash
git clone <your-repo-url> app && cd app
git checkout main            # or the deployed branch
nano backend/.env            # create the production env (below)
nano Caddyfile               # replace api.example.com with your domain
```

`backend/.env` (production):
```
DJANGO_SECRET_KEY=<a long random string>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.yourdomain.com
CORS_ALLOWED_ORIGINS=https://<your-app>.vercel.app
CSRF_TRUSTED_ORIGINS=https://<your-app>.vercel.app
ORS_API_KEY=<your OpenRouteService key>
```

## 5. Build & run
```bash
docker compose up -d --build
docker compose logs -f caddy   # watch the certificate get issued
```
Verify: `https://api.yourdomain.com/api/health/` → `{"status":"ok"}`.

SQLite is stored in the `dbdata` Docker volume, so it **persists** across restarts
and redeploys.

## 6. Point the frontend at it (Vercel)
In the Vercel project settings → Environment Variables:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```
Redeploy the frontend. Done — no cold starts.

---

## Updating later
```bash
cd app && git pull
docker compose up -d --build
```
Migrations run automatically on container start.

## Useful commands
```bash
docker compose ps             # status
docker compose logs -f backend
docker compose restart backend
docker compose down           # stop (volume/data kept)
```

---

## No-domain options
If you don't want to buy a domain:
- **DuckDNS (free):** register `something.duckdns.org`, set its IP to the EC2 IP,
  put that hostname in `Caddyfile` and `DJANGO_ALLOWED_HOSTS`. Caddy issues a
  Let's Encrypt cert for it over HTTP — works the same.
- **Cloudflare Tunnel (free):** run `cloudflared` to expose the backend over an
  HTTPS `*.trycloudflare.com` (or your Cloudflare domain) without opening 80/443 or
  managing certs. Then drop Caddy and point Vercel at the tunnel URL.

Either gives the HTTPS the frontend requires.
