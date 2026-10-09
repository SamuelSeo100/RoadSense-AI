-- AI Mode (parse-trip edge function): query log and per-user rate limit.

-- ---------------------------------------------------------------------------
-- ai_queries: one row per parse. With "Learn from my trips" off only the
-- usage is kept (text and result are null).
create table public.ai_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  text text check (text is null or length(text) <= 500),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  status text not null check (status in ('ok', 'clarify', 'error', 'timeout')),
  model text not null check (length(model) <= 100),
  latency_ms integer check (latency_ms >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0)
);

comment on table public.ai_queries is
  'AI Mode parses: text + result (only with learnFromTrips on), latency, token usage.';

create index ai_queries_user_created_idx on public.ai_queries (user_id, created_at desc);

alter table public.ai_queries enable row level security;

create policy "Users can view own AI queries"
  on public.ai_queries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own AI queries"
  on public.ai_queries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own AI queries"
  on public.ai_queries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- ai_rate_limits: calls per user per clock hour. No policies: only the
-- security-definer function below touches it, so users can't reset it.
create table public.ai_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  calls integer not null default 0 check (calls >= 0),
  primary key (user_id, window_start)
);

alter table public.ai_rate_limits enable row level security;

-- Counts one call for the caller; true while they're within 30 this hour.
create function public.ai_rate_limit_hit()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  this_hour timestamptz := date_trunc('hour', now());
  n integer;
begin
  if uid is null then
    return false;
  end if;
  insert into public.ai_rate_limits (user_id, window_start, calls)
  values (uid, this_hour, 1)
  on conflict (user_id, window_start)
    do update set calls = public.ai_rate_limits.calls + 1
  returning calls into n;
  delete from public.ai_rate_limits where user_id = uid and window_start < this_hour;
  return n <= 30;
end;
$$;

revoke execute on function public.ai_rate_limit_hit() from public, anon;
grant execute on function public.ai_rate_limit_hit() to authenticated;
