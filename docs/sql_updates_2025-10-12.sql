-- Items: add status and discounts
alter table public.items add column if not exists status text not null default 'active' check (status in ('active','inactive','archived'));
alter table public.items add column if not exists discount_type text not null default 'none' check (discount_type in ('none','percent','fixed'));
alter table public.items add column if not exists discount_value numeric(10,2) not null default 0 check (discount_value >= 0);

-- Enforce sell >= purchase at DB level
alter table public.items drop constraint if exists sell_ge_purchase;
alter table public.items add constraint sell_ge_purchase check (sell_price >= purchase_price);

-- Reservations: add timestamps for audit and countdown
alter table public.reservations add column if not exists created_at timestamptz not null default now();
alter table public.reservations add column if not exists expires_at timestamptz;

-- Optional logs
create table if not exists public.restocks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  quantity int not null check (quantity > 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  item_id uuid not null references public.items(id),
  quantity int not null,
  price_at_purchase numeric(10,2) not null,
  discount_type text not null default 'none',
  discount_value numeric(10,2) not null default 0
);
