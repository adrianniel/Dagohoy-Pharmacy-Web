import { useState, type ChangeEvent } from 'react';
import { parseCsv } from '../../lib/csv';
import { importProducts, type ImportResult, type ImportRow } from '../../services/storeApi';
import { useToast } from '../toast';

/*
 * Add many products at once from a CSV or Excel file: download the template, fill it in,
 * pick the file, check the preview (the server marks each row), then add the good rows.
 * Rows whose barcode is already on file are skipped, never changed.
 */

const TEMPLATE_HEADERS = [
  'Barcode',
  'Product name',
  'Generic / brand',
  'Category',
  'Unit',
  'Selling price',
  'Cost',
  'Opening stock',
  'Lot',
  'Expiry (YYYY-MM-DD)',
];

const TEMPLATE_EXAMPLE = [
  '4800016642012',
  'Biogesic 500mg',
  'Paracetamol / Unilab',
  'Pain & fever',
  'Tablet',
  '5.50',
  '3.60',
  '100',
  'BGC-250114',
  '2027-12-31',
];

/** Header text people commonly use, matched without spaces, case or symbols. */
const HEADER_ALIASES: Record<keyof ImportRow | 'generic' | 'brand', string[]> = {
  barcode: ['barcode', 'sku', 'upc', 'ean', 'code', 'itemcode'],
  name: ['productname', 'name', 'product', 'item', 'itemname'],
  detail: ['genericbrand', 'detail', 'description'],
  generic: ['generic', 'genericname'],
  brand: ['brand', 'brandname', 'manufacturer'],
  category: ['category'],
  unit: ['unit', 'soldper', 'uom'],
  price: ['sellingprice', 'price', 'srp', 'unitprice', 'retailprice'],
  cost: ['cost', 'unitcost', 'costprice', 'purchaseprice'],
  stock: ['openingstock', 'stock', 'quantity', 'qty', 'onhand'],
  lot: ['lot', 'lotnumber', 'lotno', 'batch', 'batchno', 'batchnumber'],
  expiry: ['expiryyyyymmdd', 'expiry', 'expirydate', 'exp', 'expirationdate'],
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** A cell as text; Excel dates become YYYY-MM-DD; "12/31/2027" becomes 2027-12-31. */
function cellText(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate(),
    ).padStart(2, '0')}`;
  }
  const text = String(value ?? '').trim();
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return text;
}

/** Turns the sheet (first row = headers) into import rows. */
function toImportRows(sheet: unknown[][]): { rows: ImportRow[]; missing: string[] } {
  const [header = [], ...body] = sheet;
  const keys = header.map(normalize);
  const column = (field: keyof typeof HEADER_ALIASES) =>
    keys.findIndex((key) => HEADER_ALIASES[field].includes(key));
  const at = {
    barcode: column('barcode'),
    name: column('name'),
    detail: column('detail'),
    generic: column('generic'),
    brand: column('brand'),
    category: column('category'),
    unit: column('unit'),
    price: column('price'),
    cost: column('cost'),
    stock: column('stock'),
    lot: column('lot'),
    expiry: column('expiry'),
  };
  const missing = [
    at.barcode < 0 && 'Barcode',
    at.name < 0 && 'Product name',
    at.price < 0 && 'Selling price',
  ].filter((name): name is string => Boolean(name));
  const get = (cells: unknown[], index: number) => (index < 0 ? '' : cellText(cells[index]));
  const rows = body
    .filter((cells) => cells.some((cell) => cellText(cell) !== ''))
    .map((cells) => {
      const generic = get(cells, at.generic);
      const brand = get(cells, at.brand);
      return {
        barcode: get(cells, at.barcode),
        name: get(cells, at.name),
        detail: get(cells, at.detail) || [generic, brand].filter(Boolean).join(' / '),
        category: get(cells, at.category),
        unit: get(cells, at.unit),
        price: get(cells, at.price),
        cost: get(cells, at.cost),
        stock: get(cells, at.stock),
        lot: get(cells, at.lot),
        expiry: get(cells, at.expiry),
      };
    });
  return { rows, missing };
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'product-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const STATUS_LABEL: Record<ImportResult['status'], string> = {
  ready: 'Ready',
  added: 'Added',
  skipped: 'Skipped',
  error: 'Fix needed',
};

export function ProductImport({
  onClose,
  onImported,
}: {
  onClose: () => void;
  /** Called after products were added, to refresh the product list. */
  onImported: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = results.filter((result) => result.status === 'ready').length;
  const counts = results.reduce<Record<string, number>>((all, result) => {
    all[result.status] = (all[result.status] ?? 0) + 1;
    return all;
  }, {});

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    setDone(false);
    setError('');
    setBusy(true);
    try {
      let sheet: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        // Loaded only when an Excel file is picked, so it is not part of every page.
        const { default: readXlsxFile } = await import('read-excel-file');
        sheet = await readXlsxFile(file);
      } else if (/\.csv$/i.test(file.name)) {
        sheet = parseCsv(await file.text());
      } else {
        throw new Error('Pick a .csv or .xlsx file. In Excel, use File → Save As → Excel or CSV.');
      }
      const parsed = toImportRows(sheet);
      if (parsed.missing.length) {
        throw new Error(
          `The file has no ${parsed.missing.join(', ')} column. Use the template's headers in the first row.`,
        );
      }
      if (!parsed.rows.length) throw new Error('The file has headers but no products under them.');
      if (parsed.rows.length > 2000) throw new Error('Import at most 2,000 products at a time.');
      setRows(parsed.rows);
      setResults(await importProducts(parsed.rows, true));
    } catch (caught) {
      setRows([]);
      setError(caught instanceof Error ? caught.message : 'Could not read the file.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    try {
      const saved = await importProducts(rows, false);
      setResults(saved);
      setDone(true);
      const added = saved.filter((result) => result.status === 'added').length;
      await onImported();
      showToast(`${added} product${added === 1 ? '' : 's'} added.`, 'success');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not import the products.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="pos-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="pos-payment-modal product-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-import-title"
      >
        <button className="pos-modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="product-import-title">Import products</h2>
        <ol className="product-import__steps">
          <li>
            <strong>Download the template</strong> and fill it in (Excel or Google Sheets). One
            product per row. Opening stock needs a lot and an expiry date.
            <button className="start-shift__secondary" type="button" onClick={downloadTemplate}>
              Download template (CSV)
            </button>
          </li>
          <li>
            <strong>Pick your file</strong> (.xlsx or .csv). Nothing is saved yet: you see a check
            of every row first.
            <label className="product-import__file">
              <input type="file" accept=".csv,.xlsx" onChange={pickFile} disabled={busy} />
              <span>{fileName || 'Choose file…'}</span>
            </label>
          </li>
          <li>
            <strong>Add the ready rows.</strong> Rows whose barcode is already on file are skipped,
            never changed.
          </li>
        </ol>

        {error && (
          <p className="pos-notice" role="alert">
            {error}
          </p>
        )}
        {busy && <p className="product-import__busy">Checking…</p>}

        {results.length > 0 && (
          <>
            <p className="product-import__summary">
              {done ? 'Done: ' : `${results.length} rows checked: `}
              {(['added', 'ready', 'skipped', 'error'] as const)
                .filter((status) => counts[status])
                .map((status) => `${counts[status]} ${STATUS_LABEL[status].toLowerCase()}`)
                .join(' · ')}
            </p>
            <div className="product-import__table" role="region" tabIndex={0}>
              <table className="cashier-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Product</th>
                    <th>Barcode</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.row} className={`is-${result.status}`}>
                      <td>{result.row}</td>
                      <td>{result.name || '—'}</td>
                      <td className="cashier-mono">{result.barcode || '—'}</td>
                      <td>
                        <strong>{STATUS_LABEL[result.status]}</strong>
                        {result.status !== 'ready' && result.status !== 'added' && (
                          <small>{result.message}</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="start-shift__footer">
          <div className="start-shift__actions">
            <button className="start-shift__cancel" type="button" onClick={onClose} disabled={busy}>
              {done ? 'Close' : 'Cancel'}
            </button>
            {!done && (
              <button
                className="start-shift__go"
                type="button"
                onClick={() => void runImport()}
                disabled={busy || ready === 0}
              >
                {ready ? `Add ${ready} product${ready === 1 ? '' : 's'}` : 'Nothing to add yet'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
