# 🚀 PDF Export Quickstart - 2 Minute Setup

Get a working PDF generator running in literally 2 minutes!

## Quick Start

```bash
# 1. Clone and enter quickstart
cd quickstart

# 2. Install dependencies (30 seconds)
npm install

# 3. Start the server
npm run dev

# 4. Open your browser
# Go to http://localhost:3000
```

That's it! Click "Generate PDF" and you'll get a PDF download.

## What You Get

- ✅ Simple web interface
- ✅ Custom text input
- ✅ Instant PDF generation
- ✅ Letter-size format (8.5x11)
- ✅ Clean, professional output

## How It Works

1. **Frontend** (`public/index.html`) - Simple form with two inputs
2. **Backend** (`server.js`) - Express server using Puppeteer
3. **One endpoint** - POST to `/generate-pdf` returns a PDF

## Customize It

Edit the HTML template in `server.js`:

```javascript
const html = `
  <h1>Hello, ${name}!</h1>
  <p>${message}</p>
  <!-- Add your content here -->
`;
```

## Next Steps

- Add more fields to the form
- Style the PDF with CSS
- Add images or tables
- Check out the [full documentation](../) for advanced features

## Troubleshooting

**"Error generating PDF"**
- Make sure port 3000 is free
- Check that Puppeteer installed correctly: `npm install puppeteer`

**Need a different port?**
- Change `app.listen(3000)` in server.js

---

🎉 **That's it!** You now have a working PDF generator. The full documentation shows how to add multi-page support, exact positioning, different page sizes, and more.