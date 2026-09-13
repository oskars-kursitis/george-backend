const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { requireApiKey, rateLimit } = require('./middleware/security');
const imageStore = require('./lib/imageStore');
const { listPresets } = require('./config/presets');
const { MATERIALS } = require('./config/materials');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Body limits sized for JSON payloads only. Images travel as ids, never inline —
// the old flow posted a multi-megabyte data URI into a 100kb default limit.
app.use(express.json({ limit: '1mb' }));

// Lock CORS down to configured origins when they are set. A mobile client sends
// no Origin header at all, so it is unaffected either way.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed'));
    },
  })
);

// ---- Public ---------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({
    status: 'George is alive',
    presets: listPresets().length,
    materials: Object.keys(MATERIALS).length,
    authenticated: Boolean(process.env.GEORGE_API_KEY),
  });
});

// Generated images. Ids are 128-bit random and expire, so they are unguessable
// and short-lived; that is the right trade for a prototype.
app.get('/images/:id', (req, res) => {
  const image = imageStore.read(req.params.id);
  if (!image) return res.status(404).json({ error: 'Not found or expired' });
  res.set({ 'Content-Type': image.contentType, 'Cache-Control': 'private, max-age=3600' });
  res.send(image.buffer);
});

app.get('/presets', (req, res) => res.json({ presets: listPresets() }));

// ---- Authenticated pipeline ------------------------------------------------

app.use(requireApiKey);

// Generation costs real money, so it is throttled harder than the rest.
app.use('/intake', rateLimit({ name: 'intake', max: 20 }), require('./routes/intake'));
app.use('/concepts', rateLimit({ name: 'concepts', max: 8 }), require('./routes/concepts'));
app.use('/zones', rateLimit({ name: 'zones', max: 20 }), require('./routes/zones'));
app.use('/quote', rateLimit({ name: 'quote', max: 120 }), require('./routes/quote'));
app.use('/spec-render', rateLimit({ name: 'spec', max: 6 }), require('./routes/specRender'));
app.use('/pdf', rateLimit({ name: 'pdf', max: 30 }), require('./routes/pdf'));

// ---- Errors ----------------------------------------------------------------

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer surfaces its limits as codes; translate them into something a
  // contractor standing in a garden can act on.
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That photo is too large. Maximum 12MB.' });
  }
  if (err?.code === 'LIMIT_FIELD_VALUE') {
    return res.status(413).json({ error: 'Too much text sent with the photo.' });
  }

  console.error(`[error] ${req.method} ${req.path}:`, err);

  // Detail goes to the log, not to the caller.
  const isClientError = err?.status >= 400 && err?.status < 500;
  res.status(err?.status || 500).json({
    error: isClientError ? err.message : 'Something went wrong. Please try again.',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`George backend running on port ${PORT}`);
    console.log(`  presets:   ${listPresets().length}`);
    console.log(`  materials: ${Object.keys(MATERIALS).length}`);
    if (!process.env.GEORGE_API_KEY) console.log('  auth:      DISABLED (set GEORGE_API_KEY)');
  });
}

module.exports = app;
