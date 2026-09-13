# George — backend

Measured-quote pipeline for the George landscaping quoting app.

## The idea

Two stages, with a gate between them.

**Stage one is free and cheap.** A photo and a preset produce three low-quality
concept renders (about a penny for all three). No measurements needed, so the
contractor can stand in the garden and show the customer something inside a
minute. Nothing is priced.

**Stage two is gated on measurements the contractor supplies himself.** Once he
has measured up, the quantities come out of a formula table rather than a
model's guess, and one high-quality render is generated against those
dimensions so the picture and the price agree.

That gate is the whole design. Asking a vision model to eyeball "40m² of turf"
was routinely 30–50% out, which is not a basis for a pricing business. Now the
model only classifies — *which* areas of work are present — and every number
comes from a tape measure.

## Endpoints

| Method | Path | Does |
|---|---|---|
| `GET` | `/health` | Liveness, plus preset and material counts |
| `GET` | `/presets` | The 18 style × tier presets |
| `GET` | `/images/:id` | Serves a stored image |
| `POST` | `/intake` | Customer email → structured brief |
| `POST` | `/concepts` | Photo + preset → 3 concept renders + `photoId` |
| `POST` | `/zones` | Which areas of work apply, and what to measure |
| `POST` | `/quote` | Measured zones → priced bill of materials |
| `POST` | `/spec-render` | One high-quality render, needs measurements |
| `POST` | `/pdf` | Quote PDF as raw bytes |

Everything below `/presets` requires the `x-george-key` header once
`GEORGE_API_KEY` is set.

## Where the domain knowledge lives

- `config/materials.js` — the catalogue: purchase units, bulk densities,
  coverage, waste factors, and which companions a material drags in. A patio is
  not just slabs; it is slabs, MOT Type 1, sharp sand and cement. Forgetting
  that is how a quote becomes a loss.
- `config/presets.js` — style × tier. A preset sets the render prompt, the
  material specification *and* the £/m² band, so the render is made of what the
  budget can buy.
- `lib/calculator.js` — pure arithmetic. No model is called. Same inputs, same
  output, every time, and every line traces to a formula.

**The prices in `config/materials.js` are placeholder seed data, not verified
merchant prices.** They exist so the pipeline returns sane numbers in
development. Replace them before anyone quotes real work.

## Running it

```bash
npm install
cp .env.example .env   # then fill in OPENAI_API_KEY
npm run dev
```

```bash
npm test
```

23 tests cover the pricing maths and the PDF — the two places where a wrong
answer costs someone real money.

## Models

Pinned in `lib/openai.js` so the next migration is one file:

- `gpt-image-2.5-flare` — concepts (fast, cheap)
- `gpt-image-2.5-sunburst` — the spec render (editing precision)
- `gpt-5.6-luna` — intake parsing and zone classification

The previous build used `gpt-image-1` and `gpt-4o`, both of which retire on
**23 October 2026**.
