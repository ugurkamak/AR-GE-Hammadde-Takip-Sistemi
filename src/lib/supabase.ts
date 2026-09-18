import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  // Uygulama acilirken net bir hata verelim, sessizce bos ekran gostermeyelim.
  console.error('VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanimli degil. .env dosyasini kontrol edin.')
}

export const supabase = createClient(url ?? '', key ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export const APP_BASE_URL: string =
  (import.meta.env.VITE_APP_BASE_URL as string) ||
  `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '')

/** QR koda yazilan adres. Hammadde adi tasimaz, yalnizca numune numarasi. */
export const sampleUrl = (sampleNo: string) => `${APP_BASE_URL}/#/numune/${sampleNo}`
