const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post('/generate-pdf', async (req, res) => {
  try {
    const { name = 'World', message = 'This is your PDF!' } = req.body;
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 40px;
              background: white;
            }
            .container {
              max-width: 8.5in;
              margin: 0 auto;
              text-align: center;
            }
            h1 {
              color: #333;
              font-size: 48px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              font-size: 24px;
              line-height: 1.6;
            }
            .timestamp {
              margin-top: 50px;
              font-size: 14px;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Hello, ${name}!</h1>
            <p>${message}</p>
            <p class="timestamp">Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
      </html>
    `;
    
    await page.setContent(html);
    const pdf = await page.pdf({ 
      format: 'Letter',
      printBackground: true 
    });
    
    await browser.close();
    
    res.contentType('application/pdf');
    res.send(pdf);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error generating PDF');
  }
});

app.listen(3000, () => {
  console.log('🚀 PDF Server running at http://localhost:3000');
  console.log('📄 Open your browser and click "Generate PDF"');
});