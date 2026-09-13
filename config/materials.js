/**
 * The formula book.
 *
 * Facts about materials: what unit a merchant sells them in, how much ground
 * they cover, what they weigh, how much gets wasted in cutting, and what else
 * has to be bought alongside them. A patio is not just slabs — it is slabs,
 * sub-base, bedding sand and cement, and forgetting that is how a quote becomes
 * a loss.
 *
 * There are deliberately NO PRICES here. 2.1 tonnes per cubic metre for MOT
 * Type 1 is a fact about the material and is the same for everyone; what it
 * costs is the contractor's own business and lives in his price book. Splitting
 * them means a wrong density can be fixed without ever touching his money.
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
    companions: ['topsoil_screened_turf'],
  },
  turf_premium: {
    name: 'Turf — premium rye blend',
    unit: 'rolls (1m²)',
    formula: 'area_cover',
    coverM2: 1,
    wastePct: 5,
    companions: ['topsoil_screened_turf'],
  },
  artificial_grass: {
    name: 'Artificial grass (30mm pile)',
    unit: 'm²',
    formula: 'area_cover',
    coverM2: 1,
    wastePct: 10,
    companions: ['sub_base_path', 'sharp_sand_bedding'],
  },
  topsoil_screened_turf: {
    name: 'Topsoil — screened (turf bed)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.05,
    densityTPerM3: 1.5,
    wastePct: 0,
  },

  // ---------- Paving ----------
  paving_concrete_riven: {
    name: 'Paving — riven concrete 450×450',
    unit: 'slabs',
    formula: 'area_cover',
    coverM2: 0.2025,
    wastePct: 10,
    companions: ['sub_base_patio', 'sharp_sand_bedding', 'cement_bedding'],
  },
  paving_sandstone: {
    name: 'Paving — Indian sandstone 600×600',
    unit: 'slabs',
    formula: 'area_cover',
    coverM2: 0.36,
    wastePct: 10,
    companions: ['sub_base_patio', 'sharp_sand_bedding', 'cement_bedding'],
  },
  paving_porcelain: {
    name: 'Paving — vitrified porcelain 600×600',
    unit: 'slabs',
    formula: 'area_cover',
    coverM2: 0.36,
    wastePct: 10,
    companions: ['sub_base_patio', 'sharp_sand_bedding', 'cement_bedding'],
  },

  // ---------- Decking ----------
  decking_softwood: {
    name: 'Decking — treated softwood board 3.6m',
    unit: 'boards',
    formula: 'area_cover',
    coverM2: 0.522,
    wastePct: 12,
    companions: ['decking_joist'],
  },
  decking_composite: {
    name: 'Decking — composite board 3.6m',
    unit: 'boards',
    formula: 'area_cover',
    coverM2: 0.522,
    wastePct: 12,
    companions: ['decking_joist'],
  },
  decking_joist: {
    name: 'Decking joist — treated 47×100 3.6m',
    unit: 'lengths',
    formula: 'area_cover',
    coverM2: 1.44, // joists at 400mm centres
    wastePct: 5,
  },

  // ---------- Sub-base and bedding ----------
  sub_base_patio: {
    name: 'MOT Type 1 sub-base (patio, 100mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.1,
    densityTPerM3: 2.1,
    wastePct: 0,
  },
  sub_base_path: {
    name: 'MOT Type 1 sub-base (path, 80mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.08,
    densityTPerM3: 2.1,
    wastePct: 0,
  },
  sharp_sand_bedding: {
    name: 'Sharp sand — bedding (40mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.04,
    densityTPerM3: 1.6,
    wastePct: 0,
  },
  cement_bedding: {
    name: 'Cement — 25kg bag',
    unit: 'bags',
    formula: 'derived',
    derivedFrom: 'sharp_sand_bedding',
    factor: 4, // ~1:6 bedding mix, 4 × 25kg bags per tonne of sand
    offset: 0,
  },

  // ---------- Surfaces ----------
  gravel_decorative: {
    name: 'Decorative gravel 20mm (50mm depth)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.05,
    densityTPerM3: 1.6,
    wastePct: 0,
    companions: ['membrane_weed'],
  },
  bark_mulch: {
    name: 'Bark mulch (50mm depth)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.05,
    densityTPerM3: 0.35,
    wastePct: 0,
    companions: ['membrane_weed'],
  },
  membrane_weed: {
    name: 'Weed control membrane',
    unit: 'm²',
    formula: 'area_cover',
    coverM2: 1,
    wastePct: 10,
  },
  topsoil_beds: {
    name: 'Topsoil — screened (planting beds, 150mm)',
    unit: 'tonnes',
    formula: 'area_volume',
    depthM: 0.15,
    densityTPerM3: 1.5,
    wastePct: 0,
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
  },
  sleeper_oak: {
    name: 'Sleeper — green oak 2.4m',
    unit: 'units',
    formula: 'linear_unit',
    unitLengthM: 2.4,
    wastePct: 8,
  },
  edging_timber: {
    name: 'Timber edging board 3.0m',
    unit: 'units',
    formula: 'linear_unit',
    unitLengthM: 3.0,
    wastePct: 8,
  },
  edging_steel: {
    name: 'Steel edging 1.0m',
    unit: 'units',
    formula: 'linear_unit',
    unitLengthM: 1.0,
    wastePct: 5,
  },
  fence_panel_lap: {
    name: 'Fence panel — lap 1.83m',
    unit: 'panels',
    formula: 'linear_unit',
    unitLengthM: 1.83,
    wastePct: 0,
    companions: ['fence_post', 'postmix'],
  },
  fence_panel_slatted: {
    name: 'Fence panel — slatted contemporary 1.8m',
    unit: 'panels',
    formula: 'linear_unit',
    unitLengthM: 1.8,
    wastePct: 0,
    companions: ['fence_post', 'postmix'],
  },
  fence_post: {
    name: 'Fence post — treated 100×100 2.4m',
    unit: 'posts',
    formula: 'derived',
    derivedFrom: 'ZONE_PRIMARY',
    factor: 1,
    offset: 1, // one more post than panels
  },
  postmix: {
    name: 'Postmix concrete — 20kg bag',
    unit: 'bags',
    formula: 'derived',
    derivedFrom: 'fence_post',
    factor: 2,
    offset: 0,
  },

  // ---------- Planting ----------
  planting_shrubs: {
    name: 'Shrubs / perennials (3L)',
    unit: 'plants',
    formula: 'area_cover',
    coverM2: 0.6, // roughly 1 plant per 0.6m² of bed
    wastePct: 0,
  },
  planting_specimen: {
    name: 'Specimen tree / feature plant',
    unit: 'plants',
    formula: 'count',
    wastePct: 0,
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
