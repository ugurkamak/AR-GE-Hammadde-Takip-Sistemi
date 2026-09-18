-- Ornek veri (istege bagli). Once en az bir kullanici ile giris yapin,
-- boylece profiles tablosunda bir yonetici olusur.
do $$
declare uid uuid;
begin
  select id into uid from public.profiles order by created_at limit 1;

  insert into public.materials (sample_no, name, supplier, product_code, lot_no, arrival_date,
    initial_quantity, unit, package_info, min_stock, section, shelf_no, level_no, bin_no,
    material_type, pigment_type, color, usage_purpose, created_by)
  values
    (public.next_sample_no(),'Organish Gelb','XYZ Kimya','PY-74','24581', current_date - 20, 5,'kg','5 kg teneke',1,'A',3,2,4,'Pigment','Organik','Sari','Su bazli ic cephe', uid),
    (public.next_sample_no(),'Organish Blau','XYZ Kimya','PB-15:3','24590', current_date - 12, 3,'kg','3 kg kova',0.5,'A',3,2,5,'Pigment','Organik','Mavi','Sentetik boya', uid),
    (public.next_sample_no(),'Akrilik Recine AR-40','Poli Kimya','AR-40','R-8891', current_date - 6, 25,'kg','25 kg bidon',5,'B',1,3,2,'Recine',null,null,'Dis cephe', uid)
  on conflict do nothing;

  insert into public.stock_movements (material_id, type, quantity, unit, note, created_by)
  select id,'giris',initial_quantity,unit,'Ilk giris',uid from public.materials
  where not exists (select 1 from public.stock_movements s where s.material_id = materials.id);
end $$;
