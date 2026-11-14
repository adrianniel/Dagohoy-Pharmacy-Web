import assert from 'node:assert';
// Run: node scripts/check-product-search.mts
const { rankProducts, clearBest } = await import('../src/data/productSearch.ts');
const p = (product: string, detail = '', barcode = '480000000001') => ({ product, detail, barcode });
const list = [
  p('Efficascent Oil 25mL', 'Ointment / Efficascent', '4800010000011'),
  p('Efficascent Oil 100mL', 'Ointment / Efficascent', '4800010000028'),
  p('Johnson Baby Oil 50mL', 'Baby oil / J&J', '4800010000035'),
  p('Biogesic 500mg', 'Paracetamol / Unilab', '4800010000042'),
  p('Neozep Forte', 'Phenylephrine / Unilab', '4800010000059'),
];
const names = (q: string, bc = true) => rankProducts(list, q, bc).map((h: any) => h.product.product);
let r = names('genuine efficascent oil 25ml blah blah');
assert.equal(r[0], 'Efficascent Oil 25mL', r.join());
r = names('eficascent'); assert.ok(r[0].startsWith('Efficascent'), r.join());
r = names('effica 25'); assert.equal(r[0], 'Efficascent Oil 25mL', r.join());
r = names('paracetamol'); assert.deepEqual(r, ['Biogesic 500mg']);
r = names('biogesik'); assert.deepEqual(r, ['Biogesic 500mg']);
r = names('unilab'); assert.equal(r.length, 2);
r = names('oil'); assert.equal(r.length, 3);
r = names('4800010000042'); assert.deepEqual(r, ['Biogesic 500mg']);
assert.deepEqual(names('4800010000042', false), []);
assert.deepEqual(names('xyz qwerty'), []);
assert.equal(clearBest(rankProducts(list, 'efficascent 25')).product, 'Efficascent Oil 25mL');
assert.equal(clearBest(rankProducts(list, 'efficascent')), undefined);
console.log('search checks ok');
