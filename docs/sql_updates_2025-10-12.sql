-- Bootstrap: create required tables and helpers if they don't exist yet
-- Safe to run multiple times.

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Items base table (minimal columns; later ALTERs below will add extra fields)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  purchase_price numeric(10,2) not null default 0 check (purchase_price >= 0),
  sell_price     numeric(10,2) not null default 0 check (sell_price >= 0),
  total_quantity int not null default 0 check (total_quantity >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  image_url text,
  description text,
  restock_threshold int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Computed available quantity (if not present yet)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='items' and column_name='available_quantity'
  ) then
    execute 'alter table public.items add column available_quantity int generated always as (greatest(total_quantity - reserved_quantity, 0)) stored';
  end if;
end $$;

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.items;
create trigger set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists items_name_trgm_idx on public.items using gin (name gin_trgm_ops);

-- RLS for items
alter table public.items enable row level security;
drop policy if exists "Public read items" on public.items;
create policy "Public read items"
  on public.items for select
  to anon, authenticated
  using (true);

-- Reservations base table
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, item_id)
);

-- Indexes
create index if not exists reservations_user_id_idx on public.reservations (user_id);
create index if not exists reservations_item_id_idx on public.reservations (item_id);

-- RLS: users can manage own reservations; admin can read all
alter table public.reservations enable row level security;
drop policy if exists "User can read own reservations" on public.reservations;
create policy "User can read own reservations"
  on public.reservations for select to authenticated using (user_id = auth.uid());
drop policy if exists "User can insert own reservations" on public.reservations;
create policy "User can insert own reservations"
  on public.reservations for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "User can update own reservations" on public.reservations;
create policy "User can update own reservations"
  on public.reservations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "User can delete own reservations" on public.reservations;
create policy "User can delete own reservations"
  on public.reservations for delete to authenticated using (user_id = auth.uid());
drop policy if exists "Admin can read all reservations" on public.reservations;
create policy "Admin can read all reservations"
  on public.reservations for select to authenticated using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'),'') = 'admin');

-- RPC helper: safely adjust reserved qty
create or replace function public.increment_reserved_quantity(p_item_id uuid, p_delta int)
returns table (
  id uuid,
  reserved_quantity int,
  total_quantity int,
  available_quantity int
)
language plpgsql security definer set search_path = public as $$
declare v_record public.items%rowtype; begin
  select * into v_record from public.items where id = p_item_id for update;
  if not found then raise exception 'item not found'; end if;
  if p_delta = 0 then
    return query select v_record.id, v_record.reserved_quantity, v_record.total_quantity,
      greatest(v_record.total_quantity - v_record.reserved_quantity, 0)::int;
    return; end if;
  if p_delta > 0 and v_record.reserved_quantity + p_delta > v_record.total_quantity then
    raise exception 'insufficient available quantity'; end if;
  if p_delta < 0 and v_record.reserved_quantity + p_delta < 0 then
    raise exception 'reserved cannot go below zero'; end if;
  update public.items set reserved_quantity = v_record.reserved_quantity + p_delta where id = p_item_id
  returning id, reserved_quantity, total_quantity, greatest(total_quantity - reserved_quantity, 0)::int;
end; $$;
grant execute on function public.increment_reserved_quantity(uuid, int) to authenticated;

-- Items: add status and discounts
alter table public.items add column if not exists status text not null default 'active' check (status in ('active','inactive','archived'));
alter table public.items add column if not exists discount_type text not null default 'none' check (discount_type in ('none','percent','fixed'));
alter table public.items add column if not exists discount_value numeric(10,2) not null default 0 check (discount_value >= 0);

-- Items: categorization fields
alter table public.items add column if not exists category_type text check (category_type in ('ring','bracelet','necklace','earrings','watch'));
alter table public.items add column if not exists gold_type text check (gold_type in ('italian','saudi'));
alter table public.items add column if not exists karat text check (karat in ('10k','14k','18k','21k','24k'));
create index if not exists items_category_type_idx on public.items (category_type);
create index if not exists items_gold_type_idx on public.items (gold_type);
create index if not exists items_karat_idx on public.items (karat);
alter table public.items add column if not exists description text;
alter table public.items add column if not exists restock_threshold int;

-- Enforce sell >= purchase at DB level
-- 1) Inspect violations (run to see problem rows):
--   select id, name, purchase_price, sell_price from public.items where sell_price < purchase_price;
-- 2) Optional quick auto-fix (uncomment to fix existing rows):
--   update public.items set sell_price = purchase_price where sell_price < purchase_price;
-- 3) Add constraint as NOT VALID so it applies to new/updated rows but doesn't rewrite existing rows yet
alter table public.items drop constraint if exists sell_ge_purchase;
alter table public.items add constraint sell_ge_purchase check (sell_price >= purchase_price) not valid;
-- 4) Validate only if no violations remain
do $$
begin
  if exists (select 1 from public.items where sell_price < purchase_price) then
    raise notice 'sell_ge_purchase NOT VALIDATED: % rows violate rule. Fix them, then run: ALTER TABLE public.items VALIDATE CONSTRAINT sell_ge_purchase;',
      (select count(*) from public.items where sell_price < purchase_price);
  else
    execute 'alter table public.items validate constraint sell_ge_purchase';
  end if;
end $$;

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
  status text not null default 'completed' check (status in ('completed','voided')),
  admin_user_id uuid,
  payment_method text default 'full' check (payment_method in ('full','layaway')),
  layaway_months int,
  downpayment numeric(12,2) default 0,
  amount_receivable numeric(12,2) default 0,
  monthly_payment numeric(12,2) default 0,
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

-- Refunds: track refunds per sale and per line
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  user_id uuid not null,
  total numeric(12,2) not null default 0,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.refund_items (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refunds(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id) on delete restrict,
  item_id uuid not null references public.items(id),
  quantity int not null check (quantity > 0),
  price_at_purchase numeric(10,2) not null
);

create index if not exists refund_items_sale_item_id_idx on public.refund_items (sale_item_id);
create index if not exists refunds_sale_id_idx on public.refunds (sale_id);

-- Optional: enforce that total refunded qty per sale_item does not exceed sold qty
create or replace function public.validate_refund_qty()
returns trigger language plpgsql as $$
declare sold_qty int; refunded_qty int; begin
  select quantity into sold_qty from public.sale_items where id = new.sale_item_id;
  if sold_qty is null then raise exception 'sale_item not found'; end if;
  select coalesce(sum(quantity),0) into refunded_qty from public.refund_items where sale_item_id = new.sale_item_id;
  if refunded_qty + new.quantity > sold_qty then
    raise exception 'Refund quantity exceeds sold quantity (sold %, requested %)', sold_qty, refunded_qty + new.quantity;
  end if;
  return new;
end; $$;

drop trigger if exists trg_validate_refund_qty on public.refund_items;
create trigger trg_validate_refund_qty before insert on public.refund_items for each row execute function public.validate_refund_qty();

-- Storage: public bucket for item images
-- Creates a bucket named 'item-images' (public read) if it doesn't exist,
-- and adds RLS policies for public read and authenticated uploads.
-- Create bucket in a version-compatible way (avoid function signature differences)
insert into storage.buckets (id, name, public)
select 'item-images', 'item-images', true
where not exists (select 1 from storage.buckets where id = 'item-images');

-- Public read for images in item-images bucket
drop policy if exists "Public read item-images" on storage.objects;
create policy "Public read item-images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'item-images');

-- Allow authenticated users to upload into item-images
drop policy if exists "Authenticated upload item-images" on storage.objects;
create policy "Authenticated upload item-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'item-images');

-- Note: We intentionally do NOT allow update/delete to avoid accidental removals.
-- Admin-only maintenance can be done via server-side service role if needed later.

-- Reviews: basic product reviews with RLS
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
alter table public.product_reviews enable row level security;
drop policy if exists "Public read reviews" on public.product_reviews;
create policy "Public read reviews" on public.product_reviews for select to anon, authenticated using (true);
drop policy if exists "User insert own reviews" on public.product_reviews;
create policy "User insert own reviews" on public.product_reviews for insert to authenticated with check (user_id = auth.uid());
create index if not exists product_reviews_item_id_idx on public.product_reviews(item_id);

-- Note: To support queue-style reservations, reserved_quantity may briefly exceed total_quantity.
