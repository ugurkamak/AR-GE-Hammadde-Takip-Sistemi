import type { MovementType, Status, TestResult } from './types'

export const STATUS_LABEL: Record<Status, string> = {
  depoda: 'Depoda',
  kullanimda: 'Kullanimda',
  bitti: 'Bitti',
}

export const RESULT_LABEL: Record<TestResult, string> = {
  bekliyor: 'Test bekliyor',
  olumlu: 'Olumlu',
  olumsuz: 'Olumsuz',
  kismen: 'Kismen olumlu',
  tekrar: 'Tekrar test edilecek',
  kullanilmadi: 'Kullanilmadi',
}

export const RESULT_COLOR: Record<TestResult, string> = {
  bekliyor: '#b58105',
  olumlu: '#2f8f5b',
  olumsuz: '#c0392b',
  kismen: '#d9772b',
  tekrar: '#2b6cb0',
  kullanilmadi: '#7a8691',
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  giris: 'Giris',
  kullanim: 'Kullanim',
  iade: 'Iade',
  duzeltme: 'Duzeltme',
  fire: 'Fire',
  transfer: 'Transfer',
  bitis: 'Bitis',
}

export const NOT_USED_REASONS: Record<string, string> = {
  uygun_degil: 'Uygun bulunmadi',
  ihtiyac_yok: 'Ihtiyac kalmadi',
  yanlis_numune: 'Yanlis numune',
  ertelendi: 'Test ertelendi',
  diger: 'Diger',
}

export const UNITS = ['kg', 'g', 'L', 'ml', 'adet']

export const FILE_CATEGORIES = ['TDS', 'SDS', 'COA', 'Teknik dokuman', 'Fotograf', 'Excel', 'PDF', 'Diger']
