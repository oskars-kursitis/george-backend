const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => {
      cb(null, `upload-${Date.now()}${path.extname(file.originalname) || '.jpg'}`);
    }
  }),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

router.post('/', upload.single('photo'), async (req, res) => {
  let resizedPath;

  try {
    const { description } = req.body;

    if (!description || !req.file) {
      return res.status(400).json({ error: 'Photo and description are required' });
    }

    resizedPath = `/tmp/resized-${Date.now()}.jpg`;

    await sharp(req.file.path)
      .rotate()
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(resizedPath);

    const imageFile = await OpenAI.toFile(
      fs.createReadStream(resizedPath),
      'garden.jpg',
      { type: 'image/jpeg' }
    );

    const result = await client.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: `Edit this garden photo based on this request: "${description}". Only make requested changes. Keep everything else the same.`,
      size: '1024x1024'
    });

    res.json({
      imageUrl: `data:image/png;base64,${result.data[0].b64_json}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (resizedPath && fs.existsSync(resizedPath)) fs.unlinkSync(resizedPath);
  }
});

module.exports = router;