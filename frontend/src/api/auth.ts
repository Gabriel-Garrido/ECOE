import { apiClient } from "./client";
import type { User } from "../types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export const login = async (creds: LoginCredentials): Promise<AuthResponse> => {
  const { data } = await apiClient.post("/auth/login/", creds);
  return data;
};

export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get("/users/me/");
  return data;
};
