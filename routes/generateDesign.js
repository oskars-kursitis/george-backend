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

    // Step 1: Send the photo to GPT-4o Vision to extract precise spatial layout
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: `Analyse this garden photograph in precise spatial terms so it can be used as the basis for a photorealistic garden design render.

Describe in detail:
- Camera viewpoint and angle (e.g. ground level, slightly elevated, wide shot)
- Immediate foreground: surfaces, materials, objects
- Midground: lawn area, patio, borders, paths, their positions and approximate proportions
- Left boundary: fence type, height, material
- Right boundary: fence type, height, material, any structures
- Rear boundary: fence, hedge, trees, walls
- Any permanent structures: sheds, garages, greenhouses, outbuildings
- Ground level changes: steps, slopes, raised areas
- Sky and lighting conditions
- Overall garden shape, depth, and proportions

Be very specific about exact positions and relationships (e.g. "concrete slab patio in the immediate foreground covering roughly the bottom third of the frame, with two timber steps rising to a raised rectangular lawn that fills the centre and upper portion"). This will be injected into a DALL-E prompt so precision is essential.`,
            },
          ],
        },
      ],
      max_tokens: 800,
    });

    const gardenAnalysis = analysisResponse.choices[0].message.content;

    // Step 2: Build a DALL-E 3 prompt that locks in the spatial layout from Step 1
    // and applies the customer's design brief on top of it
    const dallePrompt = `Photorealistic garden design render for a UK residential property.

SPATIAL LAYOUT — reproduce this exactly including camera angle, viewpoint, proportions, and all permanent structures:
${gardenAnalysis}

DESIGN TRANSFORMATION — apply this design brief to the space described above. Keep the same perspective and layout; only change the landscaping, planting, and surfaces as instructed:
${description}

Style: photorealistic, professional CGI garden design. Daylight, slightly overcast British sky. No people visible. The camera angle and garden proportions must match the spatial layout described above exactly.`;

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      n: 1,
      size: '1792x1024',
      quality: 'hd',
    });

    const imageUrl = imageResponse.data[0].url;
    res.json({ imageUrl });

  } catch (error) {
    console.error('generateDesign error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
