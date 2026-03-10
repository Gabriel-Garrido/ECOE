import { apiClient } from './client'
import type { AuditLog, Evaluation, ExamResults } from '../types'

export const getStationEvaluations = async (stationId: number): Promise<Evaluation[]> => {
  const { data } = await apiClient.get(`/stations/${stationId}/evaluations/`)
  return data.results ?? data
}

export const getOrCreateDraftEvaluation = async (
  stationId: number,
  studentId: number
): Promise<Evaluation> => {
  const { data } = await apiClient.post(`/stations/${stationId}/evaluations/`, {
    student_id: studentId,
  })
  return data
}

export const getEvaluation = async (id: number): Promise<Evaluation> => {
  const { data } = await apiClient.get(`/evaluations/${id}/`)
  return data
}

export const updateEvaluation = async (
  id: number,
  payload: {
    general_comment?: string
    item_scores?: Array<{ id: number; points?: string | null; comment?: string }>
  }
): Promise<Evaluation> => {
  const { data } = await apiClient.patch(`/evaluations/${id}/`, payload)
  return data
}

export const finalizeEvaluation = async (id: number): Promise<Evaluation> => {
  const { data } = await apiClient.post(`/evaluations/${id}/finalize/`)
  return data
}

export const reopenEvaluation = async (id: number, reason?: string): Promise<Evaluation> => {
  const { data } = await apiClient.post(`/evaluations/${id}/reopen/`, { reason })
  return data
}

export const getExamResults = async (examId: number): Promise<ExamResults> => {
  const { data } = await apiClient.get(`/exams/${examId}/results/`)
  return data
}

export const getExamAudits = async (examId: number): Promise<AuditLog[]> => {
  const { data } = await apiClient.get(`/exams/${examId}/audits/`)
  return data.results ?? data
}
