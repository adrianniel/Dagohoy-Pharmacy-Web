import type { ApiErrorResponse } from '../types/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace(
  /\/$/,
  '',
);

/** Fired when the server says the login session is gone (expired, logged out, disabled). */
export const SESSION_EXPIRED_EVENT = 'dagohoy-session-expired';

export class ApiClientError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly payload: ApiErrorResponse | undefined,
  ) {
    super(
      payload?.message ??
        (statusCode === 0
          ? 'Cannot reach the server. Check that the API is running, then try again.'
          : 'The request could not be completed.'),
    );
    this.name = 'ApiClientError';
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      // Sends the httpOnly session cookie; the browser never sees the token itself.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new ApiClientError(0, undefined);
  }

  if (!response.ok) {
    let payload: ApiErrorResponse | undefined;
    try {
      payload = (await response.json()) as ApiErrorResponse;
    } catch {
      payload = undefined;
    }
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiClientError(response.status, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
