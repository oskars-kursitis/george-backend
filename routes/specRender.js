const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const { getClient, MODELS } = require('../lib/openai');
const imageStore = require('../lib/imageStore');
const { buildPrompt } = require('../config/presets');

/**
 * POST /spec-render    { photoId, presetId, brief?, measurements }
 *
 * Stage two. One high-quality render on the precision editing model, generated
 * only once the contractor has measured the site — so the dimensions in the
 * prompt make the proportions in the image truthful, and the picture the
 * customer sees agrees with the number underneath it.
 *
 * This is the expensive call, which is exactly why it sits behind the gate:
 * tyre-kickers never reach it.
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      photoId,
      presetId,
      brief,
      measurements,
      location = 'back',
      scope,
      referenceImageId,
      materialNames,
    } = req.body;

    if (!photoId) return res.status(400).json({ error: 'photoId is required (from /concepts).' });
    if (!presetId) return res.status(400).json({ error: 'presetId is required.' });
    if (!Array.isArray(measurements) || measurements.length === 0) {
      return res.status(400).json({
        error: 'Measurements are required before the final render. Measure the site first.',
      });
    }

    const original = imageStore.read(photoId);
    if (!original) return res.status(404).json({ error: 'That photo has expired. Upload it again.' });

    // By stage two the area is measured, not estimated, so the scale language
    // is anchored to a real number.
    const measuredArea = measurements
      .filter((m) => m.measure === 'area')
      .reduce((sum, m) => sum + Number(m.lengthM || 0) * Number(m.widthM || 0), 0);

    const prompt = buildPrompt({
      presetId,
      brief,
      measurements,
      location,
      approxAreaM2: measuredArea > 0 ? measuredArea : undefined,
      scope,
      materialNames,
    });
    const images = [
      await OpenAI.toFile(original.buffer, 'garden.jpg', { type: original.contentType }),
    ];

    // The concept the customer actually agreed to, passed as a design
    // reference. Without it the final render is a fresh roll of the dice and
    // may not resemble the option they picked.
    let promptWithReference = prompt;
    if (referenceImageId) {
      const reference = imageStore.read(referenceImageId);
      if (reference) {
        images.push(
          await OpenAI.toFile(reference.buffer, 'agreed-design.webp', { type: reference.contentType })
        );
        promptWithReference =
          `${prompt} The SECOND image is the design the customer has already agreed to. ` +
          'Reproduce that same design — the same layout, materials, planting and detailing — ' +
          'applied to the first image, corrected to the real dimensions given above. ' +
          'The first image is the true site; the second is the agreed look.';
      }
    }

    const result = await getClient().images.edit({
      model: MODELS.SPEC_IMAGE,
      image: images.length > 1 ? images : images[0],
      prompt: promptWithReference,
      size: '1024x1024',
      quality: 'high',
      output_format: 'png',
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: 'The image service returned nothing. Try again.' });

    const id = imageStore.saveBase64(b64, 'image/png');
    imageStore.sweep();

    res.json({
      id,
      url: imageStore.publicUrl(req, id),
      promptUsed: prompt,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
