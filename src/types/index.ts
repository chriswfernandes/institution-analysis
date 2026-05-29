export interface Institution {
  id: number
  name: string
  short_code: string
  province: string | null
  institution_type: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
  document_count?: number
}

export interface Tag {
  id: number
  name: string
  colour: string | null
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

export interface DocumentRow {
  id: number
  institution_id: number
  institution_name: string
  filename: string
  document_type: string | null
  fiscal_year: string | null
  upload_date: string
  processing_status: string
  processing_error: string | null
  page_count: number | null
  word_count: number | null
}
