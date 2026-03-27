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

    // Build the landscaping prompt — this is the intelligence hardcoded into George
    const prompt = `
      You are a professional garden designer. 
      Create a photorealistic image of a transformed garden based on this brief: "${description}".
      The garden should look achievable for a UK residential property.
      Show clean landscaping with natural materials, neat lawn edges, and realistic planting.
      Daylight, slightly overcast British sky. No people. Wide shot showing the full garden.
    `;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
    });

    const imageUrl = response.data[0].url;

    res.json({ imageUrl });

  } catch (error) {
    console.error('generateDesign error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;