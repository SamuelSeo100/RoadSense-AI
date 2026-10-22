-- The user's own car / scooty, for "Your scooty · ₹X fuel" route costs
-- (distance / efficiency × price). At most one car and one scooter per user.
-- Own rows only (select / insert / update / delete); unlike the logging tables
-- these are edited in place.

create table public.user_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  type text not null check (type in ('car', 'scooter')),
  nickname text check (length(nickname) <= 40),
  fuel_type text not null check (fuel_type in ('petrol', 'diesel', 'cng', 'electric')),
  efficiency numeric(6, 2) not null check (efficiency > 0 and efficiency < 1000),
  efficiency_unit text not null check (efficiency_unit in ('km_per_l', 'km_per_kg', 'km_per_kwh')),
  -- ₹ per L / kg / kWh; null = the app's Pune default.
  price_override numeric(7, 2) check (price_override is null or price_override > 0),
  is_default boolean not null default true,
  -- Unit matches the fuel; no CNG scooters.
  check (
    (fuel_type in ('petrol', 'diesel') and efficiency_unit = 'km_per_l')
    or (fuel_type = 'cng' and efficiency_unit = 'km_per_kg')
    or (fuel_type = 'electric' and efficiency_unit = 'km_per_kwh')
  ),
  check (not (type = 'scooter' and fuel_type = 'cng'))
);

comment on table public.user_vehicles is
  'User''s own car / scooter (max one each) for own-vehicle route costs.';

-- Max 1 car + 1 scooter per user.
create unique index user_vehicles_user_type_idx on public.user_vehicles (user_id, type);

alter table public.user_vehicles enable row level security;

create policy "Users can view own vehicles"
  on public.user_vehicles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own vehicles"
  on public.user_vehicles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update own vehicles"
  on public.user_vehicles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own vehicles"
  on public.user_vehicles for delete to authenticated
  using ((select auth.uid()) = user_id);
