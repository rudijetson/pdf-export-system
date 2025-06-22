# Basic PDF Export Example

## Overview

This example demonstrates a simple PDF export implementation for a single-page document with basic content types.

## Complete Working Example

### 1. HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Basic PDF Export</title>
    <style>
        @page {
            size: 8.5in 11in;
            margin: 0.5in;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #333;
            margin: 0;
            padding: 0;
        }
        
        .page {
            width: 816px;
            height: 1056px;
            padding: 48px;
            box-sizing: border-box;
            position: relative;
        }
        
        h1 {
            font-size: 24pt;
            margin-bottom: 16px;
            color: #000;
        }
        
        p {
            margin-bottom: 12px;
            text-align: justify;
        }
        
        .footer {
            position: absolute;
            bottom: 48px;
            left: 48px;
            right: 48px;
            text-align: center;
            font-size: 10pt;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="page">
        <h1>Sample Document</h1>
        <p>This is a sample document demonstrating basic PDF export functionality. The document is formatted to fit perfectly on a standard 8.5" × 11" letter-size page.</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
        <div class="footer">
            Page 1 of 1 - Generated on <span id="date"></span>
        </div>
    </div>
    <script>
        document.getElementById('date').textContent = new Date().toLocaleDateString();
    </script>
</body>
</html>
```

### 2. Simple Node.js Server

```javascript
// server.js
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// PDF generation endpoint
app.get('/api/pdf/generate', async (req, res) => {
    let browser;
    
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set viewport to letter size
        await page.setViewport({
            width: 816,
            height: 1056,
            deviceScaleFactor: 1
        });
        
        // Navigate to HTML template
        await page.goto(`http://localhost:${PORT}/template.html`, {
            waitUntil: 'networkidle0'
        });
        
        // Generate PDF
        const pdf = await page.pdf({
            width: '8.5in',
            height: '11in',
            printBackground: true,
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        });
        
        // Send PDF
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="document.pdf"',
            'Content-Length': pdf.length
        });
        
        res.send(pdf);
        
    } catch (error) {
        console.error('PDF generation failed:', error);
        res.status(500).json({ error: 'PDF generation failed' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
```

### 3. Client-Side Usage

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PDF Export Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        
        .container {
            text-align: center;
        }
        
        button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        button:hover {
            background-color: #0056b3;
        }
        
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        
        .status {
            margin-top: 20px;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>PDF Export Demo</h1>
        <p>Click the button below to generate a PDF document.</p>
        
        <button id="generateBtn" onclick="generatePDF()">
            Generate PDF
        </button>
        
        <div id="status" class="status"></div>
    </div>

    <script>
        async function generatePDF() {
            const button = document.getElementById('generateBtn');
            const status = document.getElementById('status');
            
            // Disable button and show status
            button.disabled = true;
            status.textContent = 'Generating PDF...';
            
            try {
                // Fetch PDF
                const response = await fetch('/api/pdf/generate');
                
                if (!response.ok) {
                    throw new Error('Failed to generate PDF');
                }
                
                // Get PDF blob
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'document.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                status.textContent = 'PDF generated successfully!';
                
            } catch (error) {
                console.error('Error:', error);
                status.textContent = 'Failed to generate PDF. Please try again.';
            } finally {
                button.disabled = false;
            }
        }
    </script>
</body>
</html>
```

### 4. Package.json

```json
{
  "name": "basic-pdf-export",
  "version": "1.0.0",
  "description": "Basic PDF export example",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^23.11.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

## Running the Example

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create directory structure:**
   ```bash
   mkdir public
   # Place template.html and index.html in public/
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open browser:**
   Navigate to `http://localhost:3000`

5. **Generate PDF:**
   Click the "Generate PDF" button

## Customization Examples

### Adding Dynamic Content

```javascript
// Modified endpoint with dynamic content
app.post('/api/pdf/generate', express.json(), async (req, res) => {
    const { title, content, author } = req.body;
    
    let browser;
    
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        // Create HTML with dynamic content
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Same styles as before */
                </style>
            </head>
            <body>
                <div class="page">
                    <h1>${title || 'Untitled Document'}</h1>
                    <p class="author">By ${author || 'Anonymous'}</p>
                    <div class="content">
                        ${content || 'No content provided.'}
                    </div>
                    <div class="footer">
                        Generated on ${new Date().toLocaleDateString()}
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // Set content
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Generate PDF
        const pdf = await page.pdf({
            format: 'Letter',
            printBackground: true
        });
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="document.pdf"'
        });
        
        res.send(pdf);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'PDF generation failed' });
    } finally {
        if (browser) await browser.close();
    }
});
```

### Adding Images

```javascript
// Handle base64 images in content
async function generatePDFWithImages(content) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 20px auto;
                }
            </style>
        </head>
        <body>
            <div class="page">
                <h1>Document with Images</h1>
                <img src="${content.imageUrl}" alt="Image">
                <p>${content.caption}</p>
            </div>
        </body>
        </html>
    `;
    
    // Rest of PDF generation...
}
```

### Multiple Formats Support

```javascript
// Support different page formats
function getPageDimensions(format) {
    const formats = {
        letter: { width: '8.5in', height: '11in' },
        a4: { width: '210mm', height: '297mm' },
        legal: { width: '8.5in', height: '14in' }
    };
    
    return formats[format] || formats.letter;
}

app.post('/api/pdf/generate', async (req, res) => {
    const { format = 'letter' } = req.body;
    const dimensions = getPageDimensions(format);
    
    // Use dimensions in PDF generation
    const pdf = await page.pdf({
        width: dimensions.width,
        height: dimensions.height,
        printBackground: true
    });
    
    // Rest of the code...
});
```

## Common Issues and Solutions

### 1. Font Rendering Issues

```css
/* Ensure fonts are embedded */
@font-face {
    font-family: 'CustomFont';
    src: url('data:font/woff2;base64,...') format('woff2');
}

body {
    font-family: 'CustomFont', Arial, sans-serif;
}
```

### 2. Image Loading Problems

```javascript
// Wait for images to load
await page.goto(url, {
    waitUntil: ['networkidle0', 'load', 'domcontentloaded']
});

// Or wait for specific images
await page.waitForSelector('img', { visible: true });
```

### 3. Memory Issues with Large PDFs

```javascript
// Use page pooling for better memory management
const pagePool = [];
const MAX_PAGES = 5;

async function getPage() {
    if (pagePool.length > 0) {
        return pagePool.pop();
    }
    return await browser.newPage();
}

async function releasePage(page) {
    await page.goto('about:blank');
    if (pagePool.length < MAX_PAGES) {
        pagePool.push(page);
    } else {
        await page.close();
    }
}
```

## Best Practices

1. **Always set explicit dimensions** for consistent output
2. **Use print-specific CSS** for better rendering
3. **Handle errors gracefully** with proper error messages
4. **Optimize performance** by reusing browser instances
5. **Test with actual printing** to verify output

## Next Steps

- Add authentication for secure PDF generation
- Implement caching for repeated requests
- Add watermarks or headers/footers
- Support for complex layouts
- Batch PDF generation