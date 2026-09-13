const express = require('express');
const router = express.Router();

const { MATERIALS } = require('../config/materials');
const { SEED_PRICES } = require('../config/seedPrices');

/**
 * The price list.
 *
 * Prices belong to the contractor, not to George. This serves a CSV template
 * pre-filled with every material and its seed estimate; he edits the price
 * column in Excel on a PC and imports it back. Far less grim than thumb-typing
 * 28 rows on a phone, and it means he can keep the file as his own record.
 *
 * The `key` column is what matching is done on, so it must survive the round
 * trip. Name and unit are there to make the file readable, and are ignored on
 * import.
 */

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /price-list/template — CSV of every material, pre-filled with estimates. */
router.get('/template', (req, res) => {
  const rows = [['key', 'material', 'unit', 'price']];

  for (const [key, material] of Object.entries(MATERIALS)) {
    rows.push([key, material.name, material.unit, SEED_PRICES[key] ?? '']);
  }

  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="george-price-list.csv"',
  });
  // BOM so Excel opens the £-bearing names in UTF-8 rather than mangling them.
  res.send(`﻿${csv}`);
});

/** GET /price-list/catalogue — the same data as JSON, for in-app editing. */
router.get('/catalogue', (req, res) => {
  res.json({
    materials: Object.entries(MATERIALS).map(([key, material]) => ({
      key,
      name: material.name,
      unit: material.unit,
      seedPrice: SEED_PRICES[key] ?? null,
    })),
  });
});

module.exports = router;
