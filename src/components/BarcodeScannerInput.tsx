import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

interface BarcodeScannerInputProps {
  onScan: (barcode: string) => Promise<void> | void;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

type HidDevice = { productName?: string };
type HidApi = {
  getDevices: () => Promise<HidDevice[]>;
  requestDevice: (options: { filters: Array<Record<string, never>> }) => Promise<HidDevice[]>;
};

type ScannerConnection = 'checking' | 'unsupported' | 'unavailable' | 'ready';

function getHidApi(): HidApi | undefined {
  return (navigator as Navigator & { hid?: HidApi }).hid;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function BarcodeScannerInput({
  onScan,
  autoFocus = false,
  disabled = false,
  placeholder = 'Scan or type a barcode…',
}: BarcodeScannerInputProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [connection, setConnection] = useState<ScannerConnection>('checking');
  const [knownDevices, setKnownDevices] = useState<HidDevice[]>([]);
  const [isCheckingDevices, setIsCheckingDevices] = useState(false);
  const [lastScan, setLastScan] = useState<{ length: number; time: string } | null>(null);
  const [testValue, setTestValue] = useState('');
  const [testResult, setTestResult] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const testInputRef = useRef<HTMLInputElement>(null);
  const submissionInFlight = useRef(false);

  useEffect(() => {
    if (autoFocus && !disabled && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [autoFocus, disabled, isSubmitting]);

  useEffect(() => {
    void refreshKnownDevices();
  }, []);

  async function refreshKnownDevices(requestAccess = false) {
    const hid = getHidApi();
    if (!hid) {
      setConnection('unsupported');
      setKnownDevices([]);
      return;
    }

    setIsCheckingDevices(true);
    try {
      const devices = requestAccess
        ? await hid.requestDevice({ filters: [] })
        : await hid.getDevices();
      setKnownDevices(devices);
      setConnection('ready');
    } catch {
      setConnection('unavailable');
    } finally {
      setIsCheckingDevices(false);
    }
  }

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
      setLastScan({ length: barcode.length, time: formatTime(new Date()) });
    } catch {
      setError('Barcode lookup could not be completed. Try again or encode the product manually.');
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleTestKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const scannedValue = testValue.trim();
    setTestResult(
      scannedValue
        ? `Input received: ${scannedValue.length} characters at ${formatTime(new Date())}.`
        : 'No input received. Keep this field focused, then scan again.',
    );
    setTestValue('');
    window.requestAnimationFrame(() => testInputRef.current?.focus());
  }

  function focusBarcodeInput() {
    inputRef.current?.focus();
  }

  function focusTestInput() {
    setDiagnosticsOpen(true);
    setTestResult('');
    window.requestAnimationFrame(() => testInputRef.current?.focus());
  }

  return (
    <div className="barcode-scanner">
      <form className="barcode-scanner-input" onSubmit={handleSubmit}>
        <div className="barcode-scanner-input__label-row">
          <label htmlFor="barcode-scanner-input">Scan barcode</label>
          <span className={`barcode-scanner-input__signal${isFocused ? ' is-active' : ''}`}>
            <i aria-hidden="true" />
            {isFocused ? 'Input ready' : 'Click to scan'}
          </span>
        </div>
        <div className="barcode-scanner-input__control">
          <input
            id="barcode-scanner-input"
            ref={inputRef}
            name="barcode"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled || isSubmitting}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
          />
          <button type="submit" disabled={disabled || isSubmitting}>
            {isSubmitting ? 'Looking up…' : 'Scan'}
          </button>
        </div>
        <div className="barcode-scanner-input__footer">
          <span className="barcode-scanner-input__status" role="status" aria-live="polite">
            {isSubmitting
              ? 'Checking local product database…'
              : error ||
                (isFocused
                  ? 'Scanner ready · scan then press Enter'
                  : 'Keep the barcode field focused')}
          </span>
          <button
            className="barcode-scanner__diagnostics-toggle"
            type="button"
            onClick={focusTestInput}
          >
            Test scanner
          </button>
        </div>
      </form>

      <button
        className="barcode-scanner__diagnostics-toggle barcode-scanner__diagnostics-toggle--secondary"
        type="button"
        aria-expanded={diagnosticsOpen}
        aria-controls="scanner-diagnostics"
        onClick={() => setDiagnosticsOpen((current) => !current)}
      >
        {diagnosticsOpen ? 'Hide scanner status' : 'Scanner status'}
      </button>

      {diagnosticsOpen && (
        <section
          className="scanner-diagnostics"
          id="scanner-diagnostics"
          aria-label="Scanner diagnostics"
        >
          <div className="scanner-diagnostics__heading">
            <div>
              <p>Scanner diagnostics</p>
              <h2>Check scanner readiness</h2>
            </div>
            <button
              className="scanner-diagnostics__focus"
              type="button"
              onClick={focusBarcodeInput}
            >
              Focus barcode field
            </button>
          </div>
          <div className="scanner-diagnostics__grid">
            <div>
              <span>Barcode input</span>
              <strong className={isFocused ? 'is-ready' : ''}>
                {isFocused ? 'Focused & ready' : 'Needs focus'}
              </strong>
            </div>
            <div>
              <span>Last local lookup</span>
              <strong>
                {lastScan ? `${lastScan.length} characters · ${lastScan.time}` : 'No scan yet'}
              </strong>
            </div>
            <div>
              <span>WebHID devices</span>
              <strong>
                {connection === 'checking'
                  ? 'Checking…'
                  : connection === 'unsupported'
                    ? 'Not supported by this browser'
                    : `${knownDevices.length} approved device${knownDevices.length === 1 ? '' : 's'}`}
              </strong>
            </div>
          </div>
          <p className="scanner-diagnostics__note">
            Most USB barcode scanners act like keyboards, so browsers cannot confirm that a specific
            physical scanner is attached. Use the input test below to confirm that scanned
            keystrokes and Enter are received.
          </p>
          <div className="scanner-diagnostics__actions">
            <button type="button" onClick={focusTestInput}>
              Focus test field
            </button>
            <button
              type="button"
              onClick={() => void refreshKnownDevices(true)}
              disabled={isCheckingDevices || connection === 'unsupported'}
            >
              {isCheckingDevices ? 'Checking…' : 'Check WebHID devices'}
            </button>
          </div>
          <label className="scanner-diagnostics__test-field" htmlFor="scanner-test-input">
            <span>Scanner input test</span>
            <input
              id="scanner-test-input"
              ref={testInputRef}
              name="scanner-test"
              value={testValue}
              onChange={(event) => setTestValue(event.target.value)}
              onKeyDown={handleTestKeyDown}
              autoComplete="off"
              spellCheck={false}
              placeholder="Focus here, scan a code, then press Enter…"
            />
          </label>
          <p className="scanner-diagnostics__result" role="status" aria-live="polite">
            {testResult || 'No test input received yet.'}
          </p>
        </section>
      )}
    </div>
  );
}
