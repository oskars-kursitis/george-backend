const express = require('express');
const sharp = require('sharp');
const router = express.Router();

const { extractJson } = require('../lib/openai');
const imageStore = require('../lib/imageStore');
const { resolvePreset, ROLE_LABEL, ROLE_MEASURE } = require('../config/presets');

/**
 * POST /zones    { photoId, presetId, brief? }
 *
 * Returns the measurement checklist: which areas of work this garden actually
 * contains, and what has to be measured for each.
 *
 * Note what the model is NOT asked to do here: it never returns a quantity or a
 * dimension. Asking a vision model to eyeball "40m² of turf" was the weakest
 * link in the old pipeline and routinely 30-50% out. Its job is now
 * classification — which zones are present — which it is genuinely good at.
 * Every number comes from the contractor's tape measure.
 */

const ZONES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['zones', 'observations'],
  properties: {
    zones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'applies', 'note'],
        properties: {
          role: {
            type: 'string',
            enum: ['lawn', 'patio', 'path', 'beds', 'screening', 'deck', 'edging', 'feature'],
          },
          applies: { type: 'boolean', description: 'Does this area of work apply to this garden?' },
          note: {
            type: 'string',
            description:
              'Short plain-English pointer to where this is in the photo, to help the contractor measure it. Max 15 words.',
          },
        },
      },
    },
    observations: {
      type: 'array',
      description:
        'Site conditions a contractor would want flagged before quoting: access, slope, existing structures, drainage, obstructions, tree roots. Max 5.',
      items: { type: 'string' },
    },
  },
};

router.post('/', async (req, res, next) => {
  try {
    const { photoId, presetId, brief, location = 'back' } = req.body;

    if (!photoId) return res.status(400).json({ error: 'photoId is required (from /concepts).' });
    if (!presetId) return res.status(400).json({ error: 'presetId is required.' });
    const photo = imageStore.read(photoId);
    if (!photo) {
      return res.status(404).json({ error: 'That photo has expired. Upload it again.' });
    }

    // Downscale for the vision call. Deciding "is there a lawn here" needs far
    // less resolution than rendering does, and this is billed per image token.
    const thumbnail = await sharp(photo.buffer)
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();

    const preset = resolvePreset(presetId, { location });
    const candidateRoles = preset.zones.map((z) => z.role);

    const instructions = `You are a UK landscaping contractor looking at a photo of a garden before work starts.

This is a ${preset.place.label.toUpperCase()}.
The chosen design is "${preset.style.label}" at "${preset.tier.label}" specification.
That design normally involves these areas of work: ${candidateRoles.join(', ')}.
${brief ? `The customer has asked for: "${String(brief).slice(0, 800)}".` : ''}

For each of those areas, say whether it genuinely applies to THIS garden, and give a short pointer to where it is in the photo so the contractor knows what to measure.

Rules, and these matter:
- Do NOT estimate, guess or state any dimension, area, quantity or price. Not even approximately. The contractor measures the site himself.
- Mark applies=false for anything the photo shows is not needed (for example, screening where there is already a good wall).
- In observations, flag site conditions that would affect the price: restricted access, slope or level changes, existing slabs to lift, drainage, manhole covers, large tree roots, overhanging trees.`;

    const result = await extractJson({
      instructions,
      images: [{ buffer: thumbnail, contentType: 'image/jpeg' }],
      schemaName: 'garden_zones',
      schema: ZONES_SCHEMA,
    });

    // The preset, not the model, decides how a zone is measured and what it is
    // made of. The model only gets a say in whether it applies.
    const byRole = new Map((result.zones || []).map((z) => [z.role, z]));

    const zones = preset.zones.map((z) => {
      const seen = byRole.get(z.role);
      return {
        role: z.role,
        label: ROLE_LABEL[z.role],
        measure: ROLE_MEASURE[z.role],
        materialKey: z.materialKey,
        suggested: seen ? Boolean(seen.applies) : true,
        note: seen?.note || '',
      };
    });

    res.json({
      presetId,
      zones,
      observations: (result.observations || []).slice(0, 5),
      // The app must not let the contractor past this screen without real numbers.
      measurementRequired: true,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
