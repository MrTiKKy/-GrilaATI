# Grila ATI

Programare lunară ATI/anestezie — Next.js App Router + Neon Postgres (`@neondatabase/serverless`).

## Setup local

1. Pentru dezvoltare pe branch Neon (recomandat):
   - `.env` — baza principală (doar referință / SELECT)
   - `.env.local` — `DATABASE_URL` = branch Neon + `SESSION_SECRET` (copiat din `.env`)
   - Înainte de orice scriere SQL sau `npm run dev`: `node scripts/check-db-target.mjs`

2. Seed user **doar pe branch**:

```bash
node --env-file=.env.local scripts/seed-user.mjs emailul-tau@domeniu.ro 'ParolaTa'
```

3. Workspaces (multi-tenant) — pe branch Neon:

```bash
node --env-file=.env.local scripts/run-add-workspaces.mjs
```

Documentație: `sql/add_workspaces.sql`. Scripturile vechi din `sql/` (`ore_osd.sql`, `grafic_footer.sql`, `add_foi.sql`, etc.) sunt **istorice** și nu mai sunt compatibile cu cheile care includ `workspace_id`.

4. Instalează și pornește:

```bash
npm install
node scripts/check-db-target.mjs
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000) → redirect la `/login`.

## Securitate (v1)

| Măsură | Detalii |
|--------|---------|
| Auth | Email + parolă (tabel `users`, bcrypt) + cookie JWT HttpOnly (`jose`, 7 zile) |
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
