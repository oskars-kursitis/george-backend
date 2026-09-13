const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const OpenAI = require('openai');

const upload = require('../middleware/upload');
const { getClient, MODELS } = require('../lib/openai');
const imageStore = require('../lib/imageStore');
const { buildPrompt, resolvePreset } = require('../config/presets');

/**
 * POST /concepts    (multipart: photo, presetId, brief?)
 *
 * Stage one of two. Three cheap concept renders at low quality, no measurements
 * required, so the contractor can stand in the garden and show the customer
 * something inside a minute. At roughly a penny for all three, a rejected
 * direction costs nothing — which is the whole point of splitting the stages.
 *
 * Returns a photoId for the original so later steps never re-upload it.
 */

const CONCEPT_COUNT = 3;

router.post('/', upload.single('photo'), async (req, res, next) => {
  try {
    const { presetId, brief, location = 'back', approxAreaM2 } = req.body;

    if (!req.file) return res.status(400).json({ error: 'A photo of the garden is required.' });
    if (!presetId) return res.status(400).json({ error: 'presetId is required.' });

    // Throws with the valid list if the id is wrong — cheaper than an API round trip.
    const preset = resolvePreset(presetId, { location });

    // Normalise orientation and size before it goes anywhere near the model.
    const normalised = await sharp(req.file.buffer)
      .rotate()
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    const photoId = imageStore.save(normalised, 'image/jpeg');

    const prompt = buildPrompt({ presetId, brief, location, approxAreaM2: Number(approxAreaM2) });
    const imageFile = await OpenAI.toFile(normalised, 'garden.jpg', { type: 'image/jpeg' });

    const result = await getClient().images.edit({
      model: MODELS.CONCEPT_IMAGE,
      image: imageFile,
      prompt,
      size: '1024x1024',
      quality: 'low',
      output_format: 'webp',
      n: CONCEPT_COUNT,
    });

    const concepts = (result.data || []).map((item, index) => ({
      index,
      id: imageStore.saveBase64(item.b64_json, 'image/webp'),
    }));

    if (!concepts.length) {
      return res.status(502).json({ error: 'The image service returned no concepts. Try again.' });
    }

    imageStore.sweep();

    res.json({
      photoId,
      photoUrl: imageStore.publicUrl(req, photoId),
      presetId,
      location,
      preset: {
        styleLabel: preset.style.label,
        tierLabel: preset.tier.label,
        pricePerM2: preset.tier.pricePerM2,
      },
      concepts: concepts.map((c) => ({ index: c.index, id: c.id, url: imageStore.publicUrl(req, c.id) })),
      // Concepts are indicative only. The quote comes from measurements, not this.
      disclaimer:
        'Concept only — not to scale and not priced. Measure the garden to produce a quote.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
