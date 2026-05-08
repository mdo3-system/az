import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import JsBarcode from 'jsbarcode';
import svgToDataURL from 'svg-to-dataurl';

const app = express();
app.use(cors());
app.use(express.json());

const generateBarcodeSVG = (text) => {
  const svgNode = {
    toString: () => '',
    setAttribute: function(key, value) { this[key] = value; }
  };
  
  JsBarcode(svgNode, text, {
    format: 'CODE128',
    width: 2,
    height: 80,
    displayValue: true,
    fontSize: 14,
    margin: 5,
    background: '#ffffff'
  });
  
  const svg = `<svg ${Object.entries(svgNode)
    .filter(([key]) => key !== 'toString')
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')}></svg>`;
    
  return svgToDataURL(svg);
};

const generateHTML = (barcodeUrl, quantity) => {
  const barcodes = Array(Math.min(quantity, 21)).fill(barcodeUrl);
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .page {
            width: 210mm;
            height: 297mm;
            position: relative;
            background: white;
          }
          .grid {
            position: absolute;
            top: 15mm;
            right: 8mm;
            bottom: 16mm;
            left: 8mm;
            display: grid;
            grid-template-columns: repeat(3, 63.5mm);
            grid-template-rows: repeat(7, 38.1mm);
            gap: 2.5mm;
          }
          .cell {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3mm;
            box-sizing: border-box;
          }
          .barcode-img {
            max-width: 57.5mm;
            max-height: 32.1mm;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="grid">
            ${Array(21).fill(null).map((_, i) => `
              <div class="cell">
                ${i < barcodes.length ? `<img class="barcode-img" src="${barcodeUrl}" alt="Barcode">` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </body>
    </html>
  `;
};

app.get('/generate-pdf', async (req, res) => {
  try {
    const { text, quantity } = req.query;
    
    if (!text || !quantity) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const barcodeUrl = generateBarcodeSVG(text);
    const html = generateHTML(barcodeUrl, parseInt(quantity));

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html);
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=barcodes.pdf');
    res.send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});