import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../services/apiClient';

/*
 * Wi-Fi sign in the top bar: how fast the server answers. It asks /health every
 * 15 seconds (only while the tab is visible) and shows the time it took.
 * Green under 300 ms, amber under 1 s, red when slower, grey "Offline" when no answer.
 */

const EVERY_MS = 15_000;
const TIMEOUT_MS = 5_000;

type Level = 'good' | 'fair' | 'slow' | 'offline';

const levelOf = (ms: number | null): Level =>
  ms === null ? 'offline' : ms < 300 ? 'good' : ms < 1000 ? 'fair' : 'slow';
const ARCS: Record<Level, number> = { good: 3, fair: 2, slow: 1, offline: 0 };
const WORDS: Record<Level, string> = {
  good: 'Connection is good',
  fair: 'Connection is a bit slow',
  slow: 'Connection is slow',
  offline: 'No connection to the server. Sales may not save until it is back.',
};

export function ConnectionSignal() {
  const [ms, setMs] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.hidden) return;
      const started = performance.now();
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (alive) setMs(response.ok ? Math.round(performance.now() - started) : null);
      } catch {
        if (alive) setMs(null);
      }
      if (alive) setChecked(true);
    };
    void check();
    const timer = window.setInterval(() => void check(), EVERY_MS);
    const now = () => void check();
    window.addEventListener('online', now);
    window.addEventListener('offline', now);
    document.addEventListener('visibilitychange', now);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('online', now);
      window.removeEventListener('offline', now);
      document.removeEventListener('visibilitychange', now);
    };
  }, []);

  const level = levelOf(ms);
  const lit = ARCS[level];
  return (
    <div
      className={`connection-signal is-${checked ? level : 'checking'}`}
      role="status"
      title={checked ? WORDS[level] : 'Checking the connection…'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className={lit >= 3 ? 'is-lit' : ''} d="M2.5 9a14 14 0 0 1 19 0" />
        <path className={lit >= 2 ? 'is-lit' : ''} d="M5.8 12.5a9 9 0 0 1 12.4 0" />
        <path className={lit >= 1 ? 'is-lit' : ''} d="M9 16a4.5 4.5 0 0 1 6 0" />
        <circle className={lit >= 1 ? 'is-lit' : ''} cx="12" cy="19.5" r="1.4" />
      </svg>
      <span>{!checked ? '…' : ms === null ? 'Offline' : `${ms}ms`}</span>
    </div>
  );
}
