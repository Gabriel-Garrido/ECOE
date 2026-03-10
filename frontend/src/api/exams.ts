import { apiClient } from './client'
import type { Exam } from '../types'

export const getExams = async (params?: { status?: string }): Promise<Exam[]> => {
  const { data } = await apiClient.get('/exams/', { params })
  return data.results ?? data
}

export const getExam = async (id: number): Promise<Exam> => {
  const { data } = await apiClient.get(`/exams/${id}/`)
  return data
}

export const createExam = async (payload: {
  name: string
  description?: string
  start_date?: string | null
}): Promise<Exam> => {
  const { data } = await apiClient.post('/exams/', payload)
  return data
}

export const updateExam = async (
  id: number,
  payload: Partial<{ name: string; description: string; start_date: string | null }>
): Promise<Exam> => {
  const { data } = await apiClient.patch(`/exams/${id}/`, payload)
  return data
}

export const publishExam = async (id: number): Promise<Exam> => {
  const { data } = await apiClient.post(`/exams/${id}/publish/`)
  return data
}

export const closeExam = async (id: number): Promise<Exam> => {
  const { data } = await apiClient.post(`/exams/${id}/close/`)
  return data
}
