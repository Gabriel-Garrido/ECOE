import { apiClient } from './client'
import type { User } from '../types'

export const getUsers = async (): Promise<User[]> => {
  const { data } = await apiClient.get('/users/')
  return data.results ?? data
}

export const createUser = async (payload: {
  email: string
  first_name: string
  last_name: string
  password: string
  role: string
}): Promise<User> => {
  const { data } = await apiClient.post('/users/', payload)
  return data
}

export const updateUser = async (
  id: number,
  payload: Partial<{ first_name: string; last_name: string; role: string; is_active: boolean }>
): Promise<User> => {
  const { data } = await apiClient.patch(`/users/${id}/`, payload)
  return data
}
