# Password Vault (Next.js + Upstash + Zeabur)

A simple self-hosted password manager web app:
- One admin login (username/password in env)
- CRUD items stored in Upstash Redis
- Responsive (desktop table + mobile cards)
- Cookie-based session (signed), protected via middleware

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
