# LectrFlow Architecture

Hackathon MVP. Keep it simple: one Next.js app, one Supabase project.

## Stack

- **Next.js 16** (App Router, TypeScript) — UI and API route handlers in one app.
- **Supabase** — Postgres, Auth (lecturers), Storage (slide images), Realtime Broadcast.
- **Gemini** (REST, optional) behind `src/lib/ai/provider.ts`.
- **Tailwind CSS v4** for styling; **zod** for request validation; **vitest** for unit tests.

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

## Frontend

Pages (client components using `src/lib/client/*` to call the API):

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | everyone | Choose student or lecturer |
| `/lecturer` | lecturer | List lectures, create the demo lecture |
| `/lecturer/[lectureId]` | lecturer | Live console: slides, lifecycle, students, confusion meter, questions; AI insight report after ending |
| `/join` (`?code=`) | student | Join with code + display name |
| `/lecture/[lectureId]` | student | Live slide, notes, "I'm confused", ask lecturer, private Lecture AI |

- Lecturer API calls send the Supabase access token as `Authorization: Bearer`; the session is an
  anonymous Supabase session created on first visit (no sign-in UI in the MVP).
- Live updates come from the realtime channels in `docs/API.md`; pages also poll as a fallback.
- The demo lecture is built in the browser (`src/lib/client/demo-lecture.ts`): slides are drawn on a
  canvas and uploaded as PNGs through the normal slide upload endpoint.
- Styling: Tailwind CSS v4.
