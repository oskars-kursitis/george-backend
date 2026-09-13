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

/**
 * Front or back. This changes more than the words in the prompt.
 *
 * A front garden is for arrival, kerb appeal and access — it does not get a
 * dining patio or a deck. The first real test of this put a six-seater table
 * and a parasol in a 4x5m front garden, because nothing in the system knew
 * front gardens existed.
 */
const LOCATIONS = {
  back: {
    label: 'Back garden',
    allowedRoles: null, // no restriction
    prompt: 'This is a private rear garden, enclosed and not overlooked from the street.',
  },
  front: {
    label: 'Front garden',
    allowedRoles: ['lawn', 'path', 'beds', 'edging', 'screening', 'feature'],
    prompt:
      'This is a FRONT garden, open to the street and the pavement. It is for arrival and kerb appeal, ' +
      'not for sitting out. Absolutely no outdoor dining furniture, no table and chairs, no parasol and ' +
      'no sofa or lounge seating — those belong in a back garden and would look absurd here. ' +
      'Focus on the approach to the front door, a clean path, tidy planting, a defined boundary, ' +
      'and discreet bin storage if there is room.',
  },
};

const STYLES = {
  /**
   * No style — the contractor has described the job himself.
   *
   * The styles are a shortcut for when there is no brief. Forcing a choice on
   * someone who has already written what he wants is backwards, so this entry
   * stands in: it contributes no design language of its own and offers every
   * area of work, leaving the zones step to decide what the garden actually
   * contains.
   */
  custom: {
    label: 'From your brief',
    blurb: 'Use what you have written, with no preset design on top.',
    prompt: '',
    requiresBrief: true,
    roles: [
      ROLES.LAWN,
      ROLES.PATIO,
      ROLES.PATH,
      ROLES.BEDS,
      ROLES.SCREENING,
      ROLES.DECK,
      ROLES.EDGING,
    ],
  },
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

/**
 * Fixed costs do not scale down. The same skip, the same minimum aggregate
 * load, the same day of access and set-up land on a 20m2 garden as on a 100m2
 * one — so the rate per square metre climbs steeply as jobs get small.
 *
 * Quoting a small job at large-job rates under-quotes it, which is the exact
 * failure this build exists to prevent. These multipliers adjust the tier's
 * headline band for the size of the actual job.
 */
const SIZE_BANDS = [
  { underM2: 15, multiplier: 1.9, label: 'Very small job — fixed costs dominate' },
  { underM2: 30, multiplier: 1.6, label: 'Small job' },
  { underM2: 60, multiplier: 1.25, label: 'Average domestic garden' },
  { underM2: 120, multiplier: 1.0, label: 'Large garden' },
  { underM2: null, multiplier: 0.9, label: 'Very large — economies of scale' },
];

function smallJobMultiplier(areaM2) {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return 1;
  const band = SIZE_BANDS.find((b) => b.underM2 === null || areaM2 < b.underM2);
  return band.multiplier;
}

/** The tier's rate band adjusted for job size, plus the resulting total. */
function bandForArea(tierKey, areaM2) {
  const tier = TIERS[tierKey];
  if (!tier) return null;

  const [low, high] = tier.pricePerM2;
  const multiplier = smallJobMultiplier(areaM2);
  const perM2 = [Math.round(low * multiplier), Math.round(high * multiplier)];

  return {
    perM2,
    basePerM2: tier.pricePerM2,
    multiplier,
    total:
      Number.isFinite(areaM2) && areaM2 > 0
        ? [Math.round(perM2[0] * areaM2), Math.round(perM2[1] * areaM2)]
        : null,
  };
}

function presetId(styleKey, tierKey) {
  return `${styleKey}:${tierKey}`;
}

function parsePresetId(id) {
  const [styleKey, tierKey] = String(id || '').split(':');
  return { styleKey, tierKey };
}

/** Resolve a preset id into everything the rest of the pipeline needs. */
function resolvePreset(id, { location = 'back' } = {}) {
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

  const place = LOCATIONS[location] || LOCATIONS.back;
  const roles = place.allowedRoles
    ? style.roles.filter((role) => place.allowedRoles.includes(role))
    : style.roles;

  const zones = roles.map((role) => ({
    role,
    label: ROLE_LABEL[role],
    measure: ROLE_MEASURE[role],
    materialKey: tier.materials[role],
  }));

  return { id, styleKey, tierKey, style, tier, zones, location, place };
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
        isCustom: styleKey === 'custom',
        requiresBrief: Boolean(style.requiresBrief),
        tierLabel: tier.label,
        tierBlurb: tier.blurb,
        pricePerM2: tier.pricePerM2,
        roles: style.roles,
        rolesByLocation: {
          back: style.roles,
          front: style.roles.filter((r) => LOCATIONS.front.allowedRoles.includes(r)),
        },
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
function buildPrompt({ presetId: id, brief, measurements, location = 'back', approxAreaM2 }) {
  const { style, tier, place } = resolvePreset(id, { location });
  const parts = [BASE_PROMPT, place.prompt];
  // A custom preset carries no design language of its own — the brief is the
  // design direction, so adding an empty "Design direction:." line would only
  // dilute it.
  if (style.prompt) parts.push(`Design direction: ${style.prompt}.`);
  parts.push(`Specification: ${tier.prompt}.`);

  // Stage one has no measurements, so without this the model invents generic
  // proportions and cheerfully fits a six-seater dining set into 20m2.
  if (Number.isFinite(approxAreaM2) && approxAreaM2 > 0) {
    parts.push(
      `IMPORTANT — SCALE: the whole garden is only about ${Math.round(approxAreaM2)} square metres. ` +
        `Keep the proportions truthful to that size. Do not enlarge the space, do not extend it into the ` +
        `distance, and do not include any feature or furniture that would not physically fit in ` +
        `${Math.round(approxAreaM2)} square metres. A small garden should look small.`
    );
  }

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
  LOCATIONS,
  SIZE_BANDS,
  bandForArea,
  smallJobMultiplier,
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
