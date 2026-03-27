const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const upload = require('../middleware/upload');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', upload.single('before'), async (req, res) => {
  try {
    const { afterImageUrl } = req.body;

    if (!afterImageUrl || !req.file) {
      return res.status(400).json({ error: 'Before photo and after image URL are required' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a professional landscaper reviewing a garden transformation.
              Look at these two garden images and identify exactly what materials and work would be needed.
              Return ONLY a JSON array with no explanation, like this:
              [
                { "name": "Turf", "unit": "m2", "qty": 40 },
                { "name": "Gravel", "unit": "tonnes", "qty": 2 },
                { "name": "Retainer Block", "unit": "units", "qty": 60 }
              ]
              Only include physical materials that need to be purchased. Be specific and realistic for a UK garden.`
            },
            {
              type: 'image_url',
              image_url: { url: afterImageUrl }
            }
          ]
        }
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    // Strip any markdown formatting just in case
    const cleaned = content.replace(/```json|```/g, '').trim();
    const elements = JSON.parse(cleaned);

    res.json({ elements });

  } catch (error) {
    console.error('extractElements error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;