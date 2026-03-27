const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/generate-design', require('./routes/generateDesign'));
app.use('/extract-elements', require('./routes/extractElements'));
app.use('/get-prices', require('./routes/getPrices'));
app.use('/generate-pdf', require('./routes/generatePdf'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'George is alive' });
});

app.listen(PORT, () => {
  console.log(`George backend running on port ${PORT}`);
});