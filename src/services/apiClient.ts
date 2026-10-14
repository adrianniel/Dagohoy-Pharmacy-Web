import type { ApiErrorResponse } from '../types/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(
  /\/$/,
  '',
);

export class ApiClientError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly payload: ApiErrorResponse | undefined,
  ) {
    super(payload?.message ?? 'The request could not be completed.');
    this.name = 'ApiClientError';
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let payload: ApiErrorResponse | undefined;
    try {
      payload = (await response.json()) as ApiErrorResponse;
    } catch {
      payload = undefined;
    }
    throw new ApiClientError(response.status, payload);
  }

  return (await response.json()) as T;
}
