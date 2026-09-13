process.env.PDF_COMPRESS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../index');
const { buildQuote } = require('../lib/calculator');
const { resolvePreset } = require('../config/presets');

/** Start the app on an ephemeral port for the duration of one test file. */
let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(() => server?.close());

function sampleQuote() {
  const preset = resolvePreset('family:standard');
  const z = (role, dims) => ({ ...preset.zones.find((x) => x.role === role), ...dims });
  return buildQuote({
    presetId: 'family:standard',
    zones: [z('lawn', { lengthM: 8, widthM: 5 }), z('patio', { lengthM: 5, widthM: 4 })],
    labour: { hours: 110, rate: 28 },
    options: { marginPercent: 20, vatRegistered: true, vatRate: 20 },
  });
}

/** Pull readable text out of an uncompressed pdfkit document. */
function pdfText(buffer) {
  const raw = buffer.toString('latin1');
  const chunks = [];
  for (const block of raw.matchAll(/BT([\s\S]*?)ET/g)) {
    let out = '';
    for (const hex of block[1].matchAll(/<([0-9a-fA-F]+)>/g)) {
      out += Buffer.from(hex[1], 'hex').toString('latin1');
    }
    if (out.trim()) chunks.push(out);
  }
  return chunks.join('\n');
}

async function postPdf(body) {
  return fetch(`${base}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('returns PDF bytes, not JSON — the old client contract was unfulfillable', async () => {
  const res = await postPdf({ quote: sampleQuote(), company: { name: 'K&S Landscapes Ltd' } });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');

  const buffer = Buffer.from(await res.arrayBuffer());
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buffer.length > 3000);
});

test('no NaN, undefined or Infinity ever reaches the customer', async () => {
  const res = await postPdf({ quote: sampleQuote(), company: { name: 'K&S Landscapes Ltd' } });
  const text = pdfText(Buffer.from(await res.arrayBuffer()));

  for (const bad of ['NaN', 'undefined', 'Infinity', '[object']) {
    assert.ok(!text.includes(bad), `PDF contained "${bad}"`);
  }
});

test('prints the liability shield: attribution, dimensions, exclusions, expiry', async () => {
  const res = await postPdf({
    quote: sampleQuote(),
    company: { name: 'K&S Landscapes Ltd' },
    customer: { name: 'Mrs J Hartley' },
    acknowledgement: { confirmedBy: 'O. Kursitis', confirmedAt: '13 September 2026' },
  });
  const text = pdfText(Buffer.from(await res.arrayBuffer()));

  assert.match(text, /measured and supplied by K&S Landscapes Ltd/);
  assert.match(text, /Site dimensions this quotation is based on/);
  assert.match(text, /8m x 5m/);
  assert.match(text, /Total measured area/);
  assert.match(text, /Exclusions/);
  assert.match(text, /Valid until/);
  assert.match(text, /confirmed as accurate by O. Kursitis/);
});

test('prices are shown in pounds', async () => {
  const res = await postPdf({ quote: sampleQuote(), company: { name: 'Test' } });
  const text = pdfText(Buffer.from(await res.arrayBuffer()));
  assert.ok(text.includes('£'), 'expected a £ sign in the PDF');
});

test('VAT-registered and not are rendered differently', async () => {
  const preset = resolvePreset('family:value');
  const z = (role, dims) => ({ ...preset.zones.find((x) => x.role === role), ...dims });
  const noVat = buildQuote({
    presetId: 'family:value',
    zones: [z('lawn', { lengthM: 8, widthM: 5 })],
    labour: { hours: 20, rate: 25 },
    options: { vatRegistered: false },
  });

  const res = await postPdf({ quote: noVat, company: { name: 'Sole Trader' } });
  const text = pdfText(Buffer.from(await res.arrayBuffer()));
  assert.match(text, /Not VAT registered/);
  assert.ok(!text.includes('VAT at'), 'a non-registered trader should have no VAT line');
});

test('a quote with no line items is refused', async () => {
  const res = await postPdf({ quote: { items: [], totals: {}, preset: {}, zones: [] } });
  assert.equal(res.status, 400);
});

test('a malformed body is refused rather than producing a broken PDF', async () => {
  const res = await postPdf({ company: { name: 'Nope' } });
  assert.equal(res.status, 400);
});

test('a long materials list paginates instead of running off the page', async () => {
  const preset = resolvePreset('entertaining:premium');
  const z = (role, dims) => ({ ...preset.zones.find((x) => x.role === role), ...dims });
  const big = buildQuote({
    presetId: 'entertaining:premium',
    zones: [
      z('deck', { lengthM: 9, widthM: 6 }),
      z('patio', { lengthM: 8, widthM: 7 }),
      z('screening', { runM: 40 }),
      z('beds', { lengthM: 12, widthM: 2 }),
    ],
    labour: { hours: 220, rate: 32 },
    options: { marginPercent: 25, vatRegistered: true },
  });

  const res = await postPdf({ quote: big, company: { name: 'K&S Landscapes Ltd' } });
  const buffer = Buffer.from(await res.arrayBuffer());
  const pageCount = (buffer.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;

  assert.equal(res.status, 200);
  assert.ok(pageCount >= 2, `expected multiple pages, got ${pageCount}`);
  assert.ok(!pdfText(buffer).includes('undefined'));
});
