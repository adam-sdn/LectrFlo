# LectrFlow Database

Supabase Postgres. Schema lives in `supabase/migrations/`; never edit the database by hand.

## Tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `lectures` | A lecture owned by a lecturer (`auth.users`) | `join_code` (unique, 6 chars `[A-HJ-NP-Z2-9]`), `host_channel_key` (secret), `status` (`draft`/`lobby`/`live`/`ended`), `current_slide`, `started_at`, `ended_at` |
| `lecture_slides` | One image per slide in the `lecture-slides` bucket | `slide_number` (unique per lecture), `storage_path`, `mime_type`, `text_content` (optional AI context) |
| `learning_objectives` | Ordered objectives | `position`, `text`, `source` (`lecturer`/`ai`) |
| `lecture_participants` | A student session in one lecture (no account) | `display_name`, `token_hash` (sha256 of cookie token), `joined_at`, `last_seen_at` |
| `student_notes` | One notes document per participant | `content`, `updated_at` |
| `slide_annotations` | Student annotations on a slide | `slide_number`, `content`, optional `x`/`y` pin (0–1) |
| `student_questions` | "Ask Lecturer" questions | `slide_number`, `body`, `status` (`open`/`answered`/`dismissed`) |
| `confusion_signals` | "I'm confused" taps | `slide_number`, `created_at` |
| `ai_messages` | Private Lecture AI chat | `role` (`student`/`assistant`), `content`, `status` (`pending`/`complete`/`failed`) |
| `ai_reports` | Generated recaps/reports | `kind` (`student_recap` per participant, `lecturer_insight` per lecture), `status`, `content` (jsonb) |

Student-owned tables carry both `lecture_id` and `participant_id` with a composite foreign key
to `lecture_participants (id, lecture_id)`, so a row can never point at a participant from a
different lecture. Deleting a lecture cascades to everything.

## Access model

- All reads and writes from the app go through route handlers using the **service role**
  (`src/lib/supabase/admin.ts`), which bypasses RLS. Every handler enforces ownership:
  `requireOwnedLecture` (lecturer owns lecture) or `requireParticipant` (cookie token → participant,
  and every query filters by that participant).
- **RLS is enabled on every table.** The only policies are read-only `select` policies for the
  owning lecturer on `lectures`, `lecture_slides`, `learning_objectives`, `student_questions` and
  the `lecturer_insight` report. Students' notes, annotations, AI chats and recaps have no
  client-facing policies at all. The anon role can read nothing.
- Storage bucket `lecture-slides` is private (PNG/JPEG/WebP, 10 MB). Images are served via
  short-lived signed URLs (1 hour).

## Local development

```bash
npx supabase start          # needs Docker; applies migrations
npx supabase status -o env  # URL and keys for .env.local
npx supabase db reset       # re-apply migrations from scratch
```

Add schema changes as a new timestamped file in `supabase/migrations/`.
