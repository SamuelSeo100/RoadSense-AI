-- Saved places (Profile › Saved places): Home, College, Work plus up to 5
-- custom labels per user. The app mirrors them on the device for offline use.
--
-- Coordinates are numeric(…, 5) (~1 m): enough to route to the right gate,
-- unlike the 4 dp used for trip logs. Users can read, insert, update and
-- delete only their own rows.

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 40),
  name text not null check (length(name) between 1 and 200),
  lat numeric(7, 5) not null check (lat between -90 and 90),
  lng numeric(8, 5) not null check (lng between -180 and 180),
  -- Google Places id (null for places picked without one).
  place_id text check (place_id is null or length(place_id) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, label)
);

comment on table public.saved_places is
  'User saved places (Home, College, Work + up to 5 custom). Coordinates rounded to 5 dp.';

create trigger saved_places_set_updated_at
  before update on public.saved_places
  for each row execute function public.set_updated_at();

-- At most 8 places per user (3 fixed + 5 custom). Rows with the same label
-- don't count: an upsert that updates one still fires the insert trigger.
create function public.saved_places_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.saved_places
    where user_id = new.user_id and label <> new.label
  ) >= 8 then
    raise exception 'saved place limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger saved_places_limit
  before insert on public.saved_places
  for each row execute function public.saved_places_limit();

-- RLS: own rows only.
alter table public.saved_places enable row level security;

create policy "Users can view own saved places"
  on public.saved_places for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own saved places"
  on public.saved_places for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update own saved places"
  on public.saved_places for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own saved places"
  on public.saved_places for delete to authenticated
  using ((select auth.uid()) = user_id);
