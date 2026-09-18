-- =====================================================================
-- AR-GE HAMMADDE TAKIP SISTEMI  |  Supabase / PostgreSQL semasi
-- Supabase > SQL Editor icine yapistirip tek seferde calistirin.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. KULLANICILAR (profiles)  -- auth.users ile 1-1
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'user' check (role in ('admin','user')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Yeni kayit olan herkes icin otomatik profil
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Yardimci: rol kontrolu (RLS icinde recursion olmamasi icin security definer)
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active);
$$;

create or replace function public.is_active_user()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

-- ---------------------------------------------------------------------
-- 2. DEPO BOLUMLERI
-- ---------------------------------------------------------------------
create table if not exists public.warehouse_sections (
  code        text primary key,               -- A, B, C ...
  name        text not null default '',
  shelf_count int  not null default 6,        -- raf sayisi
  level_count int  not null default 4,        -- kat sayisi
  bin_count   int  not null default 6,        -- goz sayisi
  created_at  timestamptz not null default now()
);

insert into public.warehouse_sections (code, name, shelf_count, level_count, bin_count) values
  ('A','A Bolumu - Pigmentler', 6, 4, 6),
  ('B','B Bolumu - Recineler', 6, 4, 6),
  ('C','C Bolumu - Katki ve Solventler', 4, 3, 6)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 3. NUMUNE NO SAYACI  (ARGE-2026-0001)
-- ---------------------------------------------------------------------
create table if not exists public.sample_counters (
  year     int primary key,
  last_no  int not null default 0
);

create or replace function public.next_sample_no()
returns text language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  insert into public.sample_counters (year, last_no) values (y, 1)
  on conflict (year) do update set last_no = public.sample_counters.last_no + 1
  returning last_no into n;
  return 'ARGE-' || y::text || '-' || lpad(n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------
-- 4. HAMMADDELER
-- ---------------------------------------------------------------------
create table if not exists public.materials (
  id               uuid primary key default gen_random_uuid(),
  sample_no        text unique not null,
  name             text not null,
  supplier         text not null,
  product_code     text,
  lot_no           text not null,
  arrival_date     date not null default current_date,
  initial_quantity numeric(14,3) not null check (initial_quantity >= 0),
  unit             text not null default 'kg',
  package_info     text,
  min_stock        numeric(14,3) not null default 0,
  -- depo konumu
  section          text not null references public.warehouse_sections(code),
  shelf_no         int  not null,
  level_no         int,
  bin_no           int,
  shelf_code       text generated always as (
                     section || '-' || lpad(shelf_no::text,2,'0') ||
                     coalesce('-' || lpad(level_no::text,2,'0'),'') ||
                     coalesce('-' || lpad(bin_no::text,2,'0'),'')
                   ) stored,
  -- teknik
  material_type    text,
  pigment_type     text,
  color            text,
  technical_spec   text,
  usage_purpose    text,
  description      text,
  -- durum
  status           text not null default 'depoda'
                   check (status in ('depoda','kullanimda','bitti')),
  test_result      text not null default 'bekliyor'
                   check (test_result in ('bekliyor','olumlu','olumsuz','kismen','tekrar','kullanilmadi')),
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists materials_search_idx on public.materials
  using gin (to_tsvector('simple', coalesce(name,'')||' '||coalesce(supplier,'')||' '||coalesce(lot_no,'')||' '||coalesce(product_code,'')||' '||sample_no));
create index if not exists materials_shelf_idx on public.materials (section, shelf_no, level_no, bin_no);

-- ---------------------------------------------------------------------
-- 5. STOK HAREKETLERI  (tek gercek kaynak)
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materials(id) on delete cascade,
  type         text not null check (type in ('giris','kullanim','iade','duzeltme','fire','transfer','bitis')),
  quantity     numeric(14,3) not null,   -- isaretli: giris +, kullanim -
  unit         text not null default 'kg',
  note         text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists stock_movements_material_idx on public.stock_movements (material_id, created_at desc);

-- Mevcut stok = hareketlerin toplami
create or replace view public.material_stock as
  select m.id as material_id,
         coalesce(sum(sm.quantity), 0)::numeric(14,3) as current_stock
  from public.materials m
  left join public.stock_movements sm on sm.material_id = m.id
  group by m.id;

-- Liste ekranlari icin birlesik gorunum
create or replace view public.materials_view as
  select m.*,
         s.current_stock,
         (s.current_stock <= 0) as is_empty,
         (s.current_stock > 0 and m.min_stock > 0 and s.current_stock <= m.min_stock) as is_critical,
         p.full_name as created_by_name,
         (select max(u.created_at) from public.usages u where u.material_id = m.id and u.is_used) as last_used_at
  from public.materials m
  join public.material_stock s on s.material_id = m.id
  left join public.profiles p on p.id = m.created_by;

-- ---------------------------------------------------------------------
-- 6. KULLANIMLAR  (kullanildi / kullanilmadi)
-- ---------------------------------------------------------------------
create table if not exists public.usages (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materials(id) on delete cascade,
  is_used      boolean not null default true,
  quantity     numeric(14,3) default 0,
  unit         text default 'kg',
  purpose      text,
  project      text,
  trial_no     text,
  note         text,
  not_used_reason text,   -- uygun_degil | ihtiyac_yok | yanlis_numune | ertelendi | diger
  returned     boolean not null default false,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists usages_material_idx on public.usages (material_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. TEST SONUCLARI
-- ---------------------------------------------------------------------
create table if not exists public.test_results (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materials(id) on delete cascade,
  usage_id     uuid references public.usages(id) on delete set null,
  title        text,                    -- "1. Test", "Revizyon", "Stabilite"
  result       text not null check (result in ('bekliyor','olumlu','olumsuz','kismen','tekrar','kullanilmadi')),
  description  text,
  tested_at    date not null default current_date,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists test_results_material_idx on public.test_results (material_id, created_at desc);

-- En son test sonucu hammaddeye yansisin
create or replace function public.sync_material_result()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.materials set test_result = new.result, updated_at = now()
  where id = new.material_id;
  return new;
end $$;
drop trigger if exists trg_sync_material_result on public.test_results;
create trigger trg_sync_material_result
  after insert on public.test_results
  for each row execute function public.sync_material_result();

-- ---------------------------------------------------------------------
-- 8. DOSYALAR
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id             uuid primary key default gen_random_uuid(),
  material_id    uuid not null references public.materials(id) on delete cascade,
  test_result_id uuid references public.test_results(id) on delete cascade,
  category       text not null default 'diger',  -- TDS | SDS | COA | teknik | foto | excel | pdf | diger
  file_name      text not null,
  storage_path   text not null,
  mime_type      text,
  size_bytes     bigint,
  uploaded_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. ISLEM GECMISI
-- ---------------------------------------------------------------------
create table if not exists public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id),
  user_name    text,
  action       text not null,     -- kisa baslik
  detail       text,
  entity_type  text,              -- material | usage | test | stock | user | location
  entity_id    uuid,
  sample_no    text,
  created_at   timestamptz not null default now()
);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);

create or replace function public.log_activity(
  p_action text, p_detail text, p_entity_type text, p_entity_id uuid, p_sample_no text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_logs (user_id, user_name, action, detail, entity_type, entity_id, sample_no)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()),
          p_action, p_detail, p_entity_type, p_entity_id, p_sample_no);
end $$;

-- ---------------------------------------------------------------------
-- 10. AYARLAR
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values
  ('require_test_description','true'::jsonb),
  ('default_unit','"kg"'::jsonb),
  ('label_per_page','12'::jsonb),
  ('app_base_url','"https://KULLANICIADI.github.io/arge-hammadde"'::jsonb)
on conflict (key) do nothing;

-- =====================================================================
-- 11. IS KURALLARI  (RPC)
-- =====================================================================

-- Hammadde girisi: numune no uret + kayit + giris hareketi + log (atomik)
create or replace function public.create_material(p jsonb)
returns public.materials language plpgsql security definer set search_path = public as $$
declare
  m public.materials;
  s_no text;
begin
  if not public.is_admin() then
    raise exception 'Hammadde eklemek icin yonetici yetkisi gerekiyor.';
  end if;

  s_no := public.next_sample_no();

  insert into public.materials (
    sample_no, name, supplier, product_code, lot_no, arrival_date,
    initial_quantity, unit, package_info, min_stock,
    section, shelf_no, level_no, bin_no,
    material_type, pigment_type, color, technical_spec, usage_purpose, description,
    created_by)
  values (
    s_no,
    p->>'name', p->>'supplier', nullif(p->>'product_code',''), p->>'lot_no',
    coalesce(nullif(p->>'arrival_date','')::date, current_date),
    (p->>'initial_quantity')::numeric, coalesce(p->>'unit','kg'),
    nullif(p->>'package_info',''), coalesce(nullif(p->>'min_stock','')::numeric,0),
    p->>'section', (p->>'shelf_no')::int,
    nullif(p->>'level_no','')::int, nullif(p->>'bin_no','')::int,
    nullif(p->>'material_type',''), nullif(p->>'pigment_type',''), nullif(p->>'color',''),
    nullif(p->>'technical_spec',''), nullif(p->>'usage_purpose',''), nullif(p->>'description',''),
    auth.uid())
  returning * into m;

  insert into public.stock_movements (material_id, type, quantity, unit, note, created_by)
  values (m.id, 'giris', m.initial_quantity, m.unit, 'Ilk giris', auth.uid());

  perform public.log_activity('Hammadde eklendi',
    m.name || ' / Lot ' || m.lot_no || ' / ' || m.initial_quantity || ' ' || m.unit,
    'material', m.id, m.sample_no);

  return m;
end $$;

-- Kullanim kaydi: stok kontrolu + hareket + kullanim + log
create or replace function public.record_usage(
  p_material_id uuid, p_quantity numeric, p_purpose text, p_project text,
  p_trial_no text, p_note text)
returns public.usages language plpgsql security definer set search_path = public as $$
declare
  u public.usages;
  m public.materials;
  stock numeric;
begin
  if not public.is_active_user() then raise exception 'Yetkisiz islem.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Kullanim miktari 0''dan buyuk olmali.'; end if;

  select * into m from public.materials where id = p_material_id for update;
  if not found then raise exception 'Hammadde bulunamadi.'; end if;

  select current_stock into stock from public.material_stock where material_id = p_material_id;
  if p_quantity > stock then
    raise exception 'Mevcut stok yetersiz. Depoda % % var, % % kullanilmak isteniyor.', stock, m.unit, p_quantity, m.unit;
  end if;

  insert into public.usages (material_id, is_used, quantity, unit, purpose, project, trial_no, note, created_by)
  values (p_material_id, true, p_quantity, m.unit, p_purpose, p_project, p_trial_no, p_note, auth.uid())
  returning * into u;

  insert into public.stock_movements (material_id, type, quantity, unit, note, created_by)
  values (p_material_id, 'kullanim', -p_quantity, m.unit,
          coalesce(p_project,'') || case when p_trial_no is null or p_trial_no='' then '' else ' / Deneme '||p_trial_no end,
          auth.uid());

  update public.materials
    set status = case when (select current_stock from public.material_stock where material_id = p_material_id) <= 0
                      then 'bitti' else 'kullanimda' end,
        updated_at = now()
  where id = p_material_id;

  perform public.log_activity('Hammadde kullanildi',
    m.name || ' - ' || p_quantity || ' ' || m.unit, 'usage', u.id, m.sample_no);

  return u;
end $$;

-- Kullanilmadi kaydi (istege bagli iade hareketi)
create or replace function public.record_not_used(
  p_material_id uuid, p_reason text, p_note text, p_returned boolean, p_return_qty numeric)
returns public.usages language plpgsql security definer set search_path = public as $$
declare u public.usages; m public.materials;
begin
  if not public.is_active_user() then raise exception 'Yetkisiz islem.'; end if;
  select * into m from public.materials where id = p_material_id;
  if not found then raise exception 'Hammadde bulunamadi.'; end if;

  insert into public.usages (material_id, is_used, quantity, unit, not_used_reason, note, returned, created_by)
  values (p_material_id, false, coalesce(p_return_qty,0), m.unit, p_reason, p_note, coalesce(p_returned,false), auth.uid())
  returning * into u;

  if coalesce(p_returned,false) and coalesce(p_return_qty,0) > 0 then
    insert into public.stock_movements (material_id, type, quantity, unit, note, created_by)
    values (p_material_id, 'iade', p_return_qty, m.unit, 'Kullanilmadi - depoya iade', auth.uid());
  end if;

  perform public.log_activity('Kullanilmadi kaydi', coalesce(p_reason,''), 'usage', u.id, m.sample_no);
  return u;
end $$;

-- Stok duzeltme / fire / bitis (yalnizca yonetici)
create or replace function public.adjust_stock(
  p_material_id uuid, p_type text, p_quantity numeric, p_note text)
returns public.stock_movements language plpgsql security definer set search_path = public as $$
declare sm public.stock_movements; m public.materials; stock numeric;
begin
  if not public.is_admin() then raise exception 'Bu islem icin yonetici yetkisi gerekiyor.'; end if;
  select * into m from public.materials where id = p_material_id;
  select current_stock into stock from public.material_stock where material_id = p_material_id;

  if p_type = 'bitis' then
    p_quantity := -stock;
  end if;
  if stock + p_quantity < 0 then
    raise exception 'Stok eksiye dusemez. Mevcut: % %', stock, m.unit;
  end if;

  insert into public.stock_movements (material_id, type, quantity, unit, note, created_by)
  values (p_material_id, p_type, p_quantity, m.unit, p_note, auth.uid())
  returning * into sm;

  update public.materials
    set status = case when (select current_stock from public.material_stock where material_id = p_material_id) <= 0
                      then 'bitti' else status end,
        updated_at = now()
  where id = p_material_id;

  perform public.log_activity('Stok hareketi (' || p_type || ')',
    p_quantity || ' ' || m.unit || coalesce(' - ' || p_note, ''), 'stock', sm.id, m.sample_no);
  return sm;
end $$;

-- Raf degisikligi (QR ayni kalir)
create or replace function public.move_material(
  p_material_id uuid, p_section text, p_shelf int, p_level int, p_bin int, p_note text)
returns public.materials language plpgsql security definer set search_path = public as $$
declare m public.materials; old_code text;
begin
  if not public.is_admin() then raise exception 'Depo konumu degisikligi icin yonetici yetkisi gerekiyor.'; end if;
  select shelf_code into old_code from public.materials where id = p_material_id;

  update public.materials
    set section = p_section, shelf_no = p_shelf, level_no = p_level, bin_no = p_bin, updated_at = now()
  where id = p_material_id returning * into m;

  insert into public.stock_movements (material_id, type, quantity, unit, note, created_by)
  values (p_material_id, 'transfer', 0, m.unit, old_code || ' -> ' || m.shelf_code || coalesce(' / '||p_note,''), auth.uid());

  perform public.log_activity('Depo konumu degistirildi',
    'Eski konum: ' || old_code || ' | Yeni konum: ' || m.shelf_code, 'location', m.id, m.sample_no);
  return m;
end $$;

-- Ayni firma + ayni lot kontrolu
create or replace function public.check_duplicate(p_supplier text, p_lot text)
returns table (id uuid, sample_no text, name text, arrival_date date)
language sql security definer stable set search_path = public as $$
  select m.id, m.sample_no, m.name, m.arrival_date
  from public.materials m
  where lower(m.supplier) = lower(p_supplier) and lower(m.lot_no) = lower(p_lot);
$$;

-- Dashboard sayaclari
create or replace function public.dashboard_stats()
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'toplam',      (select count(*) from public.materials_view),
    'depoda',      (select count(*) from public.materials_view where status='depoda' and not is_empty),
    'test_bekleyen',(select count(*) from public.materials_view where test_result='bekliyor'),
    'kullanimda',  (select count(*) from public.materials_view where status='kullanimda' and not is_empty),
    'olumlu',      (select count(*) from public.materials_view where test_result='olumlu'),
    'olumsuz',     (select count(*) from public.materials_view where test_result='olumsuz'),
    'kismen',      (select count(*) from public.materials_view where test_result='kismen'),
    'tekrar',      (select count(*) from public.materials_view where test_result='tekrar'),
    'kritik',      (select count(*) from public.materials_view where is_critical),
    'biten',       (select count(*) from public.materials_view where is_empty)
  );
$$;

-- Kullanici rolu degistirme (yalnizca yonetici)
create or replace function public.set_user_role(p_user uuid, p_role text, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yetkisiz islem.'; end if;
  update public.profiles set role = p_role, is_active = coalesce(p_active, is_active) where id = p_user;
  perform public.log_activity('Kullanici guncellendi', p_role, 'user', p_user, null);
end $$;

-- =====================================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.materials          enable row level security;
alter table public.stock_movements    enable row level security;
alter table public.usages             enable row level security;
alter table public.test_results       enable row level security;
alter table public.attachments        enable row level security;
alter table public.activity_logs      enable row level security;
alter table public.warehouse_sections enable row level security;
alter table public.app_settings       enable row level security;
alter table public.sample_counters    enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- materials: herkes okur, yalnizca yonetici yazar
drop policy if exists materials_select on public.materials;
create policy materials_select on public.materials for select to authenticated using (public.is_active_user());
drop policy if exists materials_admin_write on public.materials;
create policy materials_admin_write on public.materials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- stok hareketleri: okuma herkes, dogrudan yazma yok (RPC uzerinden)
drop policy if exists stock_select on public.stock_movements;
create policy stock_select on public.stock_movements for select to authenticated using (public.is_active_user());

-- kullanimlar: okuma herkes, ekleme RPC ile; silme yok, duzeltmeyi yalnizca yonetici
drop policy if exists usages_select on public.usages;
create policy usages_select on public.usages for select to authenticated using (public.is_active_user());
drop policy if exists usages_admin_update on public.usages;
create policy usages_admin_update on public.usages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- test sonuclari: aktif kullanici ekler, kendi kaydini duzenleyebilir, silemez
drop policy if exists tests_select on public.test_results;
create policy tests_select on public.test_results for select to authenticated using (public.is_active_user());
drop policy if exists tests_insert on public.test_results;
create policy tests_insert on public.test_results for insert to authenticated
  with check (public.is_active_user() and created_by = auth.uid());
drop policy if exists tests_update on public.test_results;
create policy tests_update on public.test_results for update to authenticated
  using (public.is_admin() or created_by = auth.uid());
drop policy if exists tests_delete on public.test_results;
create policy tests_delete on public.test_results for delete to authenticated using (public.is_admin());

-- dosyalar
drop policy if exists att_select on public.attachments;
create policy att_select on public.attachments for select to authenticated using (public.is_active_user());
drop policy if exists att_insert on public.attachments;
create policy att_insert on public.attachments for insert to authenticated
  with check (public.is_active_user() and uploaded_by = auth.uid());
drop policy if exists att_delete on public.attachments;
create policy att_delete on public.attachments for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- islem gecmisi: okunur, silinmez, degistirilmez
drop policy if exists logs_select on public.activity_logs;
create policy logs_select on public.activity_logs for select to authenticated using (public.is_active_user());
drop policy if exists logs_insert on public.activity_logs;
create policy logs_insert on public.activity_logs for insert to authenticated
  with check (public.is_active_user() and user_id = auth.uid());

-- depo bolumleri
drop policy if exists sections_select on public.warehouse_sections;
create policy sections_select on public.warehouse_sections for select to authenticated using (true);
drop policy if exists sections_admin on public.warehouse_sections;
create policy sections_admin on public.warehouse_sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ayarlar
drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings for select to authenticated using (true);
drop policy if exists settings_admin on public.app_settings;
create policy settings_admin on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- sayac tablosu: dogrudan erisim yok (yalnizca RPC)
-- (policy tanimlanmadi => erisim kapali)

-- Gorunumler icin yetki
grant select on public.materials_view, public.material_stock to authenticated;

-- =====================================================================
-- 13. STORAGE  (dosya deposu)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('material-files','material-files', false)
on conflict (id) do nothing;

drop policy if exists storage_read on storage.objects;
create policy storage_read on storage.objects for select to authenticated
  using (bucket_id = 'material-files' and public.is_active_user());

drop policy if exists storage_write on storage.objects;
create policy storage_write on storage.objects for insert to authenticated
  with check (bucket_id = 'material-files' and public.is_active_user());

drop policy if exists storage_delete on storage.objects;
create policy storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'material-files' and (public.is_admin() or owner = auth.uid()));
