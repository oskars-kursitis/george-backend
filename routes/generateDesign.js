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

    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const response = await openai.images.edit({
  model: 'gpt-image-1',
  image: Buffer.from(base64Image, 'base64'),
  prompt: `Transform this garden image by doing ONLY this: "${description}".
  
  Rules:
  - Do NOT change the fence, walls, patio, lawn, shed, or any existing features unless the customer specifically asked for them to change
  - Do NOT add furniture, decorations, or plants that were not requested
  - Do NOT change the sky, lighting, or background
  - Do NOT alter the perspective or camera angle
  - ONLY make the single change the customer described
  - Everything else must remain exactly as it appears in the original photo`,
  n: 1,
  size: '1024x1024',
});

    const imageBase64 = response.data[0].b64_json;
    const imageUrl = `data:image/png;base64,${imageBase64}`;

    res.json({ imageUrl });

  } catch (error) {
    console.error('generateDesign error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;