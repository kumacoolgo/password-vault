# Password Vault (Next.js + Upstash + Zeabur)

A simple self-hosted password manager web app:
- One admin login (username/password in env)
- CRUD items stored in Upstash Redis (password encrypted at rest via AES-256-GCM)
- Responsive (desktop table + mobile cards + mobile editor modal)
- Cookie-based session (signed), protected via middleware
- Search filter + one-click copy + generate random password
- Basic rate limiting for login + API (Upstash Ratelimit)

## Local dev
```bash
npm install
cp .env.example .env.local
# fill env values
npm run dev
```

## Deploy (Zeabur)
- Connect GitHub repo
- Set env vars (see .env.example)
- Deploy

Notes:
- `ENCRYPTION_KEY` should remain stable. If you change it, previously stored encrypted passwords cannot be decrypted.
