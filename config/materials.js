/**
 * Materials catalogue.
 *
 * This is the heart of the quote. Quantities are NOT guessed by a model — they are
 * derived here, deterministically, from dimensions the contractor supplied.
 *
 * ---------------------------------------------------------------------------
 * !! PRICES BELOW ARE PLACEHOLDER SEED DATA. THEY ARE NOT VERIFIED LIVE PRICES !!
 * They exist so the pipeline returns sane numbers during development. Every
 * contractor is expected to override them with their own supplier rates before
 * quoting real work. Do not ship these to production as-is.
 * ---------------------------------------------------------------------------
 *
 * Densities are typical UK bulk values (tonnes per cubic metre) for loose
 * aggregate as delivered. Coverage figures are per purchase unit.
 *
 * formula kinds:
 *   area_cover   qty = ceil(area_m2 * (1 + waste) / coverM2)
 *   area_volume  qty = area_m2 * depth_m * density        (tonnes, 2dp)
 *   linear_unit  qty = ceil(run_m * (1 + waste) / unitLengthM)
 *   derived      qty = ceil(sourceQty * factor + offset)  (see companions)
 *   count        qty = count
 */

const MATERIALS = {
  // ---------- Lawn ----------
  turf_standard: {
    name: 'Turf — standard lawn',
    unit: 'rolls (1m²)',
    formula: 'area_cover',
    coverM2: 1,
    wastePct: 5,
    prices: { bandq: 5.25, wickes: 4.99 },
    companions: ['topsoil_screened_turf'],
  },
  turf_premium: {
    name: 'Turf — premium rye blend',
    unit: 'rolls (1m²)',
    formula: 'area_cover',
    coverM2: 1,
    wastePct: 5,
    prices: { bandq: 7.5, wickes: 6.95 },
    companions: ['topsoil_screened_turf'],
  },
  artificial_grass: {
    name: 'Artificial grass (30mm pile)',
    unit: 'm²',
    formula: 'area_cover',
    coverM2: 1,
    wastePct: 10,
    prices: { bandq: 22.0, wickes: 19.99 },
    companions: ['sub_base_path', 'sharp_sand_bedding'],
  },
  topsoil_screened_turf: {
    name: 'Topsoil — screened (turf bed)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.05,
    densityTPerM3: 1.5,
    wastePct: 0,
    prices: { bandq: 55.0, wickes: 49.99 },
  },

  // ---------- Paving ----------
  paving_concrete_riven: {
    name: 'Paving — riven concrete 450×450',
    unit: 'slabs',
    formula: 'area_cover',
    coverM2: 0.2025,
    wastePct: 10,
    prices: { bandq: 4.5, wickes: 4.25 },
    companions: ['sub_base_patio', 'sharp_sand_bedding', 'cement_bedding'],
  },
  paving_sandstone: {
    name: 'Paving — Indian sandstone 600×600',
    unit: 'slabs',
    formula: 'area_cover',
    coverM2: 0.36,
    wastePct: 10,
    prices: { bandq: 12.5, wickes: 11.75 },
    companions: ['sub_base_patio', 'sharp_sand_bedding', 'cement_bedding'],
  },
  paving_porcelain: {
    name: 'Paving — vitrified porcelain 600×600',
    unit: 'slabs',
    formula: 'area_cover',
    coverM2: 0.36,
    wastePct: 10,
    prices: { bandq: 21.0, wickes: 19.5 },
    companions: ['sub_base_patio', 'sharp_sand_bedding', 'cement_bedding'],
  },

  // ---------- Decking ----------
  decking_softwood: {
    name: 'Decking — treated softwood board 3.6m',
    unit: 'boards',
    formula: 'area_cover',
    coverM2: 0.522,
    wastePct: 12,
    prices: { bandq: 12.0, wickes: 11.5 },
    companions: ['decking_joist'],
  },
  decking_composite: {
    name: 'Decking — composite board 3.6m',
    unit: 'boards',
    formula: 'area_cover',
    coverM2: 0.522,
    wastePct: 12,
    prices: { bandq: 34.0, wickes: 31.5 },
    companions: ['decking_joist'],
  },
  decking_joist: {
    name: 'Decking joist — treated 47×100 3.6m',
    unit: 'lengths',
    formula: 'area_cover',
    coverM2: 1.44, // joists at 400mm centres
    wastePct: 5,
    prices: { bandq: 9.5, wickes: 8.95 },
  },

  // ---------- Sub-base and bedding ----------
  sub_base_patio: {
    name: 'MOT Type 1 sub-base (patio, 100mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.1,
    densityTPerM3: 2.1,
    wastePct: 0,
    prices: { bandq: 62.0, wickes: 57.5 },
  },
  sub_base_path: {
    name: 'MOT Type 1 sub-base (path, 80mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.08,
    densityTPerM3: 2.1,
    wastePct: 0,
    prices: { bandq: 62.0, wickes: 57.5 },
  },
  sharp_sand_bedding: {
    name: 'Sharp sand — bedding (40mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.04,
    densityTPerM3: 1.6,
    wastePct: 0,
    prices: { bandq: 48.0, wickes: 44.0 },
  },
  cement_bedding: {
    name: 'Cement — 25kg bag',
    unit: 'bags',
    formula: 'derived',
    derivedFrom: 'sharp_sand_bedding',
    factor: 4, // ~1:6 bedding mix, 4 × 25kg bags per tonne of sand
    offset: 0,
    prices: { bandq: 8.5, wickes: 7.99 },
  },

  // ---------- Surfaces ----------
  gravel_decorative: {
    name: 'Decorative gravel 20mm (50mm depth)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.05,
    densityTPerM3: 1.6,
    wastePct: 0,
    prices: { bandq: 68.0, wickes: 62.5 },
    companions: ['membrane_weed'],
  },
  bark_mulch: {
    name: 'Bark mulch (50mm depth)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.05,
    densityTPerM3: 0.35,
    wastePct: 0,
    prices: { bandq: 145.0, wickes: 138.0 },
    companions: ['membrane_weed'],
  },
  membrane_weed: {
    name: 'Weed control membrane',
    unit: 'm²',
    formula: 'area_cover',
    coverM2: 1,
    wastePct: 10,
    prices: { bandq: 1.1, wickes: 0.95 },
  },
  topsoil_beds: {
    name: 'Topsoil — screened (planting beds, 150mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.15,
    densityTPerM3: 1.5,
    wastePct: 0,
    prices: { bandq: 55.0, wickes: 49.99 },
    // Standard and premium beds come planted; the value tier is mulch only.
    // That difference is a real part of what separates the tiers on price.
    companions: ['planting_shrubs'],
  },

  // ---------- Linear: edging, retaining, screening ----------
  sleeper_softwood: {
    name: 'Sleeper — treated softwood 2.4m',
    unit: 'units',
    formula: 'linear_unit',
    unitLengthM: 2.4,
    wastePct: 8,
    prices: { bandq: 18.0, wickes: 16.5 },
  },
  sleeper_oak: {
    name: 'Sleeper — green oak 2.4m',
    unit: 'units',
    formula: 'linear_unit',
    unitLengthM: 2.4,
    wastePct: 8,
    prices: { bandq: 46.0, wickes: 43.0 },
  },
  edging_timber: {
    name: 'Timber edging board 3.0m',
    unit: 'units',
    formula: 'linear_unit',
    unitLengthM: 3.0,
    wastePct: 8,
    prices: { bandq: 7.25, wickes: 6.8 },
  },
  edging_steel: {
    name: 'Steel edging 1.0m',
    unit: 'units',
    formula: 'linear_unit',
    unitLengthM: 1.0,
    wastePct: 5,
    prices: { bandq: 14.5, wickes: 13.25 },
  },
  fence_panel_lap: {
    name: 'Fence panel — lap 1.83m',
    unit: 'panels',
    formula: 'linear_unit',
    unitLengthM: 1.83,
    wastePct: 0,
    prices: { bandq: 32.0, wickes: 29.5 },
    companions: ['fence_post', 'postmix'],
  },
  fence_panel_slatted: {
    name: 'Fence panel — slatted contemporary 1.8m',
    unit: 'panels',
    formula: 'linear_unit',
    unitLengthM: 1.8,
    wastePct: 0,
    prices: { bandq: 68.0, wickes: 64.0 },
    companions: ['fence_post', 'postmix'],
  },
  fence_post: {
    name: 'Fence post — treated 100×100 2.4m',
    unit: 'posts',
    formula: 'derived',
    derivedFrom: 'ZONE_PRIMARY',
    factor: 1,
    offset: 1, // one more post than panels
    prices: { bandq: 21.0, wickes: 19.5 },
  },
  postmix: {
    name: 'Postmix concrete — 20kg bag',
    unit: 'bags',
    formula: 'derived',
    derivedFrom: 'fence_post',
    factor: 2,
    offset: 0,
    prices: { bandq: 7.2, wickes: 6.5 },
  },

  // ---------- Planting ----------
  planting_shrubs: {
    name: 'Shrubs / perennials (3L)',
    unit: 'plants',
    formula: 'area_cover',
    coverM2: 0.6, // roughly 1 plant per 0.6m² of bed
    wastePct: 0,
    prices: { bandq: 9.5, wickes: 8.75 },
  },
  planting_specimen: {
    name: 'Specimen tree / feature plant',
    unit: 'plants',
    formula: 'count',
    wastePct: 0,
    prices: { bandq: 68.0, wickes: 62.0 },
  },
};

/** Materials whose quantity depends on another line, resolved after the first pass. */
const DERIVED_KEYS = Object.keys(MATERIALS).filter(
  (k) => MATERIALS[k].formula === 'derived'
);

function getMaterial(key) {
  const m = MATERIALS[key];
  if (!m) {
    // Deliberately loud. A missing material used to silently price at £0,
    // which under-quoted the job and looked plausible on the PDF.
    throw new Error(`Unknown material "${key}" — refusing to price at zero.`);
  }
  return m;
}

module.exports = { MATERIALS, DERIVED_KEYS, getMaterial };
