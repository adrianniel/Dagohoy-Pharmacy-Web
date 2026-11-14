import { Component, type ReactNode } from 'react';

/**
 * Shown instead of a blank white page when a screen crashes: what went wrong, and a way back.
 * The message helps find the cause (send a photo of it to the developer).
 */
export class ErrorScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main
        role="alert"
        style={{
          maxWidth: 520,
          margin: '12vh auto',
          padding: '24px 20px',
          fontFamily: 'Poppins, system-ui, sans-serif',
          color: '#13322a',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 8px' }}>
          Something went wrong on this screen
        </h1>
        <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
          Nothing was lost: saved records are on the server. Press Reload to continue. If it happens
          again, take a photo of this message and send it to the developer.
        </p>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            padding: 12,
            borderRadius: 10,
            background: '#f3f5ef',
            fontSize: '0.8rem',
          }}
        >
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: '10px 18px',
            border: 0,
            borderRadius: 10,
            background: '#1d5c46',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </main>
    );
  }
}
