create extension if not exists pgcrypto;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  stock int not null default 0,
  available boolean not null default true,
  needs_kitchen boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.daily_menu (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6),
  product_id uuid not null references public.products(id) on delete cascade,
  unique (weekday, product_id)
);

create table public.couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  vehicle_plate text,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  customer_name text not null,
  customer_phone text,
  order_type text not null check (order_type in ('delivery','dine_in')),
  address text,
  payment_method text not null,
  status text not null default 'confirmed' check (status in ('confirmed','preparing','ready','out_for_delivery','delivered','served','cancelled')),
  total numeric(10,2) not null default 0,
  notes text,
  courier_id uuid references public.couriers(id),
  courier_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  qty int not null default 1,
  needs_kitchen boolean not null default true,
  checked boolean not null default false
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(10,2) not null default 0,
  closing_notes text,
  report jsonb
);

create table public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete set null,
  type text not null check (type in ('income','expense')),
  amount numeric(10,2) not null,
  method text,
  description text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.route_passwords (
  route text primary key,
  password_hash text not null
);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

grant select on public.categories to anon;
grant select on public.products to anon;
grant select on public.daily_menu to anon;
grant select on public.orders to anon;
grant select on public.order_items to anon;
grant all on public.categories to service_role;
grant all on public.products to service_role;
grant all on public.daily_menu to service_role;
grant all on public.couriers to service_role;
grant all on public.orders to service_role;
grant all on public.order_items to service_role;
grant all on public.shifts to service_role;
grant all on public.cash_entries to service_role;
grant all on public.route_passwords to service_role;
grant all on public.app_settings to service_role;
grant select on public.app_settings to anon;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.daily_menu enable row level security;
alter table public.couriers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shifts enable row level security;
alter table public.cash_entries enable row level security;
alter table public.route_passwords enable row level security;
alter table public.app_settings enable row level security;

create policy "public read categories" on public.categories for select to anon using (true);
create policy "public read products" on public.products for select to anon using (true);
create policy "public read daily_menu" on public.daily_menu for select to anon using (true);
create policy "public read orders" on public.orders for select to anon using (true);
create policy "public read order_items" on public.order_items for select to anon using (true);
create policy "public read settings" on public.app_settings for select to anon using (true);

alter publication supabase_realtime add table public.orders;

-- seed: categories
insert into public.categories (name, sort_order) values
  ('Pratos quentes', 1),
  ('Lanches', 2),
  ('Sobremesas', 3),
  ('Bebidas', 4),
  ('Outros', 5);

-- seed: products
with c as (select id, name from public.categories)
insert into public.products (category_id, name, description, price, image_url, stock, available, needs_kitchen)
select c.id, p.name, p.description, p.price, p.image_url, p.stock, true, p.needs_kitchen
from c join (values
  ('Pratos quentes','Feijoada completa','Feijoada tradicional com arroz, couve e farofa',32.90,'/images/feijoada.jpg',20,true),
  ('Pratos quentes','Strogonoff de frango','Com arroz branco e batata palha',28.90,'/images/strogonoff.jpg',20,true),
  ('Pratos quentes','Escondidinho de carne','Purê de mandioca com carne seca gratinada',29.90,'/images/escondidinho.jpg',15,true),
  ('Pratos quentes','Frango grelhado com legumes','Peito de frango, arroz integral e legumes',26.90,'/images/frango.jpg',15,true),
  ('Pratos quentes','Lasanha à bolonhesa','Lasanha caseira com queijo gratinado',30.90,'/images/lasanha.jpg',12,true),
  ('Lanches','X-Burguer','Pão, hambúrguer, queijo, alface e tomate',18.90,'/images/xburguer.jpg',30,true),
  ('Lanches','Misto quente','Pão de forma com presunto e queijo',9.90,'/images/misto.jpg',25,true),
  ('Sobremesas','Pudim de leite','Pudim caseiro com calda de caramelo',8.90,'/images/pudim.jpg',10,true),
  ('Sobremesas','Brownie com sorvete','Brownie de chocolate com bola de sorvete',14.90,'/images/brownie.jpg',10,true),
  ('Bebidas','Refrigerante lata','Coca, Guaraná ou Fanta',6.00,null,50,false),
  ('Bebidas','Suco natural 500ml','Laranja, maracujá ou manga',9.00,null,20,false),
  ('Bebidas','Água mineral 500ml','Com ou sem gás',4.00,null,60,false),
  ('Outros','Molho extra da casa','Molho especial 50ml',2.50,null,40,false),
  ('Outros','Embalagem para viagem','Marmita térmica descartável',3.00,null,50,false)
) as p(cat,name,description,price,image_url,stock,needs_kitchen) on c.name = p.cat;

-- seed: daily menu (weekday 0=domingo ... 6=sábado)
with d as (
  select p.id as pid, p.name, p.image_url from public.products p join public.categories c on c.id=p.category_id where c.name='Pratos quentes'
)
insert into public.daily_menu (weekday, product_id)
select v.weekday, d.pid from d join (values
  ('Feijoada completa', 6), ('Feijoada completa', 0),
  ('Strogonoff de frango', 2), ('Strogonoff de frango', 5),
  ('Escondidinho de carne', 3),
  ('Frango grelhado com legumes', 1), ('Frango grelhado com legumes', 4),
  ('Lasanha à bolonhesa', 3), ('Lasanha à bolonhesa', 5)
) as v(nm, weekday) on v.nm = d.name;

-- seed: route passwords (sha256)
insert into public.route_passwords (route, password_hash) values
  ('admin','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'),
  ('cozinha','50263d56d9e862db1767204ed2fc5c264cfe2abfbd39b0bb3a7bd25ee78dbbe9'),
  ('entrega','0dc492621a834e51988b6840f9e1b0f095847deaf93b7543c16429e11644dcfd'),
  ('caixa','59c7c57e6516f4a4ae85214acbd322b724cb755806c4183587a5007c9ca3af23');

-- seed: sample courier (password: 1234)
insert into public.couriers (name, phone, email, vehicle_plate, password_hash) values
  ('Carlos Entregador','11999990000','carlos@exemplo.com','ABC1D23','03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');

-- seed: settings
insert into public.app_settings (key, value) values
  ('restaurant_name', '"Sabor da Casa"'),
  ('primary_color', '"#c2410c"'),
  ('logo_url', 'null');