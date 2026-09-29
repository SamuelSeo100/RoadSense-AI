-- User profile + travel preferences (feeds the ML route ranker).
-- One row per auth user, created automatically by a trigger on sign-up.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  email text,
  city text not null default 'pune',
  preferred_modes text[] not null default '{}'
    check (preferred_modes <@ array['bus', 'metro', 'train', 'auto', 'cab', 'bike', 'walk']),
  priority text
    check (priority in ('cheapest', 'fastest', 'least_walking', 'fewest_transfers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'RoadSense user profile and route-ranking preferences.';

-- RLS: users can only see and edit their own row. Rows are inserted by the
-- trigger below (security definer), so there is no insert policy for clients.
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile from sign-up metadata (options.data in supabase.auth.signUp).
-- Metadata is client-controlled, so every value is sanitised: invalid values are
-- dropped instead of failing the sign-up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  modes text[];
begin
  select coalesce(array_agg(distinct m), '{}')
    into modes
    from jsonb_array_elements_text(
      case when jsonb_typeof(meta -> 'preferred_modes') = 'array'
           then meta -> 'preferred_modes' else '[]'::jsonb end
    ) as m
   where m in ('bus', 'metro', 'train', 'auto', 'cab', 'bike', 'walk');

  insert into public.profiles (id, name, phone, email, city, preferred_modes, priority)
  values (
    new.id,
    left(coalesce(meta ->> 'name', ''), 100),
    case when meta ->> 'phone' ~ '^[6-9][0-9]{9}$' then meta ->> 'phone' end,
    new.email,
    case when meta ->> 'city' in ('pune', 'pimpri-chinchwad') then meta ->> 'city' else 'pune' end,
    modes,
    case when meta ->> 'priority' in ('cheapest', 'fastest', 'least_walking', 'fewest_transfers')
         then meta ->> 'priority' end
  );
  return new;
end;
$$;

-- Only the auth trigger may call this.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
