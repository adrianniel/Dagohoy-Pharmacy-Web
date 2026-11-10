import { useCallback } from 'react';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { useApi } from '../hooks/useApi';
import { apiRequest } from '../services/apiClient';
import type { HealthResponse } from '../types/api';

export function DashboardPage() {
  const checkHealth = useCallback(() => apiRequest<HealthResponse>('/health'), []);
  const health = useApi(checkHealth);

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Dashboard</h2>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void health.execute()}
          disabled={health.isLoading}
        >
          Check API health
        </button>
      </div>
      <div className="card-grid">
        <article className="card">
          <p className="eyebrow">Status</p>
          <h3>Foundation ready</h3>
          <p className="muted">Inventory and sales record modules will be added incrementally.</p>
        </article>
        <article className="card">
          <p className="eyebrow">API connection</p>
          {health.isLoading && <LoadingState />}
          {health.error && <ErrorState message={health.error.message} />}
          {health.data && (
            <p>
              {health.data.status} · database {health.data.database}
            </p>
          )}
          {!health.isLoading && !health.error && !health.data && (
            <p className="muted">Not checked yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
