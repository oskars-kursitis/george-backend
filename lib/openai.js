const OpenAI = require('openai');

/**
 * Model ids in one place.
 *
 * The previous build pinned gpt-image-1 and gpt-4o, both of which retire on
 * 23 October 2026. Keeping the ids here means the next migration is a one-line
 * change rather than a hunt through the routes.
 *
 * Images (announced 8 Sep 2026):
 *   flare    — fast default, ~50% lower latency than GPT Image 2. Concepts.
 *   sunburst — editing precision for premium work, slower. The spec render.
 *
 * Text + vision:
 *   luna     — cost-optimised GPT-5.6. Everything we do is classification and
 *              extraction, so the cheap tier is the right call.
 */
const MODELS = {
  CONCEPT_IMAGE: process.env.GEORGE_CONCEPT_MODEL || 'gpt-image-2.5-flare',
  SPEC_IMAGE: process.env.GEORGE_SPEC_MODEL || 'gpt-image-2.5-sunburst',
  VISION: process.env.GEORGE_VISION_MODEL || 'gpt-5.6-luna',
};

let client;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set — copy .env.example to .env and fill it in.');
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Structured extraction against the Responses API.
 * `schema` is a plain JSON Schema; strict mode means we get valid JSON back or
 * an error, rather than the old regex-strip-and-hope approach.
 */
async function extractJson({ instructions, imageUrls = [], schemaName, schema, model = MODELS.VISION }) {
  const content = [{ type: 'input_text', text: instructions }];
  for (const url of imageUrls) {
    content.push({ type: 'input_image', image_url: url, detail: 'auto' });
  }

  const response = await getClient().responses.create({
    model,
    input: [{ role: 'user', content }],
    text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
  });

  const raw = response.output_text;
  if (!raw) throw new Error('Model returned no output text');

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Model returned unparseable JSON: ${String(raw).slice(0, 300)}`);
  }
}

module.exports = { MODELS, getClient, extractJson };
