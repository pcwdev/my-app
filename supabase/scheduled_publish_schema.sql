-- 1) 예약 원본 큐
create table if not exists public.seed_content_queue (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('post', 'comment')),
  post_id bigint null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'published', 'failed')),
  published_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seed_content_queue_due
  on public.seed_content_queue (status, scheduled_at);

-- 2) 발행 로그
create table if not exists public.scheduled_publish_log (
  id bigint generated always as identity primary key,
  queue_id bigint not null references public.seed_content_queue(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_post_id bigint null,
  target_comment_id bigint null,
  status text not null check (status in ('published', 'failed')),
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_scheduled_publish_log_queue_id
  on public.scheduled_publish_log (queue_id, created_at desc);

-- 3) updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_seed_content_queue_updated_at on public.seed_content_queue;
create trigger trg_seed_content_queue_updated_at
before update on public.seed_content_queue
for each row
execute function public.set_updated_at();
