/*
 * Forgiving product search for the Sales Counter and the product pickers.
 * "genuine efficascent oil 25ml" still finds "Efficascent Oil 25 mL": each typed word is
 * matched on its own, words that match nothing ("genuine") are ignored, small typos
 * ("eficascent") still count, and the products matching the most words come first.
 */

type Searchable = { product: string; detail: string; barcode: string };

/** Lowercase words, accents removed, numbers split from letters: "25mL" → ["25", "ml"]. */
export function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d)([a-z])|([a-z])(\d)/g, '$1$3 $2$4')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Edits (insert, delete, change, swap two letters) to turn a into b, stopping above max. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length];
}

/** How well one typed word matches the product's words: 1 exact/start, 0.8 inside, 0.6 typo. */
function wordScore(typed: string, words: string[]): number {
  let best = 0;
  for (const word of words) {
    if (word === typed || word.startsWith(typed)) return 1;
    if (/^\d+$/.test(typed)) continue; // 25 must not match 250 by a "typo"
    if (typed.length >= 3 && word.includes(typed)) best = Math.max(best, 0.8);
    if (typed.length >= 4) {
      const max = typed.length >= 7 ? 2 : 1;
      // Compare with the whole word, and with its start so a half-typed word with a typo counts.
      const start = word.slice(0, typed.length);
      if (editDistance(typed, word, max) <= max || editDistance(typed, start, max) <= max) {
        best = Math.max(best, 0.6);
      }
    }
  }
  return best;
}

export type SearchHit<T> = { product: T; score: number; allWords: boolean };

/**
 * Products that match the search, best first. A product needs at least one typed word of
 * 2+ letters (or a number) to match; one-letter words only count when they are all you typed.
 */
export function rankProducts<T extends Searchable>(
  products: T[],
  query: string,
  withBarcode = true,
): SearchHit<T>[] {
  const typed = searchWords(query);
  if (!typed.length) return [];
  const useful =
    typed.length === 1 ? typed : typed.filter((word) => word.length > 1 || /\d/.test(word));
  const phrase = typed.join(' ');
  const digits = query.replace(/\s/g, '');
  const hits: SearchHit<T>[] = [];
  for (const product of products) {
    if (withBarcode && /^\d{3,}$/.test(digits) && product.barcode.includes(digits)) {
      hits.push({ product, score: 100 + (product.barcode === digits ? 10 : 0), allWords: true });
      continue;
    }
    const nameWords = searchWords(product.product);
    const words = [...nameWords, ...searchWords(product.detail)];
    let score = 0;
    let matched = 0;
    for (const word of useful) {
      const value = wordScore(word, words);
      if (value) matched += 1;
      score += value;
    }
    if (!matched) continue;
    // Name over generic/brand, the typed words in order, and fully matched searches first.
    if (useful.some((word) => wordScore(word, nameWords) === 1)) score += 0.5;
    if (nameWords.join(' ').includes(phrase)) score += 1;
    hits.push({ product, score, allWords: matched === useful.length });
  }
  return hits.sort(
    (a, b) =>
      Number(b.allWords) - Number(a.allWords) ||
      b.score - a.score ||
      a.product.product.localeCompare(b.product.product),
  );
}

/** The product Enter should add: the only result, or the only one matching every word. */
export function clearBest<T>(hits: SearchHit<T>[]): T | undefined {
  if (hits.length === 1) return hits[0].product;
  const [first, second] = hits;
  return first?.allWords && !second?.allWords ? first.product : undefined;
}
