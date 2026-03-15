alter table if exists public.users
  add column if not exists status text not null default 'pending';

update public.users
set status = case
  when is_admin = true then 'accepted'
  when is_approved = true then 'accepted'
  else 'pending'
end
where status is null or status not in ('pending', 'accepted', 'rejected');

alter table if exists public.users
  drop constraint if exists users_status_check;

alter table if exists public.users
  add constraint users_status_check
  check (status in ('pending', 'accepted', 'rejected'));

create table if not exists public.documents (
  id uuid primary key,
  filename text not null,
  mime_type text,
  size bigint,
  storage_path text not null,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'active',
  chunk_count integer not null default 0,
  category text not null default 'general'
);

create index if not exists documents_uploaded_at_idx on public.documents (uploaded_at desc);
create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_category_idx on public.documents (category);
