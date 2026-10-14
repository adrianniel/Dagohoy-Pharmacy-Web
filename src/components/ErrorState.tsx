export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="state-message state-message--error">
      {message}
    </p>
  );
}
