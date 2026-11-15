import { rankProducts } from '../data/productSearch';
import { useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import type { InventoryProduct } from '../data/inventoryStore';
import { SCANNER_OFF_MESSAGE, useScannerOff } from '../services/useBilling';
import { useToast } from './toast';

/** A scanner sends each key within a few milliseconds; a person types slower. */
const SCAN_KEY_GAP_MS = 40;

/*
 * A text field with a Scan button beside it. A USB barcode scanner works like a keyboard:
 * it types the code into the focused field and presses Enter. "Scan" puts the cursor in
 * the field and says it is ready, so the cashier can scan instead of typing names.
 */

type ScanInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Enter was pressed (a scanner always ends with Enter). */
  onEnter?: (value: string) => void;
  placeholder?: string;
  /** Extra props for the input (name, disabled, autoFocus, aria-label…). */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>;
};

export function ScanInput({ value, onChange, onEnter, placeholder, inputProps }: ScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const scannerOff = useScannerOff();
  const { showToast } = useToast();
  /** While the scanner is off: time of the last digit, and whether a scan burst is coming in. */
  const lastDigit = useRef(0);
  const burst = useRef(false);

  function startScan() {
    setReady(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (scannerOff) {
      // Keys arriving scanner-fast are dropped, so a scan types nothing; typing by hand still works.
      const now = performance.now();
      if (/^\d$/.test(event.key)) {
        const fast = now - lastDigit.current < SCAN_KEY_GAP_MS;
        lastDigit.current = now;
        if (fast || burst.current) {
          burst.current = true;
          event.preventDefault();
          return;
        }
      }
      if (event.key === 'Enter' && (burst.current || /^\d{6,}$/.test(value.trim()))) {
        event.preventDefault();
        burst.current = false;
        showToast(SCANNER_OFF_MESSAGE, 'error');
        return;
      }
      if (!/^\d$/.test(event.key)) burst.current = false;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      setReady(false);
      onEnter?.(event.currentTarget.value.trim());
    }
    if (event.key === 'Escape') {
      setReady(false);
      event.currentTarget.blur();
    }
  }

  return (
    <span className={`scan-input${ready ? ' is-ready' : ''}`}>
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keyDown}
        onBlur={(event) => {
          setReady(false);
          // Keep the caller's own blur handler (the product picker closes its list with it).
          inputProps?.onBlur?.(event);
        }}
        placeholder={
          scannerOff
            ? 'Scanner off: type the product name'
            : ready
              ? 'Ready: scan the barcode now'
              : placeholder
        }
        autoComplete="off"
      />
      <button
        className="scan-input__button"
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={startScan}
        disabled={inputProps?.disabled || scannerOff}
        aria-label={scannerOff ? 'Scanner off' : 'Scan a barcode'}
        title={scannerOff ? SCANNER_OFF_MESSAGE : 'Scan a barcode'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 7v10M10 7v10M13 7v10M17 7v10" />
        </svg>
        <span>{scannerOff ? 'Off' : ready ? 'Ready' : 'Scan'}</span>
      </button>
    </span>
  );
}

/**
 * Pick a product by typing part of its name or by scanning its barcode.
 * Replaces product dropdowns in forms.
 */
export function ProductPicker({
  products,
  value,
  onPick,
  placeholder = 'Type a name or scan the barcode',
  autoFocus = false,
}: {
  products: InventoryProduct[];
  /** Puts the cursor in the search right away (a form that opens to pick a product). */
  autoFocus?: boolean;
  /** Barcode of the picked product, or ''. */
  value: string;
  onPick: (barcode: string) => void;
  placeholder?: string;
}) {
  const picked = products.find((product) => product.barcode === value);
  const [text, setText] = useState(picked?.product ?? '');
  const [open, setOpen] = useState(false);
  const [notFound, setNotFound] = useState('');
  const listId = useId();
  const scannerOff = useScannerOff();

  const needle = text.trim();
  const matches = needle
    ? rankProducts(products, needle, !scannerOff)
        .slice(0, 8)
        .map((hit) => hit.product)
    : products.slice(0, 6);

  function choose(product: InventoryProduct) {
    setText(product.product);
    setOpen(false);
    setNotFound('');
    onPick(product.barcode);
  }

  function enter(code: string) {
    if (!code) return;
    const exact = scannerOff ? undefined : products.find((product) => product.barcode === code);
    if (exact) return choose(exact);
    if (matches.length === 1) return choose(matches[0]);
    setNotFound(code);
  }

  return (
    <span className="product-picker">
      <ScanInput
        value={text}
        onChange={(next) => {
          setText(next);
          setOpen(true);
          setNotFound('');
          if (picked && next !== picked.product) onPick('');
        }}
        onEnter={enter}
        placeholder={placeholder}
        inputProps={{
          role: 'combobox',
          autoFocus,
          'aria-expanded': open && matches.length > 0,
          'aria-controls': listId,
          onFocus: () => setOpen(true),
          onBlur: () => window.setTimeout(() => setOpen(false), 150),
        }}
      />
      {open && matches.length > 0 && (
        <ul className="product-picker__list" id={listId} role="listbox">
          {matches.map((product) => (
            <li key={product.barcode} role="option" aria-selected={product.barcode === value}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(product)}
              >
                <strong>{product.product}</strong>
                <small>
                  {product.detail} · {product.barcode} · {product.stock} on hand
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <small className="product-picker__picked">
          {picked.barcode} · {picked.stock} {picked.unit.toLowerCase()}(s) on hand
        </small>
      )}
      {notFound && (
        <small className="product-picker__missing">
          No product has barcode {notFound}. Add it first with New product.
        </small>
      )}
    </span>
  );
}
