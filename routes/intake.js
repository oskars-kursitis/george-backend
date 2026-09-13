const express = require('express');
const router = express.Router();
const { extractJson } = require('../lib/openai');
const { listPresets } = require('../config/presets');

/**
 * POST /intake
 *
 * Paste the customer's email or message in, get a structured brief out.
 *
 * This is the step the incumbent UK trade apps cannot do at all — Tradify and
 * Powered Now still have you typing the job in by hand. Half the measurement
 * form usually arrives pre-filled from the customer's own words.
 */

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['customerName', 'siteAddress', 'brief', 'suggestedStyle', 'suggestedTier', 'statedDimensions', 'budgetHint', 'constraints'],
  properties: {
    customerName: { type: ['string', 'null'], description: 'Customer name if stated, else null' },
    siteAddress: { type: ['string', 'null'], description: 'Site address if stated, else null' },
    brief: {
      type: 'string',
      description: 'One short paragraph, in the contractor\'s words, of what the customer wants done',
    },
    suggestedStyle: {
      type: 'string',
      enum: ['low_maintenance', 'family', 'contemporary', 'cottage', 'entertaining', 'wildlife'],
    },
    suggestedTier: { type: 'string', enum: ['value', 'standard', 'premium'] },
    statedDimensions: {
      type: 'array',
      description: 'Any measurements the customer actually stated. Do not invent or estimate any.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['what', 'lengthM', 'widthM'],
        properties: {
          what: { type: 'string' },
          lengthM: { type: ['number', 'null'] },
          widthM: { type: ['number', 'null'] },
        },
      },
    },
    budgetHint: { type: ['number', 'null'], description: 'Budget in GBP if stated, else null' },
    constraints: {
      type: 'array',
      description: 'Things that must be kept, avoided or worked around',
      items: { type: 'string' },
    },
  },
};

const INSTRUCTIONS = `You are reading an enquiry sent to a UK landscaping contractor.

Extract a structured brief. Rules:
- Only record dimensions the customer actually stated. Never estimate or infer a measurement. If none are given, return an empty array.
- suggestedStyle and suggestedTier are your best read of what they are asking for; the contractor will confirm.
- If budget is mentioned as a range, use the midpoint. If not mentioned, null.
- constraints are things like "must keep the apple tree", "dog-proof", "no gravel", "access is through the house".
- Write the brief in plain trade English, not marketing language.

Enquiry text follows.`;

router.post('/', async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Paste the customer enquiry text to parse.' });
    }
    if (String(text).length > 20000) {
      return res.status(400).json({ error: 'Enquiry text is too long (20,000 character limit).' });
    }

    const brief = await extractJson({
      instructions: `${INSTRUCTIONS}\n\n---\n${String(text).trim()}`,
      schemaName: 'landscaping_brief',
      schema: BRIEF_SCHEMA,
    });

    const suggestedPresetId = `${brief.suggestedStyle}:${brief.suggestedTier}`;
    const known = listPresets().some((p) => p.id === suggestedPresetId);

    res.json({
      brief,
      suggestedPresetId: known ? suggestedPresetId : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
