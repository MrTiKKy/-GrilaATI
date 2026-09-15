# Grila ATI

Programare lunară ATI/anestezie — Next.js App Router + Neon Postgres (`@neondatabase/serverless`).

## Setup local

1. Copiază variabilele de mediu:

```bash
cp .env.example .env
```

2. Pune connection string-ul Neon în `.env` ca `DATABASE_URL`.

3. Tabelele `angajati` și `programari` trebuie să existe deja în Neon (create din SQL Editor).

4. Instalează și pornește:

```bash
npm install
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000).

## API

| Metodă | Rută | Rol |
|--------|------|-----|
| GET | `/api/luna?an=2026&luna=9` | Angajați + programări lună (+ sold CO) |
| GET | `/api/concedii?an=2026` | Sold CO pe angajat |
| PATCH | `/api/angajati/[id]/concediu` | Setează `zile_co_an` |
| POST | `/api/angajati` | Adaugă angajat |
| DELETE | `/api/angajati/[id]` | Soft delete (`activ=false`) |
| PUT | `/api/angajati/ordine` | Reordonare |
| PUT | `/api/programari` | Upsert / delete casuță |

Pagină UI: [/concedii](/concedii) — alocare zile CO.

## Export PDF test + arhivă

1. Rulează o dată în Neon: `sql/grafice_finale.sql`
2. Din grilă apasă **Export PDF test** → descarcă PDF **și** salvează snapshot în `grafice_finale`
3. Deschide [/istoric](/istoric) — salvările sunt grupate pe lună
4. **Generează PDF din nou** regeneră PDF-ul din snapshot-ul arhivat (nu din starea live)

Font: **DejaVu Serif** (în `public/fonts/`) — serif ca Times, cu diacritice RO (ĂÂÎȘȚ).  
Paginare: max. **28 angajați / pagină**; restul pe pagini următoare (același header/footer).

## Note

- Celulă goală (fără valoare și fără ciornă) → `DELETE` din `programari`
- Valori oficiale: `1`, `2`, `1/3`, `2*`, `L`, `CO`, `CM`
- **Secție A sau R** (coloana `ciorna`) — pe casuță lângă schimb, exclusiv una; nu apare la print
- Dacă lipsește coloana: rulează `sql/add_ciorna.sql` în Neon SQL Editor
