const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');

const imageStore = require('../lib/imageStore');

/**
 * POST /pdf    { quote, specImageId?, company, customer, acknowledgement }
 *
 * Returns the PDF as raw bytes. The old client called jsonDecode() on this and
 * looked for a `pdfUrl` that never existed, so the final step could never once
 * have succeeded. The app has been fixed to write these bytes to a file.
 *
 * The paperwork here is not decoration. The measurement gate stops the
 * contractor blaming George; only what is printed on the page stops his
 * customer blaming him. So the quantities are explicitly attributed to him,
 * the dimensions he entered are printed in full, exclusions are stated, and the
 * quote expires.
 */

const MARGIN = 50;
const PAGE_BOTTOM = 742; // A4 height 842 less margin
const CONTENT_WIDTH = 495;

const DEFAULT_EXCLUSIONS = [
  'Obstructions, services or made ground discovered below existing surfaces',
  'Drainage, soakaways or alterations to existing surface water runoff',
  'Removal of tree stumps or major root systems',
  'Works requiring restricted or third-party access not identified at survey',
  'Structural retaining walls over 600mm in height',
  'Any electrical, irrigation or lighting installation unless itemised above',
];

// Helvetica's WinAnsi encoding carries £ at 0xA3, so pdfkit renders it directly.
const money = (n) => `£${Number(n).toFixed(2)}`;

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
}

function rule(doc) {
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.6);
}

function heading(doc, text) {
  ensureSpace(doc, 44);
  doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text(text, MARGIN, doc.y);
  doc.moveDown(0.4);
  rule(doc);
}

/** One table row at fixed columns, with the row height driven by the widest cell. */
function tableRow(doc, cols, { bold = false, color = '#000000' } = {}) {
  const font = bold ? 'Helvetica-Bold' : 'Helvetica';
  doc.font(font).fontSize(9).fillColor(color);

  const heights = cols.map((c) => doc.heightOfString(String(c.text), { width: c.width, align: c.align || 'left' }));
  const rowHeight = Math.max(...heights, 12);

  ensureSpace(doc, rowHeight + 4);
  const y = doc.y;
  for (const c of cols) {
    doc.text(String(c.text), c.x, y, { width: c.width, align: c.align || 'left' });
  }
  doc.y = y + rowHeight + 4;
}

function describeZone(z) {
  if (z.measure === 'area') return `${z.lengthM}m x ${z.widthM}m  =  ${z.areaM2}m²`;
  if (z.measure === 'linear') return `${z.runM}m run`;
  return `${z.count} off`;
}

router.post('/', (req, res, next) => {
  try {
    const { quote, specImageId, company = {}, customer = {}, acknowledgement } = req.body;

    if (!quote || !Array.isArray(quote.items) || !quote.totals) {
      return res.status(400).json({ error: 'A quote object from /quote is required.' });
    }
    if (!quote.items.length) {
      return res.status(400).json({ error: 'Cannot produce a quote PDF with no line items.' });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      // PDF_COMPRESS=0 leaves the content streams readable so tests can assert
      // on what actually reaches the customer.
      compress: process.env.PDF_COMPRESS !== '0',
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="george-quote.pdf"',
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    });

    const now = new Date();
    const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // ---- Header -------------------------------------------------------------
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000');
    doc.text(company.name || 'Landscaping Quotation', MARGIN, MARGIN, { width: CONTENT_WIDTH });
    doc.fontSize(9).font('Helvetica').fillColor('#555555');
    const contact = [company.phone, company.email, company.vatNumber ? `VAT ${company.vatNumber}` : null]
      .filter(Boolean)
      .join('   ');
    if (contact) doc.text(contact, { width: CONTENT_WIDTH });
    doc.moveDown(0.8);

    doc.fillColor('#000000').fontSize(10);
    if (customer.name) doc.font('Helvetica-Bold').text(`For: ${customer.name}`, { width: CONTENT_WIDTH });
    if (customer.address) doc.font('Helvetica').fillColor('#555555').text(customer.address, { width: CONTENT_WIDTH });
    doc.fillColor('#555555').font('Helvetica');
    doc.text(`Quotation date: ${fmt(now)}      Valid until: ${fmt(validUntil)}`, { width: CONTENT_WIDTH });
    doc.text(`Specification: ${quote.preset.styleLabel} — ${quote.preset.tierLabel}`, { width: CONTENT_WIDTH });
    doc.moveDown(1);

    // ---- Design render ------------------------------------------------------
    if (specImageId) {
      const image = imageStore.read(specImageId);
      if (image) {
        ensureSpace(doc, 300);
        doc.image(image.buffer, MARGIN, doc.y, { fit: [CONTENT_WIDTH, 280], align: 'center' });
        doc.y += 288;
        doc.fontSize(8).fillColor('#888888').font('Helvetica-Oblique');
        doc.text(
          'Indicative render of the proposed scheme. Planting shown at approximately two years of growth.',
          MARGIN,
          doc.y,
          { width: CONTENT_WIDTH, align: 'center' }
        );
        doc.moveDown(1.2);
      }
    }

    // ---- Materials ----------------------------------------------------------
    heading(doc, 'Materials');
    const cols = (name, qty, unit, price, total) => [
      { text: name, x: MARGIN, width: 210 },
      { text: qty, x: MARGIN + 215, width: 55, align: 'right' },
      { text: unit, x: MARGIN + 275, width: 75 },
      { text: price, x: MARGIN + 350, width: 65, align: 'right' },
      { text: total, x: MARGIN + 420, width: 75, align: 'right' },
    ];
    tableRow(doc, cols('Item', 'Qty', 'Unit', 'Unit price', 'Total'), { bold: true, color: '#555555' });

    for (const item of quote.items) {
      tableRow(doc, cols(item.name, item.qty, item.unit, money(item.unitPrice), money(item.lineTotal)));
    }
    rule(doc);
    tableRow(doc, cols('Materials total', '', '', '', money(quote.totals.materialsTotal)), { bold: true });
    doc.moveDown(0.8);

    // ---- Labour and totals --------------------------------------------------
    const t = quote.totals;
    heading(doc, 'Labour and totals');
    const totalRow = (label, value, bold = false) =>
      tableRow(
        doc,
        [
          { text: label, x: MARGIN, width: 350 },
          { text: value, x: MARGIN + 355, width: 140, align: 'right' },
        ],
        { bold }
      );

    totalRow(`Labour — ${t.labourHours} hours at ${money(t.labourRate)} per hour`, money(t.labourTotal));
    totalRow('Materials', money(t.materialsTotal));
    rule(doc);
    totalRow('Subtotal', money(t.costSubtotal));
    if (t.marginPercent > 0) totalRow(`Overhead and margin (${t.marginPercent}%)`, money(t.marginAmount));
    totalRow(t.vatRegistered ? 'Net total' : 'Total', money(t.netTotal), true);
    if (t.vatRegistered) {
      totalRow(`VAT at ${t.vatRate}%`, money(t.vatAmount));
      rule(doc);
      doc.fontSize(13).font('Helvetica-Bold');
      ensureSpace(doc, 28);
      const y = doc.y;
      doc.text('TOTAL', MARGIN, y, { width: 350 });
      doc.text(money(t.grandTotal), MARGIN + 355, y, { width: 140, align: 'right' });
      doc.y = y + 24;
    } else {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#888888');
      doc.text('Not VAT registered — no VAT is chargeable on this quotation.', MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
      doc.moveDown(0.8);
    }

    // ---- Dimensions appendix — the contractor's numbers, in his name ---------
    doc.addPage();
    doc.y = MARGIN;
    heading(doc, 'Site dimensions this quotation is based on');

    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    doc.text(
      `Quantities above were calculated from the following site dimensions, measured and supplied by ` +
        `${company.name || 'the contractor'} on ${fmt(now)}. They are not estimates produced from photographs.`,
      MARGIN,
      doc.y,
      { width: CONTENT_WIDTH }
    );
    doc.moveDown(0.8);

    tableRow(
      doc,
      [
        { text: 'Area of work', x: MARGIN, width: 240 },
        { text: 'Measured', x: MARGIN + 245, width: 250 },
      ],
      { bold: true, color: '#555555' }
    );
    for (const z of quote.zones || []) {
      tableRow(doc, [
        { text: z.label, x: MARGIN, width: 240 },
        { text: describeZone(z), x: MARGIN + 245, width: 250 },
      ]);
    }
    rule(doc);
    tableRow(
      doc,
      [
        { text: 'Total measured area', x: MARGIN, width: 240 },
        { text: `${t.measuredAreaM2}m²`, x: MARGIN + 245, width: 250 },
      ],
      { bold: true }
    );
    doc.moveDown(1);

    if (acknowledgement?.confirmedAt) {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666');
      doc.text(
        `Measurements confirmed as accurate by ${acknowledgement.confirmedBy || company.name || 'the contractor'} ` +
          `on ${acknowledgement.confirmedAt}.`,
        MARGIN,
        doc.y,
        { width: CONTENT_WIDTH }
      );
      doc.moveDown(1);
    }

    // ---- Exclusions ---------------------------------------------------------
    heading(doc, 'Exclusions');
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    const exclusions = Array.isArray(company.exclusions) && company.exclusions.length
      ? company.exclusions
      : DEFAULT_EXCLUSIONS;
    for (const line of exclusions) {
      ensureSpace(doc, 18);
      doc.text(`•  ${line}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.25);
    }
    doc.moveDown(0.8);

    // ---- Terms --------------------------------------------------------------
    heading(doc, 'Terms');
    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text(
      `This quotation is valid for 30 days from the date shown and is subject to material prices at the time of order. ` +
        `Quantities include normal allowances for waste and cutting. Any variation to the specification or to the ` +
        `dimensions above will be re-quoted before work proceeds. Design renders are indicative of finish and layout ` +
        `and are not a construction drawing.`,
      MARGIN,
      doc.y,
      { width: CONTENT_WIDTH, align: 'left' }
    );
    doc.moveDown(1.5);

    doc.fontSize(7).fillColor('#aaaaaa');
    doc.text('Prepared with George', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
