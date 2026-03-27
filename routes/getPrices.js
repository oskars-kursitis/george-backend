const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Hardcoded B&Q and Wickes price estimates for common landscaping materials
const retailPrices = {
  'turf': { bandq: 5.25, wickes: 4.99, unit: 'm2' },
  'gravel': { bandq: 65.00, wickes: 59.99, unit: 'tonnes' },
  'retainer block': { bandq: 1.50, wickes: 1.35, unit: 'units' },
  'sleeper': { bandq: 18.00, wickes: 16.50, unit: 'units' },
  'topsoil': { bandq: 55.00, wickes: 49.99, unit: 'tonnes' },
  'bark mulch': { bandq: 6.50, wickes: 5.99, unit: 'bags' },
  'sand': { bandq: 45.00, wickes: 42.00, unit: 'tonnes' },
  'cement': { bandq: 8.50, wickes: 7.99, unit: 'bags' },
  'paving slab': { bandq: 4.50, wickes: 4.25, unit: 'units' },
  'decking board': { bandq: 12.00, wickes: 11.50, unit: 'units' },
};

// Load supplier CSV if it exists
function loadSupplierPrices() {
  return new Promise((resolve) => {
    const supplierPrices = {};
    const csvPath = path.join(__dirname, '../uploads/supplier.csv');

    if (!fs.existsSync(csvPath)) {
      return resolve(supplierPrices);
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const name = row.name?.toLowerCase().trim();
        const price = parseFloat(row.price);
        if (name && !isNaN(price)) {
          supplierPrices[name] = price;
        }
      })
      .on('end', () => resolve(supplierPrices))
      .on('error', () => resolve(supplierPrices));
  });
}

router.post('/', async (req, res) => {
  try {
    const { elements } = req.body;

    if (!elements || !Array.isArray(elements)) {
      return res.status(400).json({ error: 'Elements array is required' });
    }

    const supplierPrices = await loadSupplierPrices();

    const items = elements.map((element) => {
      const key = element.name.toLowerCase().trim();
      const retail = retailPrices[key] || { bandq: 0, wickes: 0, unit: element.unit };
      const supplierPrice = supplierPrices[key] || null;

      return {
        name: element.name,
        unit: element.unit,
        qty: element.qty,
        bandq: retail.bandq,
        wickes: retail.wickes,
        supplier: supplierPrice,
        // Default selected price is cheapest available
        selectedPrice: Math.min(
          retail.bandq,
          retail.wickes,
          supplierPrice ?? Infinity
        ),
        selectedSource: 'cheapest',
      };
    });

    res.json({ items });

  } catch (error) {
    console.error('getPrices error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;