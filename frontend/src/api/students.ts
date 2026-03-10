import { apiClient } from './client'
import type { ExamStudent, ImportXlsxResult } from '../types'

export const getExamStudents = async (examId: number): Promise<ExamStudent[]> => {
  const { data } = await apiClient.get(`/exams/${examId}/students/`)
  return data.results ?? data
}

export const addStudentToExam = async (
  examId: number,
  payload: { rut: string; full_name: string; email?: string }
): Promise<ExamStudent> => {
  const { data } = await apiClient.post(`/exams/${examId}/students/`, payload)
  return data
}

export const importStudentsXlsx = async (
  examId: number,
  file: File
): Promise<ImportXlsxResult> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post(`/exams/${examId}/students/import-xlsx/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
