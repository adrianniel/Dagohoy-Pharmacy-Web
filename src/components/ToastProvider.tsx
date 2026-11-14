import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Success, ToastContext, ToastTone } from './toast';

type Toast = { id: number; message: string; tone: ToastTone };

/** Clear confirmation after a save: an animated check, the title, what was saved. */
function SuccessPopup({ success, onClose }: { success: Success; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="received-popup"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="received-popup__card" role="alertdialog" aria-labelledby="success-title">
        <svg className="received-popup__check" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27.5 22.5 35 37.5 18.5" />
        </svg>
        <h3 id="success-title">{success.title}</h3>
        <p className="received-popup__main">{success.message}</p>
        {success.notes && success.notes.length > 0 && (
          <ul className="received-popup__notes">
            {success.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        <button className="stock-index__action" type="button" onClick={onClose} autoFocus>
          Done
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [success, setSuccess] = useState<Success | null>(null);
  const closeSuccess = useCallback(() => setSuccess(null), []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = Date.now();
      setToasts((current) => [
        ...current.filter((toast) => toast.id !== id),
        { id, message, tone },
      ]);
      window.setTimeout(() => dismissToast(id), 5_000);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, showSuccess: setSuccess }}>
      {children}
      {success && <SuccessPopup success={success} onClose={closeSuccess} />}
      <div className="toast-viewport" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            className={`toast toast--${toast.tone}`}
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
