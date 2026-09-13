/**
 * Seed prices — ESTIMATES ONLY.
 *
 * These exist so a brand new user can produce a quote on day one without an
 * hour of data entry first. They are not verified merchant prices, they carry
 * no trade discount, and they are wrong for everybody.
 *
 * Every line priced from here is marked `isEstimate` all the way through to the
 * quote screen, and the contractor is asked to confirm it the first time it is
 * used. Once he has entered his own price the seed is never consulted again.
 *
 * One price per material, deliberately. The old build carried a B&Q price and a
 * Wickes price and picked the cheaper, which is a fiction — a contractor buys
 * on his own account at his own rate.
 */
const SEED_PRICES = {
  // Lawn
  turf_standard: 4.99,
  turf_premium: 6.95,
  artificial_grass: 19.99,
  topsoil_screened_turf: 49.99,

  // Paving
  paving_concrete_riven: 4.25,
  paving_sandstone: 11.75,
  paving_porcelain: 19.5,

  // Decking
  decking_softwood: 11.5,
  decking_composite: 31.5,
  decking_joist: 8.95,

  // Sub-base and bedding
  sub_base_patio: 57.5,
  sub_base_path: 57.5,
  sharp_sand_bedding: 44.0,
  cement_bedding: 7.99,

  // Surfaces
  gravel_decorative: 62.5,
  bark_mulch: 138.0,
  membrane_weed: 0.95,
  topsoil_beds: 49.99,

  // Linear
  sleeper_softwood: 16.5,
  sleeper_oak: 43.0,
  edging_timber: 6.8,
  edging_steel: 13.25,
  fence_panel_lap: 29.5,
  fence_panel_slatted: 64.0,
  fence_post: 19.5,
  postmix: 6.5,

  // Planting
  planting_shrubs: 8.75,
  planting_specimen: 62.0,
};

module.exports = { SEED_PRICES };
