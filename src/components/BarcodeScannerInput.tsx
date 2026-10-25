import { FormEvent, useEffect, useRef, useState } from 'react';

interface BarcodeScannerInputProps {
  onScan: (barcode: string) => Promise<void> | void;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function BarcodeScannerInput({
  onScan,
  autoFocus = false,
  disabled = false,
  placeholder = 'Scan or type a barcode',
}: BarcodeScannerInputProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submissionInFlight = useRef(false);

  useEffect(() => {
    if (autoFocus && !disabled && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current || disabled) {
      return;
    }

    const barcode = value.trim();
    if (!barcode) {
      setError('Scan or enter a barcode first.');
      inputRef.current?.focus();
      return;
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await onScan(barcode);
      setValue('');
    } catch {
      setError('Barcode lookup could not be completed. Try again or encode the product manually.');
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <form className="barcode-scanner-input" onSubmit={handleSubmit}>
      <label htmlFor="barcode-scanner-input">Scan barcode</label>
      <div className="barcode-scanner-input__control">
        <input
          id="barcode-scanner-input"
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled || isSubmitting}
          inputMode="text"
          autoComplete="off"
          placeholder={placeholder}
        />
        <button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting ? 'Looking up…' : 'Scan'}
        </button>
      </div>
      <span className="barcode-scanner-input__status" role="status">
        {isSubmitting ? 'Checking local product database…' : error || 'Scanner ready · press Enter'}
      </span>
    </form>
  );
}
