# Grila ATI

Programare lunară ATI/anestezie — Next.js App Router + Neon Postgres (`@neondatabase/serverless`).

## Setup local

1. Copiază variabilele de mediu:

```bash
cp .env.example .env
```

2. Completează în `.env`:
   - `DATABASE_URL` — connection string Neon
   - `APP_PASSWORD` — parola / PIN de secție
   - `SESSION_SECRET` — secret cookie (≥16 caractere; `openssl rand -hex 32`)

3. Rulează o dată în Neon SQL Editor (dacă lipseau):
   - `sql/grafice_finale.sql`
   - `sql/add_ciorna.sql`
   - `sql/audit_log.sql`

4. Instalează și pornește:

```bash
npm install
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000) → redirect la `/login`.

## Securitate (v1)

| Măsură | Detalii |
|--------|---------|
| Auth | Parolă de secție + cookie JWT HttpOnly (`jose`, 12h) |
| Middleware | Protejează pagini + `/api/*` (except `/login`, `/api/auth/login`) |
| Snapshot PDF | Construit pe server din DB la `POST /api/grafice` |
| Rate limit | In-memory pe IP (scrieri / citiri / login) |
| Validare | UUID, an/lună, lungimi string, body max size |
| Headers | CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS (prod) |
| Audit | Tabel `audit_log` pentru login, CRUD, export/ștergere arhivă |

## API

| Metodă | Rută | Rol |
|--------|------|-----|
| POST | `/api/auth/login` | Login (public, rate-limited) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/luna?an=&luna=` | Angajați + programări lună |
| GET | `/api/concedii?an=` | Sold CO |
| PATCH | `/api/angajati/[id]/concediu` | Setează `zile_co_an` |
| POST | `/api/angajati` | Adaugă angajat |
| DELETE | `/api/angajati/[id]` | Soft delete |
| PUT | `/api/angajati/ordine` | Reordonare |
| PUT | `/api/programari` | Upsert / delete casuță |
| GET/POST | `/api/grafice` | Listă / salvare snapshot server |
| GET/DELETE | `/api/grafice/[id]` | Detaliu / ștergere arhivă |

## Export PDF + arhivă

1. Din grilă: **Export PDF test** → server construiește snapshot din Neon, salvează în `grafice_finale`, client descarcă PDF
2. [/istoric](/istoric) — regenerare din snapshot arhivat

Font: **DejaVu Serif** (`public/fonts/`). Max. **28 angajați / pagină**.
