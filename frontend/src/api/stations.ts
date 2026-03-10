import { apiClient } from './client'
import type { GradeScalePoint, RubricItem, Station } from '../types'

export const getStations = async (examId: number): Promise<Station[]> => {
  const { data } = await apiClient.get(`/exams/${examId}/stations/`)
  return data.results ?? data
}

export const createStation = async (
  examId: number,
  payload: { name: string; educator_name?: string; weight_percent?: string; order?: number }
): Promise<Station> => {
  const { data } = await apiClient.post(`/exams/${examId}/stations/`, payload)
  return data
}

export const updateStation = async (
  id: number,
  payload: Partial<{
    name: string
    educator_name: string
    weight_percent: string
    is_active: boolean
    order: number
  }>
): Promise<Station> => {
  const { data } = await apiClient.patch(`/stations/${id}/`, payload)
  return data
}

export const toggleStation = async (id: number): Promise<Station> => {
  const { data } = await apiClient.post(`/stations/${id}/toggle-active/`)
  return data
}

// Rubric Items
export const getRubricItems = async (stationId: number): Promise<RubricItem[]> => {
  const { data } = await apiClient.get(`/stations/${stationId}/rubric-items/`)
  return data.results ?? data
}

export const createRubricItem = async (
  stationId: number,
  payload: { description: string; max_points: string; order?: number }
): Promise<RubricItem> => {
  const { data } = await apiClient.post(`/stations/${stationId}/rubric-items/`, payload)
  return data
}

export const updateRubricItem = async (
  id: number,
  payload: Partial<{ description: string; max_points: string; order: number }>
): Promise<RubricItem> => {
  const { data } = await apiClient.patch(`/rubric-items/${id}/`, payload)
  return data
}

export const deleteRubricItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/rubric-items/${id}/`)
}

// Grade Scale
export const getGradeScale = async (stationId: number): Promise<GradeScalePoint[]> => {
  const { data } = await apiClient.get(`/stations/${stationId}/grade-scale/`)
  return data.results ?? data
}

export const updateGradeScale = async (
  stationId: number,
  points: Array<{ raw_points: string; grade: string }>
): Promise<GradeScalePoint[]> => {
  const { data } = await apiClient.put(`/stations/${stationId}/grade-scale/`, points)
  return data
}

export const generateGradeScale = async (
  stationId: number,
  params: {
    min_raw?: string
    max_raw?: string
    min_grade?: string
    max_grade?: string
    step_raw?: string
  }
): Promise<GradeScalePoint[]> => {
  const { data } = await apiClient.post(
    `/stations/${stationId}/grade-scale/generate/`,
    params
  )
  return data
}
