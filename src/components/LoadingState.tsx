export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <p role="status" className="state-message">
      {label}
    </p>
  );
}
