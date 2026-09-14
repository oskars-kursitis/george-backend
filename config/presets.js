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
 * A sensible starting material for each area of work.
 *
 * Deliberately NOT tied to the tier any more. The tier used to silently pick
 * materials, which meant four different things competed to decide the same
 * question — the brief, the tier, the contractor's own choice and his own
 * catalogue. Materials now come from one place: proposed from the brief,
 * defaulted here when it says nothing, and changed by the contractor whenever
 * he likes.
 */
const DEFAULT_MATERIALS = {
  [ROLES.LAWN]: 'turf_standard',
  [ROLES.PATIO]: 'paving_sandstone',
  [ROLES.PATH]: 'gravel_decorative',
  [ROLES.BEDS]: 'topsoil_beds',
  [ROLES.SCREENING]: 'fence_panel_lap',
  [ROLES.DECK]: 'decking_softwood',
  [ROLES.EDGING]: 'sleeper_softwood',
  [ROLES.FEATURE]: 'planting_specimen',
};

/**
 * Tiers are now purely about FINISH — how posh it looks and roughly what that
 * costs per square metre. They no longer choose a single material.
 * Bands are all-in build rates (materials + labour + margin) used only to show
 * the customer a range before rendering. They are NOT the quote.
 */
const TIERS = {
  value: {
    label: 'Value',
    blurb: 'Neat and practical. Plain detailing, simple shapes, nothing fussy.',
    pricePerM2: [55, 85],
    prompt:
      'a plain, honest finish — simple shapes, straightforward detailing, tidy rather than luxurious, ' +
      'sparser planting, no decorative extras',
  },
  standard: {
    label: 'Standard',
    blurb: 'Well finished and well stocked. The usual sweet spot.',
    pricePerM2: [90, 140],
    prompt:
      'a well-finished result — neat edges, well-stocked planting, considered proportions, ' +
      'the standard of work a good local contractor turns out',
  },
  premium: {
    label: 'Premium',
    blurb: 'Crisp detailing, generous planting, a designed look.',
    pricePerM2: [150, 240],
    prompt:
      'a premium finish — crisp precise detailing, tight joints, generous mature planting, ' +
      'considered lighting, the look of a designed garden rather than a tidied one',
  },
};

/**
 * Shared render language. Two things matter most here and both are easy to lose:
 * geometry must come from the photo (not the style), and the light must read as
 * British or UK customers clock it as fake instantly.
 */
/**
 * Shared render language.
 *
 * Deliberately says nothing about furniture or "signs of life". That used to
 * live here unconditionally and it caused real harm: a brief asking for a fence
 * and nothing else came back as a full makeover with a dining set, which the
 * customer would reasonably expect to be included. Furniture is now added only
 * when the job actually builds somewhere to sit.
 */
const BASE_PROMPT =
  'Photorealistic render of this exact garden after landscaping work. ' +
  'Keep the camera position, viewing angle, perspective and proportions identical to the original photo. ' +
  'Keep every fixed structure exactly as it is: house, walls, fences, boundaries, steps, drains, windows and doors. ' +
  'UK residential garden. Late afternoon daylight, bright but soft, light cloud with the sun breaking through — British light, not Californian golden hour. ' +
  'No people, no text, no watermarks. Planting shown at approximately two years of growth.';

/** Human-readable description of each area of work, for the render prompt. */
const ROLE_WORKS = {
  [ROLES.LAWN]: 'the lawn',
  [ROLES.PATIO]: 'the paved patio or seating area',
  [ROLES.PATH]: 'the path',
  [ROLES.BEDS]: 'the planting beds',
  [ROLES.SCREENING]: 'the fencing or screening',
  [ROLES.DECK]: 'the decking',
  [ROLES.EDGING]: 'the edging or retaining',
  [ROLES.FEATURE]: 'the feature planting',
};

/**
 * Fixed costs do not scale down. The same skip, the same minimum aggregate
 * load, the same day of access and set-up land on a 20m2 garden as on a 100m2
 * one — so the rate per square metre climbs steeply as jobs get small.
 *
 * Quoting a small job at large-job rates under-quotes it, which is the exact
 * failure this build exists to prevent.
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
    materialKey: DEFAULT_MATERIALS[role],
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
/**
 * Build the render prompt.
 *
 * `scope` is the decisive part: the render must depict the work being quoted
 * for and nothing else. A picture that promises a new patio when the quote is
 * for a fence is not a nice extra, it is a mis-sell waiting to happen.
 */
function buildPrompt({ presetId: id, brief, measurements, location = 'back', approxAreaM2, scope }) {
  const { style, tier, place } = resolvePreset(id, { location });
  const parts = [BASE_PROMPT, place.prompt];

  const roles = scope?.roles?.length ? scope.roles : style.roles;
  const isFullRedesign = scope ? scope.isFullRedesign !== false : true;

  // --- What is being done, and just as importantly what is not -------------
  const works = roles.map((r) => ROLE_WORKS[r]).filter(Boolean);
  if (works.length) {
    parts.push(`THE ONLY WORK BEING CARRIED OUT IS: ${works.join(', ')}.`);
  }
  if (scope?.worksSummary) {
    parts.push(`Specifically: ${scope.worksSummary}`);
  }

  if (!isFullRedesign) {
    parts.push(
      'CRITICAL — this is NOT a garden makeover. Change ONLY the work listed above. ' +
        'Everything else in the photograph must remain exactly as it is, including its current ' +
        'condition: do not improve, replace, tidy, re-turf, re-pave or restyle anything that is ' +
        'not on that list, and do not add any new feature, planting, lighting or furniture. ' +
        'A worn lawn stays a worn lawn. The customer is paying only for the work listed.'
    );
    if (scope?.leaveUnchanged?.length) {
      parts.push(`Leave completely untouched: ${scope.leaveUnchanged.join(', ')}.`);
    }
  } else {
    // Only dress the garden when the job actually builds somewhere to sit.
    const hasSeating = roles.includes(ROLES.PATIO) || roles.includes(ROLES.DECK);
    if (hasSeating) {
      parts.push('Show the seating area in use with suitable outdoor furniture.');
    }
  }

  // --- Design language ------------------------------------------------------
  if (style.prompt && isFullRedesign) parts.push(`Design direction: ${style.prompt}.`);

  // Name the materials actually in scope rather than reciting the tier's stock
  // sentence. A fencing job should not be told about sandstone paving.
  const { MATERIALS } = require('./materials');
  const specMaterials = roles
    .map((r) => tier.materials[r])
    .filter(Boolean)
    .map((key) => MATERIALS[key]?.name)
    .filter(Boolean);

  if (specMaterials.length) {
    parts.push(`Build it from: ${[...new Set(specMaterials)].join('; ')}.`);
  }
  // Always. This is now the tier's only job in the render, and it describes
  // finish rather than specification, so it cannot contradict the materials.
  parts.push(`Finish: ${tier.prompt}.`);

  if (brief && brief.trim()) {
    parts.push(`Client's specific requirements, which take priority: "${brief.trim()}".`);
  }

  // --- Scale ----------------------------------------------------------------
  if (Number.isFinite(approxAreaM2) && approxAreaM2 > 0) {
    parts.push(
      `IMPORTANT — SCALE: the whole garden is only about ${Math.round(approxAreaM2)} square metres. ` +
        `Keep the proportions truthful to that size. Do not enlarge the space, do not extend it into the ` +
        `distance, and do not include any feature or furniture that would not physically fit in ` +
        `${Math.round(approxAreaM2)} square metres. A small garden should look small.`
    );
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
  DEFAULT_MATERIALS,
  ROLE_LABEL,
  ROLE_MEASURE,
  STYLES,
  TIERS,
  BASE_PROMPT,
  ROLE_WORKS,
  listPresets,
  resolvePreset,
  buildPrompt,
  presetId,
};
