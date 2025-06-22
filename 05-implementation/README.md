# PDF Export Implementation Guide

## Overview

This guide provides a complete implementation example of a PDF export system, bringing together all the concepts from the previous documentation sections.

## Project Structure

```
pdf-export-system/
├── src/
│   ├── server/
│   │   ├── index.ts              # Main server entry
│   │   ├── routes/               # API routes
│   │   └── services/             # Business logic
│   ├── renderer/
│   │   ├── index.html            # HTML template
│   │   ├── styles.css            # Print styles
│   │   └── renderer.ts           # Client-side rendering
│   ├── shared/
│   │   ├── types/                # Shared TypeScript types
│   │   └── utils/                # Shared utilities
│   └── config/
│       └── constants.ts          # Configuration constants
├── public/                       # Static assets
├── tests/                        # Test files
├── .env                         # Environment variables
├── package.json                 # Dependencies
└── tsconfig.json               # TypeScript config
```

## Complete Implementation Example

### 1. Server Entry Point

```typescript
// src/server/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { pdfRouter } from './routes/pdf.routes';
import { BrowserManager } from './services/browser-manager.service';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global services
export const browserManager = new BrowserManager();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Routes
app.use('/api/pdf', pdfRouter);

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Initialize browser
    await browserManager.initialize();
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await browserManager.close();
  process.exit(0);
});

startServer();
```

### 2. PDF Generation Service

```typescript
// src/server/services/pdf-generator.service.ts
import { Page } from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { BrowserManager } from './browser-manager.service';
import { PageCalculator } from './page-calculator.service';
import { Document, PDFOptions, GenerationResult } from '../../shared/types';
import { logger } from '../utils/logger';

export class PDFGenerator {
  constructor(
    private browserManager: BrowserManager,
    private pageCalculator: PageCalculator
  ) {}

  async generate(
    document: Document,
    options: PDFOptions
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    let page: Page | null = null;

    try {
      // Get browser page
      page = await this.browserManager.getPage();

      // Calculate page dimensions
      const dimensions = this.calculateDimensions(options);
      
      // Set viewport
      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: options.quality === 'high' ? 2 : 1
      });

      // Navigate to renderer
      const rendererUrl = `${process.env.BASE_URL}/renderer`;
      await page.goto(rendererUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Inject document data
      await page.evaluate((doc) => {
        window.__DOCUMENT__ = doc;
      }, document);

      // Calculate page layouts
      const pageLayouts = this.pageCalculator.calculatePages(
        document.sections,
        dimensions
      );

      // Render pages
      const pdfBuffers = await this.renderPages(page, pageLayouts, dimensions);

      // Merge PDFs
      const finalPdf = await this.mergePDFs(pdfBuffers, options);

      const duration = Date.now() - startTime;
      logger.info(`PDF generated in ${duration}ms`, {
        pages: pdfBuffers.length,
        size: finalPdf.length
      });

      return {
        success: true,
        pdf: finalPdf,
        metadata: {
          pages: pdfBuffers.length,
          size: finalPdf.length,
          duration
        }
      };

    } catch (error) {
      logger.error('PDF generation failed:', error);
      throw error;
    } finally {
      if (page) {
        await this.browserManager.releasePage(page);
      }
    }
  }

  private calculateDimensions(options: PDFOptions): { 
    width: number; 
    height: number 
  } {
    const sizes = {
      letter: { width: 816, height: 1056 },
      a4: { width: 794, height: 1123 },
      legal: { width: 816, height: 1344 }
    };

    if (options.format === 'custom' && options.customSize) {
      return this.convertToPixels(
        options.customSize.width,
        options.customSize.height,
        options.customSize.unit
      );
    }

    return sizes[options.format] || sizes.letter;
  }

  private convertToPixels(
    width: number,
    height: number,
    unit: 'mm' | 'in' | 'px'
  ): { width: number; height: number } {
    const MM_TO_PX = 3.779528;
    const IN_TO_PX = 96;

    switch (unit) {
      case 'mm':
        return {
          width: Math.round(width * MM_TO_PX),
          height: Math.round(height * MM_TO_PX)
        };
      case 'in':
        return {
          width: Math.round(width * IN_TO_PX),
          height: Math.round(height * IN_TO_PX)
        };
      default:
        return { width, height };
    }
  }

  private async renderPages(
    page: Page,
    pageLayouts: PageLayout[],
    dimensions: { width: number; height: number }
  ): Promise<Buffer[]> {
    const buffers: Buffer[] = [];

    for (let i = 0; i < pageLayouts.length; i++) {
      // Render page layout
      await page.evaluate((layout, index) => {
        window.renderPage(layout, index);
      }, pageLayouts[i], i);

      // Wait for render complete
      await page.waitForSelector('.render-complete', {
        timeout: 10000
      });

      // Generate PDF
      const pdf = await page.pdf({
        width: dimensions.width,
        height: dimensions.height,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      buffers.push(pdf);

      // Clear for next page
      await page.evaluate(() => {
        document.querySelector('.render-complete')?.remove();
      });
    }

    return buffers;
  }

  private async mergePDFs(
    buffers: Buffer[],
    options: PDFOptions
  ): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();

    // Set metadata
    if (options.metadata) {
      mergedPdf.setTitle(options.metadata.title || '');
      mergedPdf.setAuthor(options.metadata.author || '');
      mergedPdf.setCreationDate(new Date());
    }

    // Copy pages
    for (const buffer of buffers) {
      const pdf = await PDFDocument.load(buffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }

    // Save with compression
    return Buffer.from(await mergedPdf.save({
      useObjectStreams: options.compress !== false
    }));
  }
}
```

### 3. Client-Side Renderer

```html
<!-- public/renderer/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Renderer</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="root"></div>
  <script src="renderer.js"></script>
</body>
</html>
```

```css
/* public/renderer/styles.css */
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  color: #333;
}

/* Page styles */
.page {
  position: relative;
  background: white;
  overflow: hidden;
  page-break-after: always;
}

/* Print-specific styles */
@media print {
  .page {
    margin: 0;
    box-shadow: none;
  }
}

/* Section styles */
.section {
  position: relative;
}

.section-text {
  padding: 0;
}

.section-heading {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 16px;
  page-break-after: avoid;
}

.section-paragraph {
  margin-bottom: 12px;
  text-align: justify;
  orphans: 3;
  widows: 3;
}

/* Table styles */
.section-table {
  width: 100%;
  border-collapse: collapse;
  page-break-inside: avoid;
}

.section-table th,
.section-table td {
  padding: 8px;
  border: 1px solid #ddd;
  text-align: left;
}

.section-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

/* List styles */
.section-list {
  padding-left: 20px;
}

.section-list li {
  margin-bottom: 4px;
}

/* Image styles */
.section-image {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

/* Column layouts */
.columns {
  display: flex;
  gap: 24px;
}

.column {
  flex: 1;
}

.column-70 {
  flex: 0 0 70%;
}

.column-30 {
  flex: 0 0 30%;
}

/* Utility classes */
.page-break-before {
  page-break-before: always;
}

.page-break-after {
  page-break-after: always;
}

.keep-together {
  page-break-inside: avoid;
}

/* Render state */
.render-complete {
  position: absolute;
  top: -9999px;
  left: -9999px;
}
```

```typescript
// public/renderer/renderer.ts
interface Document {
  sections: Section[];
  layout: LayoutConfig;
  styles: StyleConfig;
}

interface PageLayout {
  sections: Section[];
  pageNumber: number;
}

class PDFRenderer {
  private root: HTMLElement;
  private document: Document;

  constructor() {
    this.root = document.getElementById('root')!;
    this.document = window.__DOCUMENT__ || this.loadFromLocalStorage();
    
    // Auto-render if document is available
    if (this.document) {
      this.render();
    }
  }

  private loadFromLocalStorage(): Document | null {
    const data = localStorage.getItem('document');
    return data ? JSON.parse(data) : null;
  }

  render(): void {
    if (!this.document) {
      console.error('No document data available');
      return;
    }

    // Clear existing content
    this.root.innerHTML = '';

    // Apply custom styles
    if (this.document.styles?.customCSS) {
      this.applyCustomStyles(this.document.styles.customCSS);
    }

    // Render document
    const pages = this.calculatePageLayouts();
    pages.forEach((page, index) => {
      this.renderPage(page, index);
    });

    // Signal render complete
    this.signalComplete();
  }

  renderPage(layout: PageLayout, index: number): void {
    const pageEl = document.createElement('div');
    pageEl.className = 'page';
    pageEl.id = `page-${index}`;
    
    // Set page dimensions
    const dimensions = this.getPageDimensions();
    pageEl.style.width = `${dimensions.width}px`;
    pageEl.style.height = `${dimensions.height}px`;

    // Render sections
    layout.sections.forEach(section => {
      const sectionEl = this.renderSection(section);
      pageEl.appendChild(sectionEl);
    });

    this.root.appendChild(pageEl);
  }

  private renderSection(section: Section): HTMLElement {
    const sectionEl = document.createElement('div');
    sectionEl.className = `section section-${section.type}`;
    
    switch (section.type) {
      case 'text':
        return this.renderTextSection(section);
      case 'markdown':
        return this.renderMarkdownSection(section);
      case 'table':
        return this.renderTableSection(section);
      case 'image':
        return this.renderImageSection(section);
      case 'list':
        return this.renderListSection(section);
      default:
        return sectionEl;
    }
  }

  private renderTextSection(section: Section): HTMLElement {
    const div = document.createElement('div');
    div.className = 'section section-text';
    
    const p = document.createElement('p');
    p.className = 'section-paragraph';
    p.textContent = section.content;
    
    div.appendChild(p);
    return div;
  }

  private renderMarkdownSection(section: Section): HTMLElement {
    const div = document.createElement('div');
    div.className = 'section section-markdown';
    
    // Simple markdown parsing (in practice, use a library)
    const html = this.parseMarkdown(section.content);
    div.innerHTML = html;
    
    return div;
  }

  private renderTableSection(section: Section): HTMLElement {
    const div = document.createElement('div');
    div.className = 'section section-table-container';
    
    const table = document.createElement('table');
    table.className = 'section-table';
    
    // Render table content
    const data = section.content as TableData;
    
    // Header
    if (data.headers) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      data.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
    }
    
    // Body
    const tbody = document.createElement('tbody');
    data.rows.forEach(row => {
      const tr = document.createElement('tr');
      
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    div.appendChild(table);
    
    return div;
  }

  private renderImageSection(section: Section): HTMLElement {
    const div = document.createElement('div');
    div.className = 'section section-image-container';
    
    const img = document.createElement('img');
    img.className = 'section-image';
    img.src = section.content.src;
    img.alt = section.content.alt || '';
    
    div.appendChild(img);
    return div;
  }

  private renderListSection(section: Section): HTMLElement {
    const div = document.createElement('div');
    div.className = 'section section-list-container';
    
    const list = document.createElement(section.content.ordered ? 'ol' : 'ul');
    list.className = 'section-list';
    
    section.content.items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    
    div.appendChild(list);
    return div;
  }

  private parseMarkdown(markdown: string): string {
    // Simplified markdown parser
    return markdown
      .replace(/^# (.+)$/gm, '<h1 class="section-heading">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="section-heading">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 class="section-heading">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p class="section-paragraph">')
      .replace(/^/, '<p class="section-paragraph">')
      .replace(/$/, '</p>');
  }

  private calculatePageLayouts(): PageLayout[] {
    // Simplified page calculation
    // In practice, use PageCalculator service
    return [{
      sections: this.document.sections,
      pageNumber: 1
    }];
  }

  private getPageDimensions(): { width: number; height: number } {
    const formats = {
      letter: { width: 816, height: 1056 },
      a4: { width: 794, height: 1123 }
    };
    
    return formats[this.document.layout?.format || 'letter'];
  }

  private applyCustomStyles(css: string): void {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  private signalComplete(): void {
    const marker = document.createElement('div');
    marker.className = 'render-complete';
    document.body.appendChild(marker);
  }
}

// Global functions for Puppeteer
window.renderDocument = function() {
  const renderer = new PDFRenderer();
  renderer.render();
};

window.renderPage = function(layout: PageLayout, index: number) {
  const renderer = new PDFRenderer();
  renderer.renderPage(layout, index);
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  new PDFRenderer();
});
```

### 4. API Routes

```typescript
// src/server/routes/pdf.routes.ts
import { Router } from 'express';
import { PDFController } from '../controllers/pdf.controller';
import { validatePDFRequest } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limit';

const router = Router();
const controller = new PDFController();

// Generate PDF
router.post(
  '/generate',
  authenticate,
  rateLimiter,
  validatePDFRequest,
  controller.generate.bind(controller)
);

// Get PDF status
router.get(
  '/status/:jobId',
  authenticate,
  controller.getStatus.bind(controller)
);

// Download PDF
router.get(
  '/download/:jobId',
  authenticate,
  controller.download.bind(controller)
);

export { router as pdfRouter };
```

### 5. Shared Types

```typescript
// src/shared/types/index.ts
export interface Document {
  id: string;
  title: string;
  sections: Section[];
  layout: LayoutConfig;
  styles: StyleConfig;
}

export interface Section {
  id: string;
  type: 'text' | 'markdown' | 'table' | 'image' | 'list' | 'custom';
  content: any;
  style?: SectionStyle;
  metadata?: Record<string, any>;
}

export interface LayoutConfig {
  format: 'letter' | 'a4' | 'legal' | 'custom';
  orientation?: 'portrait' | 'landscape';
  margins?: Margins;
  columns?: ColumnConfig[];
}

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PDFOptions {
  format: 'letter' | 'a4' | 'legal' | 'custom';
  customSize?: {
    width: number;
    height: number;
    unit: 'mm' | 'in' | 'px';
  };
  margins?: Margins;
  quality?: 'low' | 'medium' | 'high';
  compress?: boolean;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
  };
}

export interface GenerationResult {
  success: boolean;
  pdf?: Buffer;
  error?: string;
  metadata?: {
    pages: number;
    size: number;
    duration: number;
  };
}
```

## Running the System

### Development Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run in development
npm run dev
```

### Production Deployment

```bash
# Build the project
npm run build

# Run in production
npm start
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .
RUN npm run build

# Run as non-root
USER node

EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

## Testing

### Unit Tests

```typescript
// tests/pdf-generator.test.ts
import { PDFGenerator } from '../src/server/services/pdf-generator.service';
import { mockDocument, mockOptions } from './fixtures';

describe('PDFGenerator', () => {
  let generator: PDFGenerator;

  beforeEach(() => {
    generator = new PDFGenerator(mockBrowserManager, mockPageCalculator);
  });

  it('should generate PDF with correct dimensions', async () => {
    const result = await generator.generate(mockDocument, mockOptions);
    
    expect(result.success).toBe(true);
    expect(result.metadata.pages).toBe(2);
    expect(result.pdf).toBeInstanceOf(Buffer);
  });

  it('should handle custom page sizes', async () => {
    const options = {
      ...mockOptions,
      format: 'custom',
      customSize: { width: 16, height: 19, unit: 'in' }
    };
    
    const result = await generator.generate(mockDocument, options);
    
    expect(result.success).toBe(true);
  });
});
```

## Next Steps

1. Implement authentication and authorization
2. Add cloud storage support (S3, GCS)
3. Implement webhook notifications
4. Add template support
5. Create monitoring dashboard
6. Add support for more content types
7. Implement batch processing
8. Add internationalization support