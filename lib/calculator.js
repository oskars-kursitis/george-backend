/**
 * Deterministic quantity + price engine.
 *
 * No model is involved past this point. Given the zones the contractor confirmed
 * and the dimensions he measured himself, the quantities are arithmetic — which
 * is what makes the quote defensible in an argument with a customer.
 *
 * Everything here is pure. It is also the code most worth testing, because this
 * is where a wrong answer costs someone real money.
 */

const { getMaterial } = require('../config/materials');
const { SEED_PRICES } = require('../config/seedPrices');
const { resolvePreset, MEASURE } = require('../config/presets');

const ZONE_PRIMARY = 'ZONE_PRIMARY';

class QuoteError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'QuoteError';
    this.field = field;
  }
}

/** Round to n decimal places without float dust. */
function round(n, dp = 2) {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

function positiveNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new QuoteError(`"${field}" must be a positive number (got ${JSON.stringify(value)})`, field);
  }
  return n;
}

/** The measured size of a zone, in whatever unit its measure kind uses. */
function zoneExtent(zone) {
  switch (zone.measure) {
    case MEASURE.AREA: {
      const l = positiveNumber(zone.lengthM, `${zone.label} length`);
      const w = positiveNumber(zone.widthM, `${zone.label} width`);
      return { areaM2: round(l * w, 2) };
    }
    case MEASURE.LINEAR:
      return { runM: positiveNumber(zone.runM, `${zone.label} run`) };
    case MEASURE.COUNT:
      return { count: positiveNumber(zone.count, `${zone.label} count`) };
    default:
      throw new QuoteError(`Zone "${zone.label}" has unknown measure "${zone.measure}"`, 'measure');
  }
}

/** Quantity in the material's purchase unit, for a single zone. */
function computeDirect(material, key, extent) {
  const waste = 1 + (material.wastePct || 0) / 100;

  switch (material.formula) {
    case 'area_cover': {
      if (extent.areaM2 == null)
        throw new QuoteError(`Material "${key}" needs an area but the zone is not measured by area`, key);
      return Math.ceil((extent.areaM2 * waste) / material.coverM2);
    }
    case 'area_volume': {
      if (extent.areaM2 == null)
        throw new QuoteError(`Material "${key}" needs an area but the zone is not measured by area`, key);
      return round(extent.areaM2 * material.depthM * material.densityTPerM3, 2);
    }
    case 'linear_unit': {
      if (extent.runM == null)
        throw new QuoteError(`Material "${key}" needs a run length but the zone is not measured linearly`, key);
      return Math.ceil((extent.runM * waste) / material.unitLengthM);
    }
    case 'count': {
      if (extent.count == null)
        throw new QuoteError(`Material "${key}" needs a count but the zone is not measured by count`, key);
      return Math.ceil(extent.count);
    }
    default:
      throw new QuoteError(`Material "${key}" has unsupported formula "${material.formula}"`, key);
  }
}

/**
 * Resolve a material key against the built-in formula book plus whatever the
 * contractor has added himself.
 *
 * His own materials are first-class: "Yorkshire blue slate chip" behaves
 * exactly like turf does, with the same formulas over his measurements. The
 * catalogue was never going to cover every job, and pretending otherwise is
 * how a quote ends up itemising the turf you are ripping out.
 */
function buildLookup(customMaterials = []) {
  const custom = new Map();

  for (const m of Array.isArray(customMaterials) ? customMaterials : []) {
    if (!m?.key || !m?.name) continue;
    custom.set(m.key, {
      name: String(m.name).slice(0, 120),
      unit: String(m.unit || 'each').slice(0, 30),
      formula: m.formula || 'area_cover',
      coverM2: Number(m.coverM2) > 0 ? Number(m.coverM2) : 1,
      depthM: Number(m.depthM) > 0 ? Number(m.depthM) : undefined,
      densityTPerM3: Number(m.densityTPerM3) > 0 ? Number(m.densityTPerM3) : undefined,
      unitLengthM: Number(m.unitLengthM) > 0 ? Number(m.unitLengthM) : 1,
      wastePct: Number.isFinite(Number(m.wastePct)) ? Number(m.wastePct) : 0,
      companions: [],
      isCustom: true,
    });
  }

  return function lookup(key) {
    const own = custom.get(key);
    if (own) return own;
    return getMaterial(key);
  };
}

/** Expand a material into itself plus its companions, breadth-first, de-duplicated. */
function expandMaterials(rootKey, lookup = getMaterial) {
  const order = [];
  const seen = new Set();
  const queue = [rootKey];

  while (queue.length) {
    const key = queue.shift();
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(key);
    const material = lookup(key);
    for (const companion of material.companions || []) queue.push(companion);
  }
  return order;
}

/**
 * All material quantities implied by one zone.
 * A patio is not just slabs — it is slabs, sub-base, bedding sand and cement.
 * Missing those is exactly the kind of thing that turns a quote into a loss.
 */
function quantitiesForZone(zone, lookup = getMaterial) {
  const extent = zoneExtent(zone);
  const order = expandMaterials(zone.materialKey, lookup);

  // A slot is a position in the build-up — "the post that goes with this
  // panel". The contractor can swap what fills it (timber post for concrete)
  // without breaking what derives from it, because the derivation chain is
  // keyed on the slot, not on whatever currently sits in it.
  const swaps = zone.substitutions || {};
  const fill = (slot) => swaps[slot] || slot;

  const quantities = new Map();

  // Pass 1 — everything that depends only on the zone's own dimensions.
  for (const slot of order) {
    const material = lookup(fill(slot));
    if (material.formula === 'derived') continue;
    quantities.set(slot, computeDirect(material, fill(slot), extent));
  }

  // Pass 2 — derived lines (posts from panels, cement from sand). Repeat until
  // stable so a chain of derivations resolves regardless of declaration order.
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const slot of order) {
      const material = lookup(fill(slot));
      if (material.formula !== 'derived' || quantities.has(slot)) continue;

      const sourceQty =
        material.derivedFrom === ZONE_PRIMARY
          ? quantities.get(zone.materialKey)
          : quantities.get(material.derivedFrom);

      if (sourceQty == null) continue; // source not resolved yet, try next pass
      quantities.set(slot, Math.ceil(sourceQty * material.factor + (material.offset || 0)));
      changed = true;
    }
    if (!changed) break;
  }

  for (const slot of order) {
    if (!quantities.has(slot)) {
      throw new QuoteError(`Could not resolve quantity for "${slot}" — check its derivedFrom chain`, slot);
    }
  }

  // Report against whatever now fills each slot, so the quote names the post he
  // actually chose.
  const resolved = new Map();
  for (const [slot, qty] of quantities) resolved.set(fill(slot), qty);
  return resolved;
}

/**
 * The full build-up of a zone, for showing the contractor what he is getting.
 *
 * "I can choose the panels or the posts, I can't choose both" was the complaint,
 * and it was fair: the picker offered one key and the companions were invisible.
 * Showing the whole chain means he can see the posts are already in there — and
 * change any line of it.
 */
function buildUpFor(materialKey, { substitutions = {} } = {}, lookup = getMaterial) {
  return expandMaterials(materialKey, lookup).map((slot, index) => {
    const filledKey = substitutions[slot] || slot;
    const material = lookup(filledKey);
    return {
      slot,
      key: filledKey,
      name: material.name,
      unit: material.unit,
      isPrimary: index === 0,
      isSubstituted: filledKey !== slot,
    };
  });
}

/**
 * The contractor's own price wins. A seed price is only a fallback so a new user
 * can quote on day one, and anything using one is flagged all the way to the
 * quote screen so he knows exactly what is still guessed.
 */
function priceFor(key, material, { priceBook = {} } = {}) {
  const own = Number(priceBook[key]);
  if (Number.isFinite(own) && own > 0) {
    return { price: own, isEstimate: false };
  }

  const seed = Number(SEED_PRICES[key]);
  if (Number.isFinite(seed) && seed > 0) {
    return { price: seed, isEstimate: true };
  }

  // Never silently zero. A missing price used to quietly under-quote the job.
  throw new QuoteError(
    `No price for "${key}" (${material.name}). Add it to your price list.`,
    key
  );
}

/**
 * Build the full quote.
 *
 * zones:       [{ role, label, measure, materialKey, lengthM, widthM, runM, count }]
 * labourLines: [{ description, hours, rate }]        — free-form, add as many as needed
 * hireLines:   [{ description, qty, unit, rate }]    — skips, plant, disposal, sundries
 * extraLines:  [{ description, qty, unit, rate }]    — anything the formulas missed
 * options:     { marginPercent, vatRegistered, vatRate, priceBook, customMaterials }
 *
 * extraLines are the escape hatch, and they matter more than they look. No
 * formula book will ever cover every job — the weed membrane under the beds,
 * compost for the pots, the pots themselves, the plants going in them. Rather
 * than pretend the catalogue is complete, the contractor types what is missing
 * and it lands on the quote as a normal material line.
 *
 * Labour and hire are deliberately not calculated. George has no opinion about
 * how a job is built — the contractor knows whether it is two men for a week or
 * a digger for a day, and hire plus man hours IS the excavation.
 */
function buildQuote({ presetId, zones, labourLines = [], hireLines = [], extraLines = [], options = {} }) {
  const preset = resolvePreset(presetId);

  if (!Array.isArray(zones) || zones.length === 0) {
    throw new QuoteError('At least one measured zone is required before a quote can be produced.', 'zones');
  }

  const {
    marginPercent = 0,
    vatRegistered = false,
    vatRate = 20,
    priceBook = {},
    customMaterials = [],
  } = options;

  // The contractor's own materials sit alongside the built-in formula book, so
  // his "Yorkshire blue slate chip" behaves exactly like turf does.
  const lookup = buildLookup(customMaterials);

  if (!Number.isFinite(Number(marginPercent)) || Number(marginPercent) < 0)
    throw new QuoteError('Margin must be zero or more.', 'marginPercent');

  const labour = (Array.isArray(labourLines) ? labourLines : []).map((line, i) => {
    const hours = Number(line.hours);
    const rate = Number(line.rate);
    if (!Number.isFinite(hours) || hours <= 0)
      throw new QuoteError(`Hours for "${line.description || `labour line ${i + 1}`}" must be more than zero.`, 'labour');
    if (!Number.isFinite(rate) || rate < 0)
      throw new QuoteError(`Rate for "${line.description || `labour line ${i + 1}`}" must be zero or more.`, 'labour');
    return {
      description: String(line.description || 'Labour').slice(0, 120),
      hours: round(hours, 2),
      rate: round(rate, 2),
      lineTotal: round(hours * rate, 2),
    };
  });

  const extras = (Array.isArray(extraLines) ? extraLines : []).map((line, i) => {
    const qty = Number(line.qty);
    const rate = Number(line.rate);
    if (!Number.isFinite(qty) || qty <= 0)
      throw new QuoteError(`Quantity for "${line.description || `extra ${i + 1}`}" must be more than zero.`, 'extras');
    if (!Number.isFinite(rate) || rate < 0)
      throw new QuoteError(`Price for "${line.description || `extra ${i + 1}`}" must be zero or more.`, 'extras');
    return {
      description: String(line.description || 'Extra').slice(0, 120),
      qty: round(qty, 2),
      unit: String(line.unit || 'each').slice(0, 30),
      rate: round(rate, 2),
      lineTotal: round(qty * rate, 2),
    };
  });

  const hire = (Array.isArray(hireLines) ? hireLines : []).map((line, i) => {
    const qty = Number(line.qty);
    const rate = Number(line.rate);
    if (!Number.isFinite(qty) || qty <= 0)
      throw new QuoteError(`Quantity for "${line.description || `hire line ${i + 1}`}" must be more than zero.`, 'hire');
    if (!Number.isFinite(rate) || rate < 0)
      throw new QuoteError(`Rate for "${line.description || `hire line ${i + 1}`}" must be zero or more.`, 'hire');
    return {
      description: String(line.description || 'Hire').slice(0, 120),
      qty: round(qty, 2),
      unit: String(line.unit || 'each').slice(0, 30),
      rate: round(rate, 2),
      lineTotal: round(qty * rate, 2),
    };
  });

  // Aggregate identical materials across zones so the customer sees one turf line,
  // not three.
  const totals = new Map(); // materialKey -> { qty, zones: [] }
  for (const zone of zones) {
    const quantities = quantitiesForZone(zone, lookup);
    for (const [key, qty] of quantities) {
      const existing = totals.get(key) || { qty: 0, zones: [] };
      existing.qty = round(existing.qty + qty, 2);
      existing.zones.push(zone.label);
      totals.set(key, existing);
    }
  }

  const items = [];
  for (const [key, { qty, zones: fromZones }] of totals) {
    const material = lookup(key);
    const { price, isEstimate } = priceFor(key, material, { priceBook });
    // Volumes are ordered whole where the merchant sells whole units; tonnes are not.
    const finalQty = material.formula === 'area_volume' ? round(qty, 2) : Math.ceil(qty);
    items.push({
      materialKey: key,
      name: material.name,
      unit: material.unit,
      qty: finalQty,
      unitPrice: round(price, 2),
      lineTotal: round(finalQty * price, 2),
      isEstimate,
      fromZones: [...new Set(fromZones)],
    });
  }

  items.sort((a, b) => b.lineTotal - a.lineTotal);

  const extrasTotal = round(extras.reduce((sum, e) => sum + e.lineTotal, 0), 2);
  const materialsTotal = round(
    items.reduce((sum, i) => sum + i.lineTotal, 0) + extrasTotal,
    2
  );
  const labourTotal = round(labour.reduce((sum, l) => sum + l.lineTotal, 0), 2);
  const hireTotal = round(hire.reduce((sum, h) => sum + h.lineTotal, 0), 2);
  const costSubtotal = round(materialsTotal + labourTotal + hireTotal, 2);
  const marginAmount = round(costSubtotal * (Number(marginPercent) / 100), 2);
  const netTotal = round(costSubtotal + marginAmount, 2);
  const vatAmount = vatRegistered ? round(netTotal * (Number(vatRate) / 100), 2) : 0;
  const grandTotal = round(netTotal + vatAmount, 2);

  const measuredArea = round(
    zones
      .filter((z) => z.measure === MEASURE.AREA)
      .reduce((sum, z) => sum + Number(z.lengthM) * Number(z.widthM), 0),
    2
  );

  return {
    presetId,
    preset: {
      styleLabel: preset.style.label,
      tierLabel: preset.tier.label,
      pricePerM2: preset.tier.pricePerM2,
    },
    items,
    extras,
    labour,
    hire,
    zones: zones.map((z) => ({
      label: z.label,
      role: z.role,
      measure: z.measure,
      lengthM: z.lengthM ?? null,
      widthM: z.widthM ?? null,
      runM: z.runM ?? null,
      count: z.count ?? null,
      areaM2: z.measure === MEASURE.AREA ? round(Number(z.lengthM) * Number(z.widthM), 2) : null,
    })),
    totals: {
      measuredAreaM2: measuredArea,
      materialsTotal,
      extrasTotal,
      labourHours: round(labour.reduce((sum, l) => sum + l.hours, 0), 2),
      labourTotal,
      hireTotal,
      costSubtotal,
      estimatedPriceCount: items.filter((i) => i.isEstimate).length,
      marginPercent: Number(marginPercent),
      marginAmount,
      netTotal,
      vatRegistered: Boolean(vatRegistered),
      vatRate: vatRegistered ? Number(vatRate) : 0,
      vatAmount,
      grandTotal,
      // Sanity signal: does the finished number sit in the band the preset promised?
      impliedPerM2: measuredArea > 0 ? round(netTotal / measuredArea, 2) : null,
    },
  };
}

module.exports = {
  buildQuote,
  quantitiesForZone,
  expandMaterials,
  buildUpFor,
  buildLookup,
  priceFor,
  round,
  QuoteError,
  ZONE_PRIMARY,
};
