// API Types for ECOE MVP

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: 'ADMIN' | 'EVALUATOR'
  is_active: boolean
}

export interface Exam {
  id: number
  name: string
  description: string
  start_date: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  created_by: number
  created_by_name: string
  stations_count: number
  students_count: number
  created_at: string
  updated_at: string
}

export interface Station {
  id: number
  exam: number
  name: string
  educator_name: string
  weight_percent: string
  is_active: boolean
  order: number
  rubric_items_count: number
  max_points_total: string
}

export interface RubricItem {
  id: number
  station: number
  order: number
  description: string
  max_points: string
}

export interface GradeScalePoint {
  id: number
  station?: number
  raw_points: string
  grade: string
}

export interface Student {
  id: number
  rut: string
  full_name: string
  email: string
}

export interface ExamStudent {
  id: number
  exam: number
  student: Student
  created_at: string
}

export interface StationAssignment {
  id: number
  exam: number
  station: number
  evaluator: number
  station_name: string
  evaluator_name: string
  evaluator_email: string
  created_at: string
}

export interface EvaluationItemScore {
  id: number
  evaluation: number
  rubric_item: number
  rubric_item_description: string
  rubric_item_max_points: string
  rubric_item_order: number
  points: string | null
  points_display: string | null
  comment: string
}

export interface Evaluation {
  id: number
  exam: number
  station: number
  student: number
  evaluator: number
  status: 'DRAFT' | 'FINAL'
  total_points: string | null
  total_points_display: string | null
  grade: string | null
  grade_display: string | null
  general_comment: string
  finalized_at: string | null
  created_at: string
  updated_at: string
  item_scores: EvaluationItemScore[]
  student_name: string
  student_rut: string
  station_name: string
  evaluator_name: string
  items_completed: number
  items_total: number
}

export interface StudentResult {
  student: Student
  station_grades: Record<string, string>
  final_grade: string | null
  approved: boolean | null
}

export interface ExamResults {
  exam: {
    id: number
    name: string
    status: string
  }
  stations: Array<{
    id: number
    name: string
    weight_percent: string
    order: number
  }>
  students: StudentResult[]
}

export interface AuditLog {
  id: number
  actor: number | null
  actor_name: string
  action: string
  entity_type: string
  entity_id: number | null
  payload_json: Record<string, unknown>
  created_at: string
}

export interface ImportXlsxResult {
  created: number
  updated: number
  errors: string[]
}

export interface ApiError {
  detail?: string
  errors?: string[]
  [key: string]: unknown
}
