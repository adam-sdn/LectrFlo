-- LectrFlow MVP schema.
-- All application writes go through Next.js route handlers using the service role,
-- which enforce lecturer ownership and student participant tokens. RLS is enabled
-- on every table; the only client-facing policies are read-only for lecturers.

create type public.lecture_status as enum ('draft', 'lobby', 'live', 'ended');
create type public.question_status as enum ('open', 'answered', 'dismissed');
create type public.ai_message_role as enum ('student', 'assistant');
create type public.ai_job_status as enum ('pending', 'complete', 'failed');
create type public.ai_report_kind as enum ('student_recap', 'lecturer_insight');
create type public.objective_source as enum ('lecturer', 'ai');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Lectures -------------------------------------------------------------------

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  lecturer_id uuid not null references auth.users (id) on delete cascade,
  lecturer_name text check (char_length(lecturer_name) <= 120),
  title text not null check (char_length(title) between 1 and 200),
  module text check (char_length(module) <= 200),
  description text check (char_length(description) <= 2000),
  join_code text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- Secret suffix for the lecturer-only realtime channel.
  host_channel_key text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status public.lecture_status not null default 'draft',
  current_slide integer not null default 1 check (current_slide >= 1),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lectures_lecturer_id_idx on public.lectures (lecturer_id, created_at desc);

create trigger lectures_set_updated_at
before update on public.lectures
for each row execute function public.set_updated_at();

create table public.lecture_slides (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  slide_number integer not null check (slide_number >= 1),
  storage_path text not null,
  mime_type text not null,
  -- Optional slide text used as AI context.
  text_content text check (char_length(text_content) <= 20000),
  created_at timestamptz not null default now(),
  unique (lecture_id, slide_number)
);

create table public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  position integer not null check (position >= 1),
  text text not null check (char_length(text) between 1 and 500),
  source public.objective_source not null default 'lecturer',
  created_at timestamptz not null default now(),
  unique (lecture_id, position)
);

-- Students -------------------------------------------------------------------

create table public.lecture_participants (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  -- sha256 of the opaque session token held in the student's httpOnly cookie.
  token_hash text not null unique,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (id, lecture_id)
);

create index lecture_participants_lecture_idx on public.lecture_participants (lecture_id, joined_at);

create table public.student_notes (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null,
  participant_id uuid not null unique,
  content text not null default '' check (char_length(content) <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (participant_id, lecture_id)
    references public.lecture_participants (id, lecture_id) on delete cascade
);

create trigger student_notes_set_updated_at
before update on public.student_notes
for each row execute function public.set_updated_at();

create table public.slide_annotations (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null,
  participant_id uuid not null,
  slide_number integer not null check (slide_number >= 1),
  content text not null check (char_length(content) between 1 and 5000),
  -- Optional pin position on the slide, as fractions of width/height.
  x real check (x between 0 and 1),
  y real check (y between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (participant_id, lecture_id)
    references public.lecture_participants (id, lecture_id) on delete cascade
);

create index slide_annotations_participant_idx
  on public.slide_annotations (participant_id, slide_number, created_at);

create trigger slide_annotations_set_updated_at
before update on public.slide_annotations
for each row execute function public.set_updated_at();

create table public.student_questions (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null,
  participant_id uuid not null,
  slide_number integer check (slide_number >= 1),
  body text not null check (char_length(body) between 1 and 1000),
  status public.question_status not null default 'open',
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  foreign key (participant_id, lecture_id)
    references public.lecture_participants (id, lecture_id) on delete cascade
);

create index student_questions_lecture_idx on public.student_questions (lecture_id, created_at);
create index student_questions_participant_idx on public.student_questions (participant_id, created_at);

create table public.confusion_signals (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null,
  participant_id uuid not null,
  slide_number integer not null check (slide_number >= 1),
  created_at timestamptz not null default now(),
  foreign key (participant_id, lecture_id)
    references public.lecture_participants (id, lecture_id) on delete cascade
);

create index confusion_signals_lecture_idx on public.confusion_signals (lecture_id, created_at);
create index confusion_signals_participant_idx on public.confusion_signals (participant_id, created_at desc);

-- AI -------------------------------------------------------------------------

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null,
  participant_id uuid not null,
  role public.ai_message_role not null,
  content text not null check (char_length(content) between 1 and 20000),
  slide_number integer check (slide_number >= 1),
  status public.ai_job_status not null default 'complete',
  error text,
  created_at timestamptz not null default now(),
  foreign key (participant_id, lecture_id)
    references public.lecture_participants (id, lecture_id) on delete cascade
);

create index ai_messages_participant_idx on public.ai_messages (participant_id, created_at);

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  -- Null for lecture-level reports (lecturer insight).
  participant_id uuid references public.lecture_participants (id) on delete cascade,
  kind public.ai_report_kind not null,
  status public.ai_job_status not null default 'pending',
  content jsonb,
  error text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (lecture_id, kind, participant_id),
  check ((kind = 'student_recap') = (participant_id is not null))
);

create trigger ai_reports_set_updated_at
before update on public.ai_reports
for each row execute function public.set_updated_at();

-- Row level security ---------------------------------------------------------

alter table public.lectures enable row level security;
alter table public.lecture_slides enable row level security;
alter table public.learning_objectives enable row level security;
alter table public.lecture_participants enable row level security;
alter table public.student_notes enable row level security;
alter table public.slide_annotations enable row level security;
alter table public.student_questions enable row level security;
alter table public.confusion_signals enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_reports enable row level security;

create policy "Lecturers read their lectures"
  on public.lectures for select to authenticated
  using (lecturer_id = (select auth.uid()));

create policy "Lecturers read their slides"
  on public.lecture_slides for select to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = lecture_id and l.lecturer_id = (select auth.uid())
  ));

create policy "Lecturers read their objectives"
  on public.learning_objectives for select to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = lecture_id and l.lecturer_id = (select auth.uid())
  ));

create policy "Lecturers read their questions"
  on public.student_questions for select to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = lecture_id and l.lecturer_id = (select auth.uid())
  ));

create policy "Lecturers read their lecture reports"
  on public.ai_reports for select to authenticated
  using (
    kind = 'lecturer_insight'
    and exists (
      select 1 from public.lectures l
      where l.id = lecture_id and l.lecturer_id = (select auth.uid())
    )
  );

-- Storage --------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lecture-slides',
  'lecture-slides',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
