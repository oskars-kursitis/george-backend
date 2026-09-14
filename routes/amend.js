const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const { getClient, MODELS } = require('../lib/openai');
const imageStore = require('../lib/imageStore');

/**
 * POST /amend    { imageId, amendment }
 *
 * "I like it, but can the fence be brown?"
 *
 * Edits the image the customer already approved rather than generating fresh
 * ones. Regenerating would hand back three new random variations and lose the
 * design they just agreed to — expensive in the only currency that matters
 * here, which is the customer's goodwill, not tokens.
 *
 * Cheap model, low quality, n=1: comfortably under a penny per tweak.
 */

const AMEND_PROMPT = (amendment) =>
  `Make this one change to the image: ${amendment}. ` +
  'Change ONLY that. Every other element must stay exactly as it is — the same layout, ' +
  'the same materials, the same planting, the same furniture, the same lighting, the same ' +
  'camera angle and composition. Do not re-render, restyle, tidy or improve any other part ' +
  'of the scene. This is a small correction to an agreed design, not a new design.';

router.post('/', async (req, res, next) => {
  try {
    const { imageId, amendment } = req.body;

    if (!imageId) return res.status(400).json({ error: 'imageId is required.' });
    if (!amendment || !String(amendment).trim()) {
      return res.status(400).json({ error: 'Describe the change you want.' });
    }
    if (String(amendment).length > 500) {
      return res.status(400).json({ error: 'Keep the change to a sentence or two.' });
    }

    const source = imageStore.read(imageId);
    if (!source) {
      return res.status(404).json({ error: 'That image has expired. Generate the concepts again.' });
    }

    const imageFile = await OpenAI.toFile(source.buffer, 'concept.png', {
      type: source.contentType,
    });

    const result = await getClient().images.edit({
      model: MODELS.CONCEPT_IMAGE,
      image: imageFile,
      prompt: AMEND_PROMPT(String(amendment).trim()),
      size: '1024x1024',
      quality: 'low',
      output_format: 'webp',
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: 'The image service returned nothing. Try again.' });

    const id = imageStore.saveBase64(b64, 'image/webp');
    imageStore.sweep();

    res.json({
      id,
      url: imageStore.publicUrl(req, id),
      // Handed back so the app can keep it with the job — the change has to
      // reach the final render too, not just this picture.
      amendment: String(amendment).trim(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
