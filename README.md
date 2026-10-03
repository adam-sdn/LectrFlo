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

For a hosted Supabase project, apply `supabase/migrations/` with `npx supabase db push`.
Set `GEMINI_API_KEY` to enable Lecture AI, objective extraction, recaps and reports; without it
those endpoints return `503 ai_unavailable` and everything else works.

## Checks

```bash
npm run lint
npm run typecheck
npm test                          # unit tests
npm run build
node scripts/smoke-test.mjs       # end-to-end API test; see the header of the file for env vars
```
