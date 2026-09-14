const express = require('express');
const sharp = require('sharp');
const router = express.Router();

const upload = require('../middleware/upload');
const { extractJson } = require('../lib/openai');
const imageStore = require('../lib/imageStore');
const { MATERIALS } = require('../config/materials');

/**
 * POST /inspiration    (multipart: image, photoId?)
 *
 * "We went to Italy and saw this garden — can we do something like that?"
 *
 * Customers turn up with pictures constantly: a holiday photo, something off
 * Instagram, or increasingly an AI render of their own garden. Reading it does
 * two jobs at once — it steers the render, and it tells the contractor what
 * that look is actually made of, which is what feeds the price.
 *
 * The two cases are handled differently and the difference matters. A render of
 * THEIR garden is close to a target and can be followed. A garden in Italy is a
 * style reference only: its materials and planting are worth taking, its
 * geometry and its climate are not.
 */

const INSPIRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['styleDescription', 'materials', 'looksLikeSameGarden', 'caveats', 'summary'],
  properties: {
    summary: {
      type: 'string',
      description: 'One short sentence a contractor would say to a customer about what this look is.',
    },
    styleDescription: {
      type: 'string',
      description:
        'Prompt-ready description of the LOOK only: surfaces, materials, planting palette, detailing, ' +
        'mood and light. Do not describe the layout, the shape of the plot, or the buildings.',
    },
    materials: {
      type: 'array',
      description: 'The catalogue materials this look would be built from. Empty if unclear.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'materialKey'],
        properties: {
          role: {
            type: 'string',
            enum: ['lawn', 'patio', 'path', 'beds', 'screening', 'deck', 'edging', 'feature'],
          },
          materialKey: { type: 'string', enum: Object.keys(MATERIALS) },
        },
      },
    },
    looksLikeSameGarden: {
      type: 'boolean',
      description:
        'True only if this appears to be the SAME garden as the site photo, already visualised — ' +
        'same house, same boundaries, same viewpoint. A different garden that merely looks similar is false.',
    },
    caveats: {
      type: 'array',
      description:
        'Practical warnings for building this in the UK: planting that will not survive a British winter, ' +
        'materials that stain or go slippery here, features that need drainage or a lot of sun. Max 4. ' +
        'Empty if there is nothing worth saying.',
      items: { type: 'string' },
    },
  },
};

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const { photoId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'An inspiration photo is required.' });

    const normalised = await sharp(req.file.buffer)
      .rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const inspirationId = imageStore.save(normalised, 'image/jpeg');

    // Downscale for the vision call — reading a style needs far less
    // resolution than rendering one.
    const images = [
      {
        buffer: await sharp(normalised).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 78 }).toBuffer(),
        contentType: 'image/jpeg',
      },
    ];

    // Their actual garden, if we have it, so "is this the same place?" can be
    // answered rather than guessed.
    const site = photoId ? imageStore.read(photoId) : null;
    if (site) {
      images.push({
        buffer: await sharp(site.buffer).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 78 }).toBuffer(),
        contentType: 'image/jpeg',
      });
    }

    const instructions = `A customer has sent their landscaper this picture of a garden they like.

${site ? 'The FIRST image is what they sent. The SECOND image is the customer\'s actual garden.' : 'The image is what they sent.'}

Describe the LOOK so it can be applied to a different garden:
- styleDescription: surfaces, materials, planting palette, detailing, mood, light. Never the layout, plot shape or buildings — those belong to whatever garden it was photographed in, not to the customer's.
- materials: what this look would be built from, using the catalogue list.
- looksLikeSameGarden: true ONLY if this is clearly the customer's own garden already visualised${site ? ' — compare it with the second image' : ''}. A different garden that happens to look similar is false.
- caveats: honest practical warnings for building this in the UK. Mediterranean planting that will not survive a British winter, stone that stains or goes slippery in wet weather, anything needing far more sun or drainage than a UK garden gets. Say nothing if there is nothing worth saying.`;

    const result = await extractJson({
      instructions,
      images,
      schemaName: 'garden_inspiration',
      schema: INSPIRATION_SCHEMA,
    });

    const materials = {};
    for (const m of result.materials || []) {
      if (MATERIALS[m.materialKey]) materials[m.role] = m.materialKey;
    }

    imageStore.sweep();

    res.json({
      inspirationId,
      url: imageStore.publicUrl(req, inspirationId),
      summary: result.summary || '',
      styleDescription: result.styleDescription || '',
      materials,
      materialNames: Object.values(materials).map((k) => MATERIALS[k].name),
      looksLikeSameGarden: Boolean(result.looksLikeSameGarden),
      caveats: (result.caveats || []).slice(0, 4),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
