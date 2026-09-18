export type Role = 'admin' | 'user'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
}

export type Status = 'depoda' | 'kullanimda' | 'bitti'
export type TestResult = 'bekliyor' | 'olumlu' | 'olumsuz' | 'kismen' | 'tekrar' | 'kullanilmadi'
export type MovementType = 'giris' | 'kullanim' | 'iade' | 'duzeltme' | 'fire' | 'transfer' | 'bitis'

export interface Material {
  id: string
  sample_no: string
  name: string
  supplier: string
  product_code: string | null
  lot_no: string
  arrival_date: string
  initial_quantity: number
  unit: string
  package_info: string | null
  min_stock: number
  section: string
  shelf_no: number
  level_no: number | null
  bin_no: number | null
  shelf_code: string
  material_type: string | null
  pigment_type: string | null
  color: string | null
  technical_spec: string | null
  usage_purpose: string | null
  description: string | null
  status: Status
  test_result: TestResult
  created_by: string | null
  created_at: string
  updated_at: string
  // materials_view alanlari
  current_stock: number
  is_empty: boolean
  is_critical: boolean
  created_by_name: string | null
  last_used_at: string | null
}

export interface StockMovement {
  id: string
  material_id: string
  type: MovementType
  quantity: number
  unit: string
  note: string | null
  created_by: string | null
  created_at: string
  profiles?: { full_name: string } | null
}

export interface Usage {
  id: string
  material_id: string
  is_used: boolean
  quantity: number
  unit: string
  purpose: string | null
  project: string | null
  trial_no: string | null
  note: string | null
  not_used_reason: string | null
  returned: boolean
  created_by: string | null
  created_at: string
  profiles?: { full_name: string } | null
  materials?: { name: string; sample_no: string; unit: string; supplier?: string; shelf_code?: string } | null
}

export interface TestRecord {
  id: string
  material_id: string
  usage_id: string | null
  title: string | null
  result: TestResult
  description: string | null
  tested_at: string
  created_by: string | null
  created_at: string
  profiles?: { full_name: string } | null
  materials?: { name: string; sample_no: string } | null
}

export interface Attachment {
  id: string
  material_id: string
  test_result_id: string | null
  category: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  detail: string | null
  entity_type: string | null
  entity_id: string | null
  sample_no: string | null
  created_at: string
}

export interface WarehouseSection {
  code: string
  name: string
  shelf_count: number
  level_count: number
  bin_count: number
}
