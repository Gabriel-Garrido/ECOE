import { apiClient } from "./client";
import type { StationAssignment } from "../types";

export const getAssignments = async (
  examId: number,
): Promise<StationAssignment[]> => {
  const { data } = await apiClient.get(`/exams/${examId}/assignments/`);
  return data.results ?? data;
};

export const createAssignment = async (
  examId: number,
  payload: { station: number; evaluator: number },
): Promise<StationAssignment> => {
  const { data } = await apiClient.post(
    `/exams/${examId}/assignments/`,
    payload,
  );
  return data;
};

export const deleteAssignment = async (id: number): Promise<void> => {
  await apiClient.delete(`/assignments/${id}/`);
};
