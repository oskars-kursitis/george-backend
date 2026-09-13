const { extractJson } = require('./openai');
const { ROLES } = require('../config/presets');

/**
 * What work is actually being carried out.
 *
 * Without this the render embellishes: a brief saying "a fence down the right
 * side, that is it" produced a whole new lawn, patio, dining set and planted
 * borders. The customer sees that and expects all of it while paying for a
 * fence, and the disappointment lands on the contractor. The picture must not
 * promise work the quote does not contain.
 *
 * The model's job here is classification against a fixed list, which it is
 * reliable at. It never invents work that is not in the brief.
 */

const SCOPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['roles', 'worksSummary', 'leaveUnchanged', 'isFullRedesign'],
  properties: {
    roles: {
      type: 'array',
      description:
        'Only the areas of work the brief actually asks for. If the brief mentions one thing, return one role.',
      items: {
        type: 'string',
        enum: ['lawn', 'patio', 'path', 'beds', 'screening', 'deck', 'edging', 'feature'],
      },
    },
    worksSummary: {
      type: 'string',
      description:
        'One sentence in plain trade English describing exactly the work being carried out, and nothing more.',
    },
    leaveUnchanged: {
      type: 'array',
      description:
        'Things visible in a typical garden photo that this job does NOT touch and which must stay exactly as they are, e.g. "the existing lawn", "the hedge", "the existing paving and furniture". Max 6.',
      items: { type: 'string' },
    },
    isFullRedesign: {
      type: 'boolean',
      description:
        'True only if the brief asks for the whole garden to be redesigned. A brief naming specific items is not a full redesign.',
    },
  },
};

const INSTRUCTIONS = `You are reading a UK landscaping contractor's note about a job he is quoting.

Work out the SCOPE: exactly what he is being paid to do, and nothing else.

Rules, and they matter:
- Return only roles the brief actually asks for. If he writes "a fence down the right side, that is it", the scope is screening and nothing else. Do not add a lawn, a patio, planting or furniture because a garden usually has them.
- "that is it", "only", "just" mean the scope is closed. Respect that absolutely.
- leaveUnchanged should name the things a render might be tempted to improve but must not — the existing lawn, existing paving, existing planting, existing furniture, boundaries not being worked on.
- isFullRedesign is true ONLY when he is clearly redoing the whole garden.

The note follows.`;

/**
 * Derive the scope of works.
 *
 * With no brief we fall back to the chosen style's roles — picking "Family
 * garden" IS a statement that the whole garden is in play.
 */
async function deriveScope({ brief, presetRoles, isCustom }) {
  const trimmed = String(brief || '').trim();

  if (!trimmed) {
    return {
      roles: presetRoles,
      worksSummary: '',
      leaveUnchanged: [],
      isFullRedesign: true,
      source: 'preset',
    };
  }

  const result = await extractJson({
    instructions: `${INSTRUCTIONS}\n\n---\n${trimmed.slice(0, 2000)}`,
    schemaName: 'scope_of_works',
    schema: SCOPE_SCHEMA,
  });

  const valid = new Set(Object.values(ROLES));
  let roles = (result.roles || []).filter((r) => valid.has(r));

  // A style preset narrows what is on offer; a custom brief does not.
  if (!isCustom && presetRoles?.length) {
    const allowed = new Set(presetRoles);
    const narrowed = roles.filter((r) => allowed.has(r));
    if (narrowed.length) roles = narrowed;
  }

  // Never end up with nothing to do — fall back rather than render an
  // unchanged photo.
  if (!roles.length) roles = presetRoles?.length ? presetRoles : [ROLES.BEDS];

  return {
    roles,
    worksSummary: result.worksSummary || '',
    leaveUnchanged: (result.leaveUnchanged || []).slice(0, 6),
    isFullRedesign: Boolean(result.isFullRedesign),
    source: 'brief',
  };
}

module.exports = { deriveScope, SCOPE_SCHEMA };
