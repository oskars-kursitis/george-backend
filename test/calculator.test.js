const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQuote, quantitiesForZone, expandMaterials, QuoteError } = require('../lib/calculator');
const { resolvePreset } = require('../config/presets');

/** Helper: build a zone from a preset role using the preset's own material mapping. */
function zoneFor(presetId, role, dims) {
  const preset = resolvePreset(presetId);
  const z = preset.zones.find((x) => x.role === role);
  assert.ok(z, `preset ${presetId} has no ${role} zone`);
  return { ...z, ...dims };
}

test('turf area converts to rolls with 5% waste and pulls in its topsoil bed', () => {
  const zone = zoneFor('family:standard', 'lawn', { lengthM: 10, widthM: 4 });
  const q = quantitiesForZone(zone);

  // 40m² × 1.05 = 42 rolls
  assert.equal(q.get('turf_premium'), 42);
  // 40m² × 0.05m × 1.5 t/m³ = 3.00 tonnes
  assert.equal(q.get('topsoil_screened_turf'), 3);
});

test('a patio brings its own sub-base, bedding sand and cement', () => {
  const zone = zoneFor('family:standard', 'patio', { lengthM: 6, widthM: 4 });
  const q = quantitiesForZone(zone);

  // 24m² × 1.10 = 26.4 → 27 slabs at 0.36m² … ceil(26.4/0.36) = 74
  assert.equal(q.get('paving_sandstone'), Math.ceil((24 * 1.1) / 0.36));
  // 24 × 0.10 × 2.1 = 5.04 t
  assert.equal(q.get('sub_base_patio'), 5.04);
  // 24 × 0.04 × 1.6 = 1.536 → 1.54 t
  assert.equal(q.get('sharp_sand_bedding'), 1.54);
  // derived: ceil(1.54 × 4) = 7 bags
  assert.equal(q.get('cement_bedding'), 7);
});

test('fencing derives posts from panels and postmix from posts', () => {
  const zone = zoneFor('contemporary:premium', 'screening', { runM: 18 });
  const q = quantitiesForZone(zone);

  const panels = Math.ceil(18 / 1.8); // 10
  assert.equal(q.get('fence_panel_slatted'), panels);
  assert.equal(q.get('fence_post'), panels + 1); // 11
  assert.equal(q.get('postmix'), (panels + 1) * 2); // 22
});

test('expandMaterials is breadth-first and de-duplicates', () => {
  const order = expandMaterials('paving_sandstone');
  assert.equal(order[0], 'paving_sandstone');
  assert.ok(order.includes('sub_base_patio'));
  assert.ok(order.includes('cement_bedding'));
  assert.equal(new Set(order).size, order.length);
});

test('identical materials in two zones aggregate into one line', () => {
  const quote = buildQuote({
    presetId: 'family:standard',
    zones: [
      zoneFor('family:standard', 'lawn', { lengthM: 10, widthM: 4, label: 'Back lawn' }),
      { ...zoneFor('family:standard', 'lawn', {}), lengthM: 5, widthM: 2, label: 'Front lawn' },
    ],
    labourLines: [],
  });

  const turf = quote.items.filter((i) => i.materialKey === 'turf_premium');
  assert.equal(turf.length, 1, 'turf should appear once, not once per zone');
  assert.equal(turf[0].qty, 42 + 11); // ceil(40×1.05)=42, ceil(10×1.05)=11
  assert.deepEqual(turf[0].fromZones, ['Back lawn', 'Front lawn']);
});

test('margin then VAT are applied in the right order', () => {
  const quote = buildQuote({
    presetId: 'family:value',
    zones: [zoneFor('family:value', 'lawn', { lengthM: 10, widthM: 4 })],
    labourLines: [{ description: 'Me', hours: 10, rate: 25 }],
    options: { marginPercent: 20, vatRegistered: true, vatRate: 20 },
  });

  const t = quote.totals;
  assert.equal(t.labourTotal, 250);
  assert.equal(t.costSubtotal, Math.round((t.materialsTotal + 250) * 100) / 100);
  assert.equal(t.marginAmount, Math.round(t.costSubtotal * 0.2 * 100) / 100);
  assert.equal(t.netTotal, Math.round((t.costSubtotal + t.marginAmount) * 100) / 100);
  assert.equal(t.vatAmount, Math.round(t.netTotal * 0.2 * 100) / 100);
  assert.equal(t.grandTotal, Math.round((t.netTotal + t.vatAmount) * 100) / 100);
});

test('a non-VAT-registered sole trader gets no VAT line', () => {
  const quote = buildQuote({
    presetId: 'family:value',
    zones: [zoneFor('family:value', 'lawn', { lengthM: 5, widthM: 4 })],
    labourLines: [{ description: 'Me', hours: 4, rate: 25 }],
    options: { vatRegistered: false },
  });
  assert.equal(quote.totals.vatAmount, 0);
  assert.equal(quote.totals.grandTotal, quote.totals.netTotal);
});

test('the contractor price book overrides the seed estimate', () => {
  const zones = [zoneFor('family:value', 'lawn', { lengthM: 10, widthM: 4 })];

  const seeded = buildQuote({ presetId: 'family:value', zones, labourLines: [] });
  const turfSeeded = seeded.items.find((i) => i.materialKey === 'turf_standard');
  assert.equal(turfSeeded.isEstimate, true, 'with no price book, turf falls back to a seed');
  assert.equal(turfSeeded.unitPrice, 4.99);

  const owned = buildQuote({
    presetId: 'family:value',
    zones,
    labourLines: [],
    options: { priceBook: { turf_standard: 3.8 } },
  });
  const turfOwned = owned.items.find((i) => i.materialKey === 'turf_standard');
  assert.equal(turfOwned.isEstimate, false);
  assert.equal(turfOwned.unitPrice, 3.8);
});

test('lines still on a seed price are counted so the app can flag them', () => {
  const zones = [zoneFor('family:value', 'lawn', { lengthM: 10, widthM: 4 })];

  const none = buildQuote({ presetId: 'family:value', zones, labourLines: [] });
  assert.equal(none.totals.estimatedPriceCount, none.items.length);

  const priceBook = Object.fromEntries(none.items.map((i) => [i.materialKey, 5]));
  const all = buildQuote({ presetId: 'family:value', zones, labourLines: [], options: { priceBook } });
  assert.equal(all.totals.estimatedPriceCount, 0);
});

test('labour is a free-form list — as many men as the job needs', () => {
  const quote = buildQuote({
    presetId: 'family:value',
    zones: [zoneFor('family:value', 'lawn', { lengthM: 10, widthM: 4 })],
    labourLines: [
      { description: 'Me', hours: 40, rate: 38 },
      { description: 'Labourer', hours: 40, rate: 15 },
      { description: 'Groundworker', hours: 16, rate: 22 },
    ],
  });

  assert.equal(quote.labour.length, 3);
  assert.equal(quote.totals.labourTotal, 40 * 38 + 40 * 15 + 16 * 22);
  assert.equal(quote.totals.labourHours, 96);
});

test('plant and hire carry their own units — hire plus hours is the excavation', () => {
  const quote = buildQuote({
    presetId: 'family:value',
    zones: [zoneFor('family:value', 'lawn', { lengthM: 10, widthM: 4 })],
    labourLines: [{ description: 'Me', hours: 8, rate: 38 }],
    hireLines: [
      { description: '8-yard skip', qty: 2, unit: 'each', rate: 280 },
      { description: 'Mini digger', qty: 3, unit: 'days', rate: 95 },
    ],
  });

  assert.equal(quote.hire.length, 2);
  assert.equal(quote.totals.hireTotal, 2 * 280 + 3 * 95);
  assert.equal(
    quote.totals.costSubtotal,
    Math.round((quote.totals.materialsTotal + quote.totals.labourTotal + quote.totals.hireTotal) * 100) / 100
  );
});

test('a labour line with no hours is refused', () => {
  assert.throws(
    () =>
      buildQuote({
        presetId: 'family:value',
        zones: [zoneFor('family:value', 'lawn', { lengthM: 4, widthM: 4 })],
        labourLines: [{ description: 'Me', hours: 0, rate: 38 }],
      }),
    /must be more than zero/
  );
});

test('a hire line with no quantity is refused', () => {
  assert.throws(
    () =>
      buildQuote({
        presetId: 'family:value',
        zones: [zoneFor('family:value', 'lawn', { lengthM: 4, widthM: 4 })],
        labourLines: [],
        hireLines: [{ description: 'Skip', qty: 0, rate: 280 }],
      }),
    /must be more than zero/
  );
});

// --- The failure modes that used to produce a quiet, plausible, wrong quote ---

test('a zone with no dimensions is refused, not priced at zero', () => {
  assert.throws(
    () => buildQuote({ presetId: 'family:value', zones: [zoneFor('family:value', 'lawn', {})], labourLines: [] }),
    QuoteError
  );
});

test('a zero or negative dimension is refused', () => {
  assert.throws(
    () =>
      buildQuote({
        presetId: 'family:value',
        zones: [zoneFor('family:value', 'lawn', { lengthM: 10, widthM: 0 })],
        labourLines: [{ description: 'Me', hours: 1, rate: 1 }],
      }),
    /must be a positive number/
  );
});

test('an empty zone list cannot produce a quote', () => {
  assert.throws(() => buildQuote({ presetId: 'family:value', zones: [], labourLines: [] }), /at least one measured zone/i);
});

test('an unknown material is loud rather than free', () => {
  assert.throws(
    () =>
      buildQuote({
        presetId: 'family:value',
        zones: [{ role: 'lawn', label: 'Lawn', measure: 'area', materialKey: 'unobtainium', lengthM: 4, widthM: 4 }],
        labourLines: [],
      }),
    /Unknown material/
  );
});

test('an unknown preset is rejected', () => {
  assert.throws(() => buildQuote({ presetId: 'nope:nope', zones: [], labourLines: [] }), /Unknown preset/);
});

test('missing labour numbers are rejected rather than becoming NaN on the PDF', () => {
  assert.throws(
    () =>
      buildQuote({
        presetId: 'family:value',
        zones: [zoneFor('family:value', 'lawn', { lengthM: 4, widthM: 4 })],
        labourLines: [{ description: 'Me', hours: undefined, rate: 25 }],
      }),
    /must be more than zero/
  );
});

test('a job with no labour at all still prices its materials', () => {
  const quote = buildQuote({
    presetId: 'family:value',
    zones: [zoneFor('family:value', 'lawn', { lengthM: 4, widthM: 4 })],
    labourLines: [],
  });
  assert.equal(quote.totals.labourTotal, 0);
  assert.ok(quote.totals.materialsTotal > 0);
});

test('implied £/m² is reported so an out-of-band quote is visible', () => {
  const quote = buildQuote({
    presetId: 'family:standard',
    zones: [
      zoneFor('family:standard', 'lawn', { lengthM: 8, widthM: 5 }),
      zoneFor('family:standard', 'patio', { lengthM: 5, widthM: 4 }),
    ],
    labourLines: [{ description: 'Me', hours: 40, rate: 30 }],
    options: { marginPercent: 20 },
  });

  assert.equal(quote.totals.measuredAreaM2, 60);
  assert.ok(quote.totals.impliedPerM2 > 0);
  assert.ok(Number.isFinite(quote.totals.grandTotal));
});
