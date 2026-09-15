# Grila ATI

Programare lunară pentru o secție ATI/anestezie (Next.js App Router + Prisma + PostgreSQL pe Neon).

## Setup local

1. Copiază variabilele de mediu:

```bash
cp .env.example .env
```

2. Conectează Neon: în [Neon Console](https://console.neon.tech) creează un proiect, copiază connection string-ul și pune-l în `.env` ca `DATABASE_URL`.

3. Instalează dependențele, generează clientul Prisma și aplică migrările:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

La `prisma:migrate` ți se cere un nume de migrare (ex. `init`).

4. Pornește app-ul:

```bash
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000).

## Scripturi Prisma

| Script | Comandă |
|--------|---------|
| Generează clientul | `npm run prisma:generate` |
| Migrări (dev) | `npm run prisma:migrate` |
| Studio (UI DB) | `npm run prisma:studio` |

## Model date

- **Staff** — personal (`nume`, `zileCoRamase`)
- **Programare** — casuță pe zi (`valoare`: `reanim` \| `anest` \| `co` \| `cm`, extensibil), unic pe `(staffId, data)`
