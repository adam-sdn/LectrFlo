# LectrFlow Architecture

Hackathon MVP. Keep it simple: one Next.js app, one Supabase project.

## Stack

- **Next.js 16** (App Router, TypeScript) — UI and API route handlers in one app.
- **Supabase** — Postgres, Auth (lecturers), Storage (slide images), Realtime Broadcast.
- **Gemini** (REST, optional) behind `src/lib/ai/provider.ts`.
- **zod** for request validation; **vitest** for unit tests.

## Principles

- Lecturer = class-level intelligence. Student = personal learning.
- The browser never writes to the database directly. All mutations go through
  `src/app/api/**` route handlers, which validate input and enforce ownership.
- Students are anonymous per-lecture sessions (join code + display name → httpOnly cookie).
- The lecturer sees aggregate confusion and anonymous questions, never which student did what.
- Realtime is a notification layer; REST endpoints are the source of truth.

## Layout

```
src/
  app/api/
    lectures/...              lecturer endpoints (Supabase Auth)
    join/...                  join-code resolution and joining
    student/lectures/[id]/... student endpoints (participant cookie)
  lib/
    types.ts                  shared API/domain types (the frontend contract)
    validation.ts             zod request schemas
    api.ts                    route wrapper, errors, DB result helpers
    auth.ts                   requireLecturer / requireOwnedLecture / requireParticipant
    lectures.ts, join.ts, student-activity.ts   data access
    lifecycle.ts, limits.ts, join-code.ts, confusion.ts   pure rules
    storage.ts                slide storage and signed URLs
    realtime.ts               channel names + event payload types (shared)
    realtime-server.ts        server-side broadcast
    realtime-client.ts        browser subscription helper
    ai/                       provider, prompts, report runner
    supabase/                 admin (service role), server (cookie auth), browser clients
supabase/migrations/          schema
scripts/smoke-test.mjs        end-to-end API test
```

## Environment

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only.

## Frontend contract

Build UI against `docs/API.md` and the types in `src/lib/types.ts`. Suggested pages (not yet built):
student join `/join` and `/join/[code]` (QR target), student lecture `/lecture/[lectureId]`,
recap `/lecture/[lectureId]/recap`, lecturer dashboard `/lecturer/...`.
