const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/**
 * Somewhere to put generated images so we can hand out real HTTP URLs.
 *
 * The old build returned `data:image/png;base64,...` straight to the app, which
 * broke three things at once: CachedNetworkImage and Image.network both reject
 * data URIs, the blob blew past multer's 1MB field limit on the way back up, and
 * it blew past express.json()'s 100kb body limit on the way to the PDF route.
 * A URL fixes all three.
 *
 * Disk-backed and ephemeral — fine for a prototype and for Render's filesystem.
 * Swap for S3/R2 when jobs need to outlive a deploy.
 */
const ROOT = path.join(os.tmpdir(), 'george-images');
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

fs.mkdirSync(ROOT, { recursive: true });

const EXT_FOR_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function save(buffer, contentType = 'image/png') {
  const ext = EXT_FOR_TYPE[contentType] || 'png';
  const id = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(ROOT, id), buffer);
  return id;
}

function saveBase64(b64, contentType = 'image/png') {
  return save(Buffer.from(b64, 'base64'), contentType);
}

function read(id) {
  // Defend the path: ids come in off the wire.
  if (!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(id)) return null;
  const file = path.join(ROOT, id);
  if (!fs.existsSync(file)) return null;
  return { buffer: fs.readFileSync(file), contentType: contentTypeFor(id) };
}

function contentTypeFor(id) {
  if (id.endsWith('.jpg')) return 'image/jpeg';
  if (id.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function publicUrl(req, id) {
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/images/${id}`;
}

/** Best-effort sweep of expired files. Called opportunistically, never blocking. */
function sweep() {
  try {
    const now = Date.now();
    for (const name of fs.readdirSync(ROOT)) {
      const file = path.join(ROOT, name);
      try {
        if (now - fs.statSync(file).mtimeMs > TTL_MS) fs.unlinkSync(file);
      } catch {
        /* another request may have removed it; not worth failing over */
      }
    }
  } catch {
    /* sweeping is opportunistic */
  }
}

/**
 * Burn a label into the top-left of an image.
 *
 * Three concepts sent to a customer arrive in whatever order the messaging app
 * feels like, so the picture has to say which one it is. Rendered as an SVG
 * overlay with a generic font family so it survives whatever fonts the host
 * container happens to have.
 */
async function withLabel(buffer, label) {
  const sharp = require('sharp');
  const { width = 1024 } = await sharp(buffer).metadata();

  const pad = Math.round(width * 0.025);
  const fontSize = Math.round(width * 0.055);
  const boxH = Math.round(fontSize * 1.9);
  const boxW = Math.round(fontSize * (1.2 + label.length * 0.62));

  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = Buffer.from(
    `<svg width="${width}" height="${boxH + pad * 2}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="${pad}" y="${pad}" rx="${Math.round(boxH / 4)}" ry="${Math.round(boxH / 4)}" ` +
      `width="${boxW}" height="${boxH}" fill="#000000" fill-opacity="0.72"/>` +
      `<text x="${pad + Math.round(boxW / 2)}" y="${pad + Math.round(boxH * 0.68)}" ` +
      `font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="${fontSize}" ` +
      `font-weight="bold" fill="#F5B800" text-anchor="middle">${escaped}</text>` +
      `</svg>`
  );

  return sharp(buffer)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

module.exports = { save, saveBase64, read, publicUrl, sweep, withLabel, ROOT, TTL_MS };
