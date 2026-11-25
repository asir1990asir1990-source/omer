-- =====================================================================
--  مالية العائلة — Family Finance
--  الصق هذا الملف كاملاً في Supabase → SQL Editor → Run (مرة واحدة)
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- الجداول الأساسية ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'عائلتنا',
  currency text not null default 'TRY',
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('husband','wife')),
  created_at timestamptz not null default now(),
  unique (household_id, role)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- العائلة الحالية للمستخدم المسجّل
create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.members where user_id = auth.uid()
$$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  icon text,
  system_key text,                       -- 'charity' للصدقات
  monthly_budget numeric(14,2),          -- ميزانية شهرية اختيارية
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, kind, name)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  name text not null,
  type text not null default 'bank' check (type in ('cash','bank','wallet','other')),
  owner text not null default 'shared' check (owner in ('husband','wife','shared')),
  opening_balance numeric(14,2) not null default 0,
  currency text not null default 'TRY',
  notes text,
  is_hidden boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  direction text not null check (direction in ('owed_to_us','we_owe')),
  person_name text not null,
  principal numeric(14,2) not null check (principal > 0),
  debt_date date not null default current_date,
  due_date date,
  notes text,
  is_demo boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  frequency text not null default 'monthly' check (frequency in ('daily','weekly','monthly','yearly','custom')),
  custom_days int,
  next_due date not null,
  account_id uuid references public.accounts(id),
  category_id uuid references public.categories(id),
  owner text not null default 'shared' check (owner in ('husband','wife','shared')),
  remind boolean not null default true,
  is_active boolean not null default true,
  last_paid_on date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- دفتر الحركات: قلب النظام ----------
-- kind:
--  income / expense        → تدخل في إحصائيات الدخل والمصروف
--  transfer                → ينقص حساباً ويزيد آخر (لا دخل ولا مصروف)
--  loan_received/given     → استلام/منح قرض (لا دخل ولا مصروف)
--  debt_repay/debt_collect → سداد/تحصيل دفعة دين (لا دخل ولا مصروف)
--  adjust_in/adjust_out    → تسوية يدوية مع سبب إلزامي
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  kind text not null check (kind in ('income','expense','transfer','loan_received','loan_given','debt_repay','debt_collect','adjust_in','adjust_out')),
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  account_id uuid not null references public.accounts(id),
  to_account_id uuid references public.accounts(id),
  category_id uuid references public.categories(id),
  debt_id uuid references public.debts(id),
  recurring_id uuid references public.recurring_items(id),
  description text,
  notes text,
  owner text not null default 'shared' check (owner in ('husband','wife','shared')),   -- لمن تُنسب العملية
  beneficiary text check (beneficiary in ('husband','wife','shared')),                 -- المستفيد (للمصروفات)
  created_by uuid default auth.uid(),                                                   -- من أدخلها
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  client_id uuid unique,                                                                -- يمنع التكرار عند إعادة الإرسال
  is_demo boolean not null default false,
  check (kind <> 'transfer' or (to_account_id is not null and to_account_id <> account_id)),
  check (kind not in ('debt_repay','debt_collect') or debt_id is not null),
  check (kind not in ('adjust_in','adjust_out') or length(coalesce(notes,'')) > 0)
);
create index on public.transactions (household_id, occurred_on desc);
create index on public.transactions (account_id);
create index on public.transactions (debt_id);

create table public.gold_holdings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  karat int not null check (karat in (18,21,24)),
  grams numeric(12,3) not null check (grams > 0),
  pieces int not null default 1,
  purchase_date date not null default current_date,
  price_per_gram numeric(14,2) not null default 0,
  owner text not null default 'shared' check (owner in ('husband','wife','shared')),
  notes text,
  is_demo boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.gold_prices (
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  karat int not null check (karat in (18,21,24)),
  price_per_gram numeric(14,2) not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (household_id, karat)
);

create table public.charity_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  label text not null,
  target_amount numeric(14,2),
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly','once')),
  remind_time time not null default '20:00',
  remind_on date,                          -- للتذكير الموسمي (زكاة، رمضان…)
  message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigserial primary key,
  household_id uuid not null,
  table_name text not null,
  row_id uuid,
  action text not null,
  actor uuid,
  actor_name text,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);
create index on public.audit_log (household_id, changed_at desc);

-- ---------- المشغّلات ----------
create or replace function public.touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'transactions' then new.updated_by := auth.uid(); end if;
  return new;
end $$;

create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare hh uuid; rid uuid; nm text;
begin
  if tg_op = 'DELETE' then hh := old.household_id; rid := old.id; else hh := new.household_id; rid := new.id; end if;
  select display_name into nm from public.members where user_id = auth.uid();
  insert into public.audit_log(household_id, table_name, row_id, action, actor, actor_name, old_data, new_data)
  values (hh, tg_table_name, rid, tg_op, auth.uid(), nm,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['accounts','transactions','debts','gold_holdings','recurring_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch()', t||'_touch', t);
  end loop;
  foreach t in array array['accounts','transactions','debts','gold_holdings','recurring_items','categories'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t||'_audit', t);
  end loop;
end $$;

-- ---------- العروض (الأرصدة تُحسب دائماً من الحركات) ----------
create view public.account_balances with (security_invoker = true) as
select a.id, a.household_id, a.name, a.currency,
  a.opening_balance + coalesce(sum(case
    when t.kind = 'transfer' and t.to_account_id = a.id then t.amount
    when t.kind = 'transfer' then -t.amount
    when t.kind in ('income','loan_received','debt_collect','adjust_in') then t.amount
    else -t.amount end), 0) as balance
from public.accounts a
left join public.transactions t
  on t.deleted_at is null and (t.account_id = a.id or t.to_account_id = a.id)
group by a.id;

create view public.debt_balances with (security_invoker = true) as
select d.id, d.household_id, d.direction, d.person_name, d.principal,
  d.principal - coalesce(sum(t.amount) filter (where t.kind in ('debt_repay','debt_collect')), 0) as remaining
from public.debts d
left join public.transactions t on t.debt_id = d.id and t.deleted_at is null
where d.deleted_at is null
group by d.id;

-- ---------- الأمان: Row Level Security ----------
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.gold_prices enable row level security;
alter table public.audit_log enable row level security;

create policy households_select on public.households for select using (id = public.my_household());
create policy households_update on public.households for update using (id = public.my_household());
create policy members_select on public.members for select using (household_id = public.my_household());
create policy members_update_self on public.members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy invites_select on public.invites for select using (household_id = public.my_household());
create policy gold_prices_select on public.gold_prices for select using (household_id = public.my_household());
create policy gold_prices_insert on public.gold_prices for insert with check (household_id = public.my_household());
create policy gold_prices_update on public.gold_prices for update using (household_id = public.my_household()) with check (household_id = public.my_household());
create policy audit_select on public.audit_log for select using (household_id = public.my_household());

do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','debts','gold_holdings','recurring_items','charity_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (household_id = public.my_household())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert with check (household_id = public.my_household())', t||'_ins', t);
    execute format('create policy %I on public.%I for update using (household_id = public.my_household()) with check (household_id = public.my_household())', t||'_upd', t);
  end loop;
  -- الحذف الفعلي مسموح لهذه الجداول فقط. الحركات لا تُحذف نهائياً أبداً (حذف ناعم).
  foreach t in array array['accounts','categories','recurring_items','charity_plans'] loop
    execute format('create policy %I on public.%I for delete using (household_id = public.my_household())', t||'_del', t);
  end loop;
end $$;

-- ---------- الدوال (RPC) ----------
create or replace function public.seed_categories(hh uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into categories (household_id, name, kind, icon, system_key, sort) values
   (hh,'الطعام والمواد الغذائية','expense','🛒',null,1),(hh,'التسوق','expense','🛍️',null,2),
   (hh,'المطاعم والمقاهي','expense','☕',null,3),(hh,'الأطفال','expense','🧸',null,4),
   (hh,'الملابس','expense','👕',null,5),(hh,'المواصلات والسيارة','expense','🚗',null,6),
   (hh,'الوقود','expense','⛽',null,7),(hh,'الفواتير (كهرباء/ماء/غاز/إنترنت)','expense','💡',null,8),
   (hh,'الإيجار والسكن','expense','🏠',null,9),(hh,'الصحة والأدوية','expense','💊',null,10),
   (hh,'التعليم والكتب','expense','📚',null,11),(hh,'المنزل والأثاث','expense','🛋️',null,12),
   (hh,'الهدايا والمناسبات','expense','🎁',null,13),(hh,'الصدقات والتبرعات','expense','🤲','charity',14),
   (hh,'مصروفات شخصية للزوج','expense','👤',null,15),(hh,'مصروفات شخصية للزوجة','expense','👤',null,16),
   (hh,'مصروفات عائلية مشتركة','expense','👨‍👩‍👧',null,17),(hh,'أخرى','expense','📦',null,18),
   (hh,'الراتب الشهري','income','💼',null,1),(hh,'عمل إضافي','income','🧰',null,2),
   (hh,'أرباح','income','📈',null,3),(hh,'بيع شيء','income','🏷️',null,4),
   (hh,'هدية مالية','income','🎁',null,5),(hh,'دخل آخر','income','💰',null,6);
end $$;

create or replace function public.create_household(p_name text, p_display text, p_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already a member'; end if;
  insert into households(name) values (coalesce(nullif(p_name,''),'عائلتنا')) returning id into hh;
  insert into members(user_id, household_id, display_name, role) values (auth.uid(), hh, p_display, p_role);
  perform seed_categories(hh);
  return hh;
end $$;

create or replace function public.create_invite() returns text
language plpgsql security definer set search_path = public as $$
declare hh uuid := my_household(); c text;
begin
  if hh is null then raise exception 'not a member'; end if;
  if (select count(*) from members where household_id = hh) >= 2 then raise exception 'العائلة مكتملة (عضوان)'; end if;
  c := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into invites(household_id, code, created_by) values (hh, c, auth.uid());
  return c;
end $$;

create or replace function public.join_household(p_code text, p_display text, p_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already a member'; end if;
  select * into inv from invites where code = upper(trim(p_code)) and used_at is null and expires_at > now() for update;
  if not found then raise exception 'رمز الدعوة غير صالح أو منتهي'; end if;
  if (select count(*) from members where household_id = inv.household_id) >= 2 then raise exception 'العائلة مكتملة'; end if;
  insert into members(user_id, household_id, display_name, role) values (auth.uid(), inv.household_id, p_display, p_role);
  update invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return inv.household_id;
end $$;

-- حذف البيانات التجريبية فقط
create or replace function public.clear_demo_data() returns void
language plpgsql security definer set search_path = public as $$
declare hh uuid := my_household();
begin
  if hh is null then raise exception 'not a member'; end if;
  delete from transactions where household_id = hh and is_demo;
  delete from recurring_items where household_id = hh and is_demo;
  delete from debts where household_id = hh and is_demo;
  delete from gold_holdings where household_id = hh and is_demo;
  delete from accounts where household_id = hh and is_demo;
end $$;

grant execute on function public.create_household(text,text,text), public.create_invite(),
  public.join_household(text,text,text), public.clear_demo_data() to authenticated;
revoke execute on function public.seed_categories(uuid) from public, anon, authenticated;

-- ---------- المزامنة اللحظية ----------
do $$ declare t text; begin
  foreach t in array array['members','accounts','categories','transactions','debts','gold_holdings','gold_prices','recurring_items','charity_plans'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
