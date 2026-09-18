# AR-GE Hammadde Takip Sistemi

Boya AR-GE laboratuvari icin numune, stok, QR etiket ve test sonucu takip uygulamasi.
React + Vite + TypeScript arayuz, Supabase (PostgreSQL + Auth + Storage) veri katmani,
GitHub Pages uzerinde ucretsiz yayin.

## Ne yapar

- Firmadan gelen hammadde kaydedilir, **ARGE-2026-0001** formatinda numune numarasi otomatik uretilir
- Lot no ayri takip edilir; ayni firma + ayni lot tekrar girilmek istenirse uyarir
- Depo konumu **A-03-02-04** (bolum-raf-kat-goz) olarak saklanir, raf plani ekraninda gorulur
- Her numune icin QR kod ve A4 sayfada 12 veya 24 adet basilabilen etiket
- Telefon kamerasi ile QR okutulur, numune sayfasi acilir: kullan / kullanmadim / test sonucu gir
- Stok hicbir yerde elle yazilmaz; `stock_movements` hareketlerinin toplamindan hesaplanir
- Stoktan fazla kullanim veritabani seviyesinde engellenir
- Bir numune icin birden fazla test sonucu tutulur, eski sonuclar silinmez
- TDS / SDS / COA / fotograf / rapor dosyalari Supabase Storage'da, imzali baglanti ile acilir
- Her islem `activity_logs` tablosuna yazilir ve silinemez
- 10 hazir rapor + CSV disa aktarma (Excel'in Turkce ayarlariyla uyumlu)

## Kurulum

### 1. Supabase projesi

1. [supabase.com](https://supabase.com) uzerinde ucretsiz proje olusturun.
2. **SQL Editor** > `supabase/schema.sql` dosyasinin tamamini yapistirip calistirin.
   Tablolar, gorunumler, RPC fonksiyonlari, RLS politikalari ve `material-files` storage bucket'i olusur.
3. **Authentication > Providers > Email** aktif olsun. Ic kullanim icin
   *Confirm email* secenegini kapatabilirsiniz.
4. **Settings > API** ekranindan `Project URL` ve `anon public` anahtarini kopyalayin.

> `anon` anahtari tarayiciya acik gider; guvenligi RLS saglar. `service_role` anahtarini
> hicbir zaman frontend'e koymayin.

### 2. Yerelde calistirma

```bash
npm install
cp .env.example .env    # icini kendi Supabase bilgilerinizle doldurun
npm run dev
```

`.env` icerigi:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_APP_BASE_URL=https://KULLANICIADI.github.io/arge-hammadde
```

### 3. Ilk kullanici

Uygulamada **Hesap olustur** ile kayit olun. Sistemdeki ilk hesap otomatik olarak
**yonetici** rolunu alir. Sonraki kullanicilar AR-GE kullanicisi olur; rollerini
Kullanicilar sayfasindan degistirebilirsiniz.

### 4. GitHub Pages yayini

1. Depoyu GitHub'a gonderin. Depo adi `arge-hammadde` degilse
   `vite.config.ts` icindeki `base` degerini depo adiyla degistirin.
2. **Settings > Secrets and variables > Actions** altina su secret'lari ekleyin:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_BASE_URL`
3. **Settings > Pages > Source: GitHub Actions** secin.
4. `main` dalina her push'ta `.github/workflows/deploy.yml` yayini yapar.

Elle yayin icin: `npm run deploy` (gh-pages dalina basar).

5. Supabase **Authentication > URL Configuration** icinde Site URL alanina
   `https://KULLANICIADI.github.io/arge-hammadde` adresini ekleyin.

## QR kod mantigi

QR icinde hammadde adi **yoktur**, yalnizca numune numarasina giden adres bulunur:

```
https://KULLANICIADI.github.io/arge-hammadde/#/numune/ARGE-2026-0042
```

Raf degistiginde QR ayni kalir; ayni etiket okutuldugunda yeni raf yeri gorunur.
GitHub Pages statik oldugu icin adreslerde `#` kullanan HashRouter tercih edildi;
derin baglantilar sunucu ayari gerektirmeden calisir.

## Roller

| Islem | Yonetici / depo sorumlusu | AR-GE kullanicisi |
|---|---|---|
| Hammadde ekleme, duzenleme | evet | hayir |
| Depo konumu degistirme | evet | hayir |
| Stok duzeltme, fire, bitis | evet | hayir |
| Kullanici yonetimi | evet | hayir |
| Numune goruntuleme, arama, QR okutma | evet | evet |
| Kullanim kaydi, test sonucu, dosya ekleme | evet | evet |
| Gecmis kayit silme | hayir | hayir |

## Veri modeli

| Tablo | Icerik |
|---|---|
| `profiles` | kullanici, rol, aktiflik |
| `warehouse_sections` | depo bolumleri ve raf/kat/goz sayilari |
| `materials` | numune kaydi, `shelf_code` otomatik uretilir |
| `stock_movements` | giris / kullanim / iade / duzeltme / fire / transfer / bitis |
| `usages` | kullanim ve "kullanilmadi" kayitlari |
| `test_results` | numune basina birden fazla sonuc |
| `attachments` | Storage'daki dosyalarin kaydi |
| `activity_logs` | degistirilemez islem gecmisi |
| `app_settings` | test aciklamasi zorunlulugu gibi ayarlar |

Gorunumler: `material_stock` (hareket toplami), `materials_view` (liste ekranlari icin
stok, kritik stok ve son kullanim bilgisiyle birlesik gorunum).

Is kurallari veritabani fonksiyonlarinda: `create_material`, `record_usage`,
`record_not_used`, `adjust_stock`, `move_material`, `check_duplicate`, `dashboard_stats`,
`next_sample_no`. Boylece kurallar tarayiciya degil sunucuya bagli kalir.

## Ornek veri

`supabase/seed.sql` dosyasini SQL Editor'de calistirarak uc ornek numune ekleyebilirsiniz.
Once bir kez giris yapmis olmaniz gerekir.

## Etiket yazdirma

Hammadde deposu > **Etiket yazdir** ekranindan numuneleri secip A4 sayfada 12 veya 24
etiket olarak yazdirin. Yazdirma gorunumunde menu ve butonlar gizlenir.
Lazer yazici ve 70x37 mm (12'li) ya da 70x35 mm (24'lu) etiket kagitlariyla uyumludur;
kenar bosluklarini yazicinizin sayfa ayarindan ince ayar yapabilirsiniz.
