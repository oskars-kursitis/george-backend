const express = require('express');
const router = express.Router();

const { buildQuote, QuoteError } = require('../lib/calculator');

/**
 * POST /quote
 *
 * The gate. No measurements, no quote — the contractor cannot get a price out
 * of George without having supplied the dimensions himself, which is both what
 * makes the number trustworthy and what makes it his number rather than the
 * software's.
 *
 * No model is called here at all. Given the same inputs this returns the same
 * output, every time, and every line can be traced back to a formula.
 */
router.post('/', (req, res, next) => {
  try {
    const { presetId, zones, labour, options } = req.body;

    if (!presetId) return res.status(400).json({ error: 'presetId is required.' });

    const quote = buildQuote({ presetId, zones, labour, options });

    // Surface a mismatch between the tier's promised band and the actual number
    // rather than letting the contractor discover it in front of the customer.
    const [bandLow, bandHigh] = quote.preset.pricePerM2;
    const implied = quote.totals.impliedPerM2;
    let bandWarning = null;
    if (implied != null) {
      if (implied < bandLow) {
        bandWarning = `This works out at £${implied}/m², below the £${bandLow}-${bandHigh}/m² typical for ${quote.preset.tierLabel}. Check the labour hours before sending.`;
      } else if (implied > bandHigh) {
        bandWarning = `This works out at £${implied}/m², above the £${bandLow}-${bandHigh}/m² typical for ${quote.preset.tierLabel}.`;
      }
    }

    res.json({ ...quote, bandWarning });
  } catch (error) {
    if (error instanceof QuoteError) {
      return res.status(400).json({ error: error.message, field: error.field });
    }
    next(error);
  }
});

module.exports = router;
