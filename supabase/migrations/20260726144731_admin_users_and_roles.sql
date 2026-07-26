create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'manager', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;

create policy admin_users_select_own
on public.admin_users
for select
to authenticated
using (user_id = auth.uid() and is_active);

revoke all on table public.admin_users from public, anon, authenticated;
grant select (user_id, display_name, role, is_active) on table public.admin_users to authenticated;
grant all on table public.admin_users to service_role;
