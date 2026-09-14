const express = require('express');
const router = express.Router();

const { buildQuote, QuoteError } = require('../lib/calculator');
const { bandForArea } = require('../config/presets');

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
    const { presetId, zones, labourLines, hireLines, extraLines, options } = req.body;

    if (!presetId) return res.status(400).json({ error: 'presetId is required.' });

    const quote = buildQuote({ presetId, zones, labourLines, hireLines, extraLines, options });

    // Compare against the band for THIS job's size, not the headline rate. A
    // 22m² job carries the same skip and the same day of set-up as a 100m² one,
    // so its £/m² is far higher and the flat band would under-warn badly.
    const band = bandForArea(quote.presetId.split(':')[1], quote.totals.measuredAreaM2);
    const implied = quote.totals.impliedPerM2;

    let bandWarning = null;
    if (band && implied != null) {
      const [low, high] = band.perM2;
      if (implied < low) {
        bandWarning =
          `£${implied}/m² is below the £${low}-${high}/m² typical for ${quote.preset.tierLabel} ` +
          `work on a ${Math.round(quote.totals.measuredAreaM2)}m² job. Check your hours, and whether ` +
          `skip hire or plant is missing.`;
      } else if (implied > high) {
        bandWarning =
          `£${implied}/m² is above the £${low}-${high}/m² typical for ${quote.preset.tierLabel} ` +
          `work on a job this size.`;
      }
    }

    res.json({ ...quote, bandWarning, sizeBand: band });
  } catch (error) {
    if (error instanceof QuoteError) {
      return res.status(400).json({ error: error.message, field: error.field });
    }
    next(error);
  }
});

module.exports = router;
