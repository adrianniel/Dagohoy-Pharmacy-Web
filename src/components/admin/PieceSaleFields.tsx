/*
 * "Can also be sold by piece": a sachet of 35 tablets sold one tablet at a time, or a box of
 * coffee sold per sachet. Stock stays counted in whole units; each has its own price.
 * Used on the product form and on Receive stock.
 */

export type PieceSetting = { on: boolean; perUnit: string; name: string; price: string };

type WithPieces = { piecesPerUnit?: number; piecePrice?: number; pieceName?: string };

export const pieceSettingOf = (product?: WithPieces | null): PieceSetting => ({
  on: Boolean(product?.piecesPerUnit),
  perUnit: product?.piecesPerUnit ? String(product.piecesPerUnit) : '',
  name: product?.pieceName ?? '',
  price: product?.piecePrice ? String(product.piecePrice) : '',
});

export type PieceFields = {
  piecesPerUnit: number | null;
  piecePrice: number | null;
  pieceName: string | null;
};

/** The setting checked and ready for the server, or the problem to show. */
export function readPieceSetting(setting: PieceSetting): PieceFields | string {
  if (!setting.on) return { piecesPerUnit: null, piecePrice: null, pieceName: null };
  const perUnit = Number(setting.perUnit);
  if (!Number.isInteger(perUnit) || perUnit < 2) {
    return 'Sold by piece: type how many pieces are in one unit (2 or more).';
  }
  const price = Number(setting.price);
  if (setting.price.trim() !== '' && !(price > 0)) {
    return 'Type the price per piece as a number, like 6.50, or leave it blank.';
  }
  return {
    piecesPerUnit: perUnit,
    piecePrice: setting.price.trim() ? Math.round(price * 100) / 100 : null,
    pieceName: setting.name.trim() || null,
  };
}

/** True when the setting differs from what the product has now. */
export function pieceSettingChanged(setting: PieceSetting, product?: WithPieces | null) {
  const before = pieceSettingOf(product);
  return (
    setting.on !== before.on ||
    (setting.on &&
      (Number(setting.perUnit) !== Number(before.perUnit) ||
        setting.name.trim() !== before.name ||
        Number(setting.price || 0) !== Number(before.price || 0)))
  );
}

const PIECE_NAMES = ['Tablet', 'Capsule', 'Sachet', 'Piece', 'Strip', 'Pack'];
/** Units that are already single pieces: a product counted in these is not split further. */
const SMALL_UNITS = ['Tablet', 'Capsule', 'Piece'];

export function PieceSaleFields({
  unit,
  unitPrice,
  value,
  onChange,
  onProductForm = false,
}: {
  /** The whole unit the stock is counted in (Sachet, Box, Bottle). */
  unit: string;
  /** Price of one whole unit, to compare with the pieces bought one by one. */
  unitPrice?: number;
  value: PieceSetting;
  onChange: (next: PieceSetting) => void;
  /** On the product form, where Sold per can be changed right above. */
  onProductForm?: boolean;
}) {
  const set = (changes: Partial<PieceSetting>) => onChange({ ...value, ...changes });
  const piece = (value.name.trim() || 'piece').toLowerCase();
  const whole = unit.toLowerCase();
  const perUnit = Number(value.perUnit);
  const price = Number(value.price);
  const allPieces = perUnit >= 2 && price > 0 ? perUnit * price : null;
  return (
    <div className="piece-sale">
      <label className={`product-form__nobarcode${value.on ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={value.on}
          onChange={(event) => set({ on: event.target.checked })}
        />
        <span>
          <strong>Can also be sold by piece</strong>
          <small>
            A {whole} of tablets sold one tablet at a time, or a box sold per sachet. Stock stays
            counted per {whole}; the system opens one when a piece is sold.
          </small>
        </span>
      </label>
      {value.on && SMALL_UNITS.includes(unit) && (
        <p className="pos-notice piece-sale__warn" role="alert">
          This product is counted per <b>{whole}</b>, which is already the smallest piece. Change{' '}
          <b>Sold per</b> {onProductForm ? 'above' : 'in Edit product'} to what the stock comes in
          (Sachet, Box or Bottle), then set the {whole}s inside it here.
        </p>
      )}
      {value.on && (
        <div className="product-form__grid product-form__grid--three">
          <label>
            One piece is a
            <input
              list="piece-sale-names"
              value={value.name}
              onChange={(event) => set({ name: event.target.value.slice(0, 40) })}
              placeholder="e.g. Tablet, Sachet"
            />
            <datalist id="piece-sale-names">
              {PIECE_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label>
            {`How many ${piece}s in one ${whole}`}
            <input
              value={value.perUnit}
              onChange={(event) => set({ perUnit: event.target.value.replace(/\D/g, '') })}
              placeholder="e.g. 35"
              inputMode="numeric"
            />
          </label>
          <label>
            {`Price per ${piece} (optional)`}
            <span className="product-form__money">
              <i aria-hidden="true">₱</i>
              <input
                value={value.price}
                onChange={(event) => set({ price: event.target.value.replace(/[^\d.]/g, '') })}
                placeholder="0.00"
                inputMode="decimal"
              />
            </span>
          </label>
          {allPieces !== null && (
            <p className="piece-sale__compare">
              {perUnit} {piece}s one by one: <b>₱{allPieces.toFixed(2)}</b>
              {unitPrice ? (
                <>
                  {' '}
                  · one whole {whole}: <b>₱{unitPrice.toFixed(2)}</b>
                </>
              ) : null}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
