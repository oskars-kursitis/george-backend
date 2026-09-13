/**
 * Presets = style × tier.
 *
 * A preset does three jobs at once:
 *   1. supplies the prompt language for the render,
 *   2. declares WHICH MATERIALS the job is made of (so the model never has to
 *      infer them from pixels — it only confirms them against the photo),
 *   3. carries a £/m² band so we can set the customer's expectation BEFORE
 *      spending a token on generation.
 *
 * This file is plain data on purpose. Styles and tiers are meant to be tuned by
 * hand once real jobs come through; nothing here requires a code change elsewhere.
 */

/** Zone roles a garden job can contain. Each maps to a material via the tier. */
const ROLES = {
  LAWN: 'lawn',
  PATIO: 'patio',
  PATH: 'path',
  BEDS: 'beds',
  SCREENING: 'screening',
  DECK: 'deck',
  EDGING: 'edging',
  FEATURE: 'feature',
};

/** How a zone gets measured. Drives which input the app shows. */
const MEASURE = {
  AREA: 'area', // length × width, m²
  LINEAR: 'linear', // run, m
  COUNT: 'count', // number of items
};

const ROLE_MEASURE = {
  [ROLES.LAWN]: MEASURE.AREA,
  [ROLES.PATIO]: MEASURE.AREA,
  [ROLES.PATH]: MEASURE.AREA,
  [ROLES.BEDS]: MEASURE.AREA,
  [ROLES.DECK]: MEASURE.AREA,
  [ROLES.SCREENING]: MEASURE.LINEAR,
  [ROLES.EDGING]: MEASURE.LINEAR,
  [ROLES.FEATURE]: MEASURE.COUNT,
};

const ROLE_LABEL = {
  [ROLES.LAWN]: 'Lawn',
  [ROLES.PATIO]: 'Patio / seating area',
  [ROLES.PATH]: 'Path',
  [ROLES.BEDS]: 'Planting beds',
  [ROLES.SCREENING]: 'Fencing / screening',
  [ROLES.DECK]: 'Decking',
  [ROLES.EDGING]: 'Edging / retaining',
  [ROLES.FEATURE]: 'Feature planting',
};

const STYLES = {
  low_maintenance: {
    label: 'Low maintenance',
    blurb: 'Hard landscaping led, minimal upkeep, generous gravel and paving.',
    prompt:
      'a low-maintenance garden: generous paved seating area, decorative gravel in place of large lawn, ' +
      'structural evergreen planting in defined beds, clean simple lines, very little mown grass',
    roles: [ROLES.PATIO, ROLES.PATH, ROLES.BEDS, ROLES.EDGING],
  },
  family: {
    label: 'Family garden',
    blurb: 'Open lawn to play on, a patio for the table, safe defined borders.',
    prompt:
      'a practical family garden: a generous open level lawn for children to play on, ' +
      'a paved patio large enough for a dining table and chairs, planting kept to the borders, ' +
      'nothing fragile or spiky near the lawn',
    roles: [ROLES.LAWN, ROLES.PATIO, ROLES.BEDS, ROLES.EDGING],
  },
  contemporary: {
    label: 'Contemporary',
    blurb: 'Crisp geometry, large-format paving, slatted screens, architectural planting.',
    prompt:
      'a contemporary garden: crisp rectilinear geometry, large-format paving laid in a clean grid, ' +
      'horizontal slatted timber screening, architectural grasses and structural planting in ' +
      'rendered or corten-edged beds, restrained palette',
    roles: [ROLES.PATIO, ROLES.BEDS, ROLES.SCREENING, ROLES.EDGING],
  },
  cottage: {
    label: 'Cottage',
    blurb: 'Deep informal borders, winding path, soft abundant planting.',
    prompt:
      'an English cottage garden: deep informal borders packed with soft abundant mixed perennial planting, ' +
      'a winding path through the planting, small intimate seating area, relaxed and unstructured',
    roles: [ROLES.BEDS, ROLES.PATH, ROLES.LAWN, ROLES.EDGING],
  },
  entertaining: {
    label: 'Entertaining',
    blurb: 'Large seating zone, decking or wide patio, screening for privacy.',
    prompt:
      'a garden built for entertaining: a large seating and dining zone, raised deck or wide paved terrace, ' +
      'privacy screening to the boundary, outdoor furniture set for guests, integrated seating',
    roles: [ROLES.DECK, ROLES.PATIO, ROLES.SCREENING, ROLES.BEDS],
  },
  wildlife: {
    label: 'Wildlife friendly',
    blurb: 'Native planting, informal edges, log and gravel habitat areas.',
    prompt:
      'a wildlife-friendly garden: native and pollinator planting, informal soft edges, ' +
      'a small wild meadow area, log and gravel habitat corners, natural untreated timber',
    roles: [ROLES.BEDS, ROLES.LAWN, ROLES.PATH, ROLES.EDGING],
  },
};

/**
 * Tiers swap material grade inside a style, and set the expected £/m² band.
 * Bands are all-in build rates (materials + labour + margin) used only to show
 * the customer a range before rendering. They are NOT the quote.
 */
const TIERS = {
  value: {
    label: 'Value',
    blurb: 'Concrete paving, treated softwood, real turf. Sensible and solid.',
    pricePerM2: [55, 85],
    prompt: 'built to a modest budget using concrete paving and treated softwood, honest and tidy rather than luxurious',
    materials: {
      [ROLES.LAWN]: 'turf_standard',
      [ROLES.PATIO]: 'paving_concrete_riven',
      [ROLES.PATH]: 'gravel_decorative',
      [ROLES.BEDS]: 'bark_mulch',
      [ROLES.SCREENING]: 'fence_panel_lap',
      [ROLES.DECK]: 'decking_softwood',
      [ROLES.EDGING]: 'edging_timber',
      [ROLES.FEATURE]: 'planting_specimen',
    },
  },
  standard: {
    label: 'Standard',
    blurb: 'Sandstone paving, quality turf, planted borders. The usual sweet spot.',
    pricePerM2: [90, 140],
    prompt: 'built to a good mid-range specification with natural sandstone paving and well-stocked planted borders',
    materials: {
      [ROLES.LAWN]: 'turf_premium',
      [ROLES.PATIO]: 'paving_sandstone',
      [ROLES.PATH]: 'gravel_decorative',
      [ROLES.BEDS]: 'topsoil_beds',
      [ROLES.SCREENING]: 'fence_panel_lap',
      [ROLES.DECK]: 'decking_softwood',
      [ROLES.EDGING]: 'sleeper_softwood',
      [ROLES.FEATURE]: 'planting_specimen',
    },
  },
  premium: {
    label: 'Premium',
    blurb: 'Porcelain, composite deck, slatted screens, specimen planting.',
    pricePerM2: [150, 240],
    prompt:
      'built to a premium specification with vitrified porcelain paving, composite decking, ' +
      'slatted screening and mature specimen planting, crisp detailing throughout',
    materials: {
      [ROLES.LAWN]: 'turf_premium',
      [ROLES.PATIO]: 'paving_porcelain',
      [ROLES.PATH]: 'paving_porcelain',
      [ROLES.BEDS]: 'topsoil_beds',
      [ROLES.SCREENING]: 'fence_panel_slatted',
      [ROLES.DECK]: 'decking_composite',
      [ROLES.EDGING]: 'sleeper_oak',
      [ROLES.FEATURE]: 'planting_specimen',
    },
  },
};

/**
 * Shared render language. Two things matter most here and both are easy to lose:
 * geometry must come from the photo (not the style), and the light must read as
 * British or UK customers clock it as fake instantly.
 */
const BASE_PROMPT =
  'Photorealistic render of this exact garden after landscaping work. ' +
  'Keep the camera position, viewing angle, perspective and proportions identical to the original photo. ' +
  'Keep every fixed structure exactly as it is: house, walls, fences, boundaries, steps, drains, windows and doors. ' +
  'Only change the ground surfaces, planting and garden features. ' +
  'UK residential garden. Late afternoon daylight, bright but soft, light cloud with the sun breaking through — British light, not Californian golden hour. ' +
  'Show the garden in use: outdoor furniture, a set table, signs of life. No people, no text, no watermarks. ' +
  'Planting shown at approximately two years of growth.';

function presetId(styleKey, tierKey) {
  return `${styleKey}:${tierKey}`;
}

function parsePresetId(id) {
  const [styleKey, tierKey] = String(id || '').split(':');
  return { styleKey, tierKey };
}

/** Resolve a preset id into everything the rest of the pipeline needs. */
function resolvePreset(id) {
  const { styleKey, tierKey } = parsePresetId(id);
  const style = STYLES[styleKey];
  const tier = TIERS[tierKey];
  if (!style || !tier) {
    const error = new Error(
      `Unknown preset "${id}". Expected one of: ${listPresets()
        .map((p) => p.id)
        .join(', ')}`
    );
    // A bad preset id is the caller's mistake, not ours — say so with a 400
    // rather than letting it surface as an opaque server error.
    error.status = 400;
    throw error;
  }

  const zones = style.roles.map((role) => ({
    role,
    label: ROLE_LABEL[role],
    measure: ROLE_MEASURE[role],
    materialKey: tier.materials[role],
  }));

  return { id, styleKey, tierKey, style, tier, zones };
}

/** Flat list for the app's picker. */
function listPresets() {
  const out = [];
  for (const [styleKey, style] of Object.entries(STYLES)) {
    for (const [tierKey, tier] of Object.entries(TIERS)) {
      out.push({
        id: presetId(styleKey, tierKey),
        styleKey,
        tierKey,
        styleLabel: style.label,
        styleBlurb: style.blurb,
        tierLabel: tier.label,
        tierBlurb: tier.blurb,
        pricePerM2: tier.pricePerM2,
        roles: style.roles,
      });
    }
  }
  return out;
}

/**
 * Build the render prompt.
 * `measurements` is optional: stage 1 (concepts) has none, stage 2 (spec render)
 * passes the confirmed dimensions so the geometry in the image matches the quote.
 */
function buildPrompt({ presetId: id, brief, measurements }) {
  const { style, tier } = resolvePreset(id);
  const parts = [BASE_PROMPT, `Design direction: ${style.prompt}.`, `Specification: ${tier.prompt}.`];

  if (brief && brief.trim()) {
    parts.push(`Client's specific requirements, which take priority: "${brief.trim()}".`);
  }

  if (Array.isArray(measurements) && measurements.length) {
    const dims = measurements
      .map((m) => {
        if (m.measure === 'area') return `${m.label.toLowerCase()} approximately ${m.lengthM}m × ${m.widthM}m`;
        if (m.measure === 'linear') return `${m.label.toLowerCase()} running approximately ${m.runM}m`;
        return `${m.count} × ${m.label.toLowerCase()}`;
      })
      .join(', ');
    parts.push(
      `Match these actual site dimensions so the proportions in the image are truthful: ${dims}.`
    );
  }

  return parts.join(' ');
}

module.exports = {
  ROLES,
  MEASURE,
  ROLE_LABEL,
  ROLE_MEASURE,
  STYLES,
  TIERS,
  BASE_PROMPT,
  listPresets,
  resolvePreset,
  buildPrompt,
  presetId,
};
