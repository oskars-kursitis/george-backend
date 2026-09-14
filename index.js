const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { requireApiKey, rateLimit } = require('./middleware/security');
const imageStore = require('./lib/imageStore');
const { listPresets, SIZE_BANDS, LOCATIONS } = require('./config/presets');
const { keyProblem } = require('./lib/openai');
const { MATERIALS } = require('./config/materials');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');

// Render terminates TLS at its proxy. Without this req.protocol reports http,
// which would make the image URLs we hand the app http:// — and Android blocks
// cleartext to anything but localhost, so every render would fail to load.
// It also lets the rate limiter see the real client IP rather than the proxy's.
app.set('trust proxy', 1);

// One line per request. Invaluable when driving the app from a phone and the
// only other signal is a spinner.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    const flag = res.statusCode >= 400 ? '!' : ' ';
    console.log(`${flag} ${res.statusCode} ${req.method.padEnd(4)} ${req.path} ${ms}ms`);
  });
  next();
});

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

// Render pings the root as its health check. Without this it sits behind the
// API key and answers 401, which fills the log with failures and can make the
// service look unhealthy.
app.get('/', (req, res) => res.json({ service: 'george-backend', status: 'ok' }));

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
//
// ?label=Option 2 burns the label into the picture. When three concepts are
// sent to a customer over WhatsApp the order is not guaranteed, so "I like the
// second one" is ambiguous unless the image says which one it is.
app.get('/images/:id', async (req, res, next) => {
  try {
    const image = imageStore.read(req.params.id);
    if (!image) return res.status(404).json({ error: 'Not found or expired' });

    const label = String(req.query.label || '').trim().slice(0, 24);
    if (!label) {
      res.set({ 'Content-Type': image.contentType, 'Cache-Control': 'private, max-age=3600' });
      return res.send(image.buffer);
    }

    const labelled = await imageStore.withLabel(image.buffer, label);
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' });
    res.send(labelled);
  } catch (error) {
    next(error);
  }
});

app.use('/price-list', require('./routes/priceList'));

app.get('/presets', (req, res) =>
  res.json({
    presets: listPresets(),
    // Sent so the app can show a live price range as the size slider moves,
    // without duplicating the thresholds in Dart.
    sizeBands: SIZE_BANDS,
    locations: Object.entries(LOCATIONS).map(([key, v]) => ({ key, label: v.label })),
  })
);

// ---- Authenticated pipeline ------------------------------------------------

app.use(requireApiKey);

// Generation costs real money, so it is throttled harder than the rest.
app.use('/intake', rateLimit({ name: 'intake', max: 20 }), require('./routes/intake'));
app.use('/concepts', rateLimit({ name: 'concepts', max: 8 }), require('./routes/concepts'));
app.use('/zones', rateLimit({ name: 'zones', max: 20 }), require('./routes/zones'));
app.use('/quote', rateLimit({ name: 'quote', max: 120 }), require('./routes/quote'));
app.use('/amend', rateLimit({ name: 'amend', max: 20 }), require('./routes/amend'));
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

  // An auth failure against OpenAI is OUR configuration problem, not the
  // caller's. Reflecting its 401 straight through told the app its own
  // x-george-key was rejected, which is a different fault entirely — and
  // leaked the provider's error text to the handset.
  if (err?.constructor?.name?.startsWith('APIError') || err?.error?.type || err?.name === 'AuthenticationError') {
    const upstream = err.status;
    if (upstream === 401 || upstream === 403) {
      return res.status(503).json({
        error: 'George is not configured correctly. Check the server API key.',
      });
    }
    if (upstream === 429) {
      return res.status(503).json({ error: 'The image service is rate limiting us. Try again shortly.' });
    }
    return res.status(502).json({ error: 'The image service could not complete that. Try again.' });
  }

  // Detail goes to the log, not to the caller — unless it was explicitly
  // marked safe, or it is a 4xx the caller caused and can act on.
  const isClientError = err?.status >= 400 && err?.status < 500;
  const safeToShow = err?.expose === true || isClientError;
  res.status(err?.status || 500).json({
    error: safeToShow ? err.message : 'Something went wrong. Please try again.',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`George backend running on port ${PORT}`);
    console.log(`  presets:   ${listPresets().length}`);
    console.log(`  materials: ${Object.keys(MATERIALS).length}`);
    if (!process.env.GEORGE_API_KEY) console.log('  auth:      DISABLED (set GEORGE_API_KEY)');

    // Fail loudly here rather than three screens into the flow on a handset.
    const problem = keyProblem();
    if (problem) {
      console.log('');
      console.log('  !! ' + problem);
      console.log('  !! Image generation and zone detection WILL fail.');
      console.log('  !! Put your real key in .env as OPENAI_API_KEY=sk-...');
      console.log('');
    } else {
      console.log('  openai:    key present');
    }
  });
}

module.exports = app;
