# LectrFlow

Agentic AI university lecture platform. Lecturers run live lectures; students join with a code,
follow the slides, take private notes and annotations, signal confusion, ask the lecturer or a
private Lecture AI tutor, and get a personal recap afterwards.

- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- API contract: [`docs/API.md`](docs/API.md) (types in `src/lib/types.ts`)
- Database: [`docs/DATABASE.md`](docs/DATABASE.md)
- Multi-agent rules: [`AGENTS.md`](AGENTS.md)

## Setup

Requires Node 20.9+ and, for local Supabase, Docker.

```bash
npm install
npx supabase start                # local Postgres/Auth/Storage/Realtime, applies migrations
cp .env.example .env.local        # fill in from `npx supabase status -o env` (or a hosted project)
npm run dev
```

For a hosted Supabase project:

1. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`,
   or paste the **whole** of `supabase/migrations/20261003000000_init.sql` into the SQL Editor and
   run it. It is safe to run again and ends with a check that should show `true` on every row.
   `/api/health?write=1` on the deployed app reports anything still missing.
2. Enable **Authentication → Sign In / Providers → Allow anonymous sign-ins**. The MVP has no
   lecturer sign-in screen; `/lecturer` uses an anonymous Supabase session, and each browser owns
   the lectures it creates.
3. Put the project URL, publishable (anon) key and secret (service role) key in `.env.local`.

Set `GEMINI_API_KEY` to enable Lecture AI, objective extraction, recaps and reports; without it
those endpoints return `503 ai_unavailable` and everything else works.

## Demo

1. Lecturer: open `/lecturer` → **Create demo lecture** (Calculus 101 — Differentiation) →
   **Open lobby**. The join code is shown on the console.
2. Students: open `/join` (or `/join?code=ABC234`), enter the code and a name.
3. Lecturer: **Start lecture**, move with **Next/Previous** or the arrow keys. Watch students
   connect, the "I'm confused" meter and anonymous questions update live.
4. Students: take notes (autosaved, private), press **I'm confused**, ask the lecturer, ask
   Lecture AI (private to each student).
5. Lecturer: **End lecture** → the AI insight report is generated.

## Checks

```bash
npm run lint
npm run typecheck
npm test                          # unit tests
npm run build
node scripts/smoke-test.mjs       # end-to-end API test; see the header of the file for env vars
```
