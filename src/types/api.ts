export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'unavailable';
  timestamp: string;
}
