const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const upload = require('../middleware/upload');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !req.file) {
      return res.status(400).json({ error: 'Photo and description are required' });
    }

    const prompt = `You are a professional garden designer. Transform the garden shown in this photo according to the following brief: "${description}". Maintain the exact same camera perspective, viewing angle, spatial layout, and structural elements (fences, walls, paths, buildings) from the original photo. Only modify the planting, landscaping, lawn, and garden features. The result should look like a photorealistic render of what this specific garden would look like after the redesign. UK residential property. Daylight, slightly overcast British sky. No people.`;

    const imageFile = await openai.toFile(req.file.buffer, 'photo.jpg', { type: req.file.mimetype });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const b64 = response.data[0].b64_json;
    const imageUrl = `data:image/png;base64,${b64}`;
    res.json({ imageUrl });

  } catch (error) {
    console.error('generateDesign error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

/*
 * TWO-STEP FALLBACK (GPT-4o Vision → DALL-E 3) — activate if gpt-image-1 access is denied
 *
 * Step 1: Send the photo to GPT-4o Vision to produce a detailed scene description
 *
 *   const base64Photo = req.file.buffer.toString('base64');
 *   const visionResponse = await openai.chat.completions.create({
 *     model: 'gpt-4o',
 *     messages: [
 *       {
 *         role: 'user',
 *         content: [
 *           {
 *             type: 'image_url',
 *             image_url: { url: `data:${req.file.mimetype};base64,${base64Photo}` },
 *           },
 *           {
 *             type: 'text',
 *             text: `Describe this garden in precise detail: dimensions, layout, fencing, paving, lawn, plants, viewing angle, lighting. Then describe how it should look after this redesign brief: "${description}". Write a single DALL-E image generation prompt that captures both the original spatial structure and the new design.`,
 *           },
 *         ],
 *       },
 *     ],
 *   });
 *   const dallePrompt = visionResponse.choices[0].message.content;
 *
 * Step 2: Generate the image with DALL-E 3 using the composed prompt
 *
 *   const imageResponse = await openai.images.generate({
 *     model: 'dall-e-3',
 *     prompt: dallePrompt,
 *     n: 1,
 *     size: '1792x1024',
 *     quality: 'standard',
 *   });
 *   const imageUrl = imageResponse.data[0].url;
 *   res.json({ imageUrl });
 */
