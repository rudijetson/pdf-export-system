# PDF Generation Server Setup

## Overview

This guide covers setting up a server-side PDF generation system using Node.js and Puppeteer. The server handles PDF rendering in a controlled environment, ensuring consistent output across all clients.

## Architecture Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   API Server    │────▶│ Browser Manager  │────▶│ Chrome Instance │
│   (Express)     │     │   (Puppeteer)    │     │   (Headless)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Request Handler │     │   PDF Service    │     │  Page Renderer  │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Installation

### Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "puppeteer": "^23.11.1",
    "pdf-lib": "^1.17.1",
    "uuid": "^9.0.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.2"
  }
}
```

### Install Commands

```bash
# Production dependencies
npm install express puppeteer pdf-lib uuid winston

# Development dependencies
npm install -D @types/express @types/node typescript

# Optional: Use puppeteer-core with external Chrome
npm install puppeteer-core
```

## Basic Server Implementation

### Express Server Setup

```typescript
import express from 'express';
import { PDFService } from './services/pdf.service';
import { BrowserManager } from './services/browser-manager';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Initialize services
const browserManager = new BrowserManager();
const pdfService = new PDFService(browserManager);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// PDF generation endpoint
app.post('/api/pdf/generate', async (req, res) => {
  try {
    const { document, options } = req.body;
    
    // Validate request
    if (!document) {
      return res.status(400).json({ 
        error: 'Document data is required' 
      });
    }

    // Generate PDF
    const result = await pdfService.generatePDF(document, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('PDF generation failed:', error);
    res.status(500).json({ 
      error: 'PDF generation failed',
      message: error.message 
    });
  }
});

// Start server
async function startServer() {
  try {
    // Initialize browser manager
    await browserManager.initialize();
    
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
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

## Browser Manager

### Browser Pool Implementation

```typescript
import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import { logger } from '../utils/logger';

export class BrowserManager {
  private browser: Browser | null = null;
  private pagePool: Page[] = [];
  private maxPages: number = 5;
  private browserOptions: PuppeteerLaunchOptions;

  constructor() {
    this.browserOptions = this.getBrowserOptions();
  }

  private getBrowserOptions(): PuppeteerLaunchOptions {
    const options: PuppeteerLaunchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // For Docker environments
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials'
      ]
    };

    // Use external Chrome if URL provided
    if (process.env.CHROME_URL) {
      options.browserWSEndpoint = process.env.CHROME_URL;
    }

    return options;
  }

  async initialize(): Promise<void> {
    try {
      if (process.env.CHROME_URL) {
        // Connect to external Chrome instance
        this.browser = await puppeteer.connect(this.browserOptions);
        logger.info('Connected to external Chrome instance');
      } else {
        // Launch local Chrome instance
        this.browser = await puppeteer.launch(this.browserOptions);
        logger.info('Launched local Chrome instance');
      }

      // Pre-create pages for better performance
      await this.warmupPages();
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  private async warmupPages(): Promise<void> {
    if (!this.browser) return;

    for (let i = 0; i < this.maxPages; i++) {
      const page = await this.browser.newPage();
      await this.configurePage(page);
      this.pagePool.push(page);
    }
    
    logger.info(`Created ${this.maxPages} pages in pool`);
  }

  private async configurePage(page: Page): Promise<void> {
    // Set default viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    // Enable request interception for optimization
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      // Block unnecessary resources
      const resourceType = request.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        // Allow these for PDF generation
        request.continue();
      } else if (['stylesheet', 'script'].includes(resourceType)) {
        // Allow CSS and JS
        request.continue();
      } else {
        request.continue();
      }
    });

    // Handle console messages
    page.on('console', (msg) => {
      logger.debug(`Browser console: ${msg.text()}`);
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      logger.error('Page error:', error);
    });
  }

  async getPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Get page from pool or create new one
    let page = this.pagePool.pop();
    
    if (!page) {
      page = await this.browser.newPage();
      await this.configurePage(page);
    }

    return page;
  }

  async releasePage(page: Page): Promise<void> {
    try {
      // Clear page state
      await page.goto('about:blank');
      
      // Return to pool if under limit
      if (this.pagePool.length < this.maxPages) {
        this.pagePool.push(page);
      } else {
        await page.close();
      }
    } catch (error) {
      logger.error('Error releasing page:', error);
      try {
        await page.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
  }

  async close(): Promise<void> {
    // Close all pooled pages
    for (const page of this.pagePool) {
      try {
        await page.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    this.pagePool = [];

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    logger.info('Browser manager closed');
  }

  isConnected(): boolean {
    return this.browser?.isConnected() ?? false;
  }
}
```

## PDF Service

### Core PDF Generation Service

```typescript
import { PDFDocument } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';
import { BrowserManager } from './browser-manager';
import { StorageService } from './storage.service';
import { logger } from '../utils/logger';

export interface PDFGenerationOptions {
  format: 'letter' | 'a4' | 'legal' | 'custom';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  customDimensions?: {
    width: number;
    height: number;
    unit: 'mm' | 'in' | 'px';
  };
  quality?: 'low' | 'medium' | 'high';
  compression?: boolean;
}

export class PDFService {
  private browserManager: BrowserManager;
  private storageService: StorageService;
  private baseUrl: string;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
    this.storageService = new StorageService();
    this.baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  }

  async generatePDF(
    document: any,
    options: PDFGenerationOptions = { format: 'letter' }
  ): Promise<{ url: string; pages: number; size: number }> {
    const startTime = Date.now();
    const jobId = uuidv4();
    
    logger.info(`Starting PDF generation job ${jobId}`);

    let page = null;

    try {
      // Get page from pool
      page = await this.browserManager.getPage();

      // Calculate page dimensions
      const dimensions = this.calculateDimensions(options);
      
      // Set viewport to page size
      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: options.quality === 'high' ? 2 : 1
      });

      // Navigate to renderer page
      const renderUrl = `${this.baseUrl}/render?jobId=${jobId}`;
      await page.goto(renderUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Inject document data
      await page.evaluate((data) => {
        window.__DOCUMENT_DATA__ = data;
        window.localStorage.setItem('document', JSON.stringify(data));
      }, document);

      // Trigger rendering
      await page.evaluate(() => {
        if (window.renderDocument) {
          window.renderDocument();
        }
      });

      // Wait for rendering to complete
      await page.waitForSelector('.render-complete', {
        timeout: 30000
      });

      // Get page count
      const pageCount = await page.evaluate(() => {
        return document.querySelectorAll('.page').length;
      });

      // Generate PDFs for each page
      const pdfBuffers: Buffer[] = [];
      
      for (let i = 0; i < pageCount; i++) {
        // Show only current page
        await page.evaluate((pageIndex) => {
          document.querySelectorAll('.page').forEach((el, idx) => {
            (el as HTMLElement).style.display = idx === pageIndex ? 'block' : 'none';
          });
        }, i);

        // Generate PDF for current page
        const pdfBuffer = await page.pdf({
          width: dimensions.width,
          height: dimensions.height,
          printBackground: true,
          margin: options.margins || { top: 0, right: 0, bottom: 0, left: 0 }
        });

        pdfBuffers.push(pdfBuffer);
      }

      // Merge PDFs
      const mergedPdf = await this.mergePDFs(pdfBuffers);
      
      // Apply compression if requested
      const finalPdf = options.compression 
        ? await this.compressPDF(mergedPdf)
        : mergedPdf;

      // Upload to storage
      const filename = `${jobId}.pdf`;
      const url = await this.storageService.upload(finalPdf, filename);

      const duration = Date.now() - startTime;
      logger.info(`PDF generation completed in ${duration}ms`, {
        jobId,
        pages: pageCount,
        size: finalPdf.length
      });

      return {
        url,
        pages: pageCount,
        size: finalPdf.length
      };

    } catch (error) {
      logger.error(`PDF generation failed for job ${jobId}:`, error);
      throw error;
    } finally {
      if (page) {
        await this.browserManager.releasePage(page);
      }
    }
  }

  private calculateDimensions(options: PDFGenerationOptions): { 
    width: number; 
    height: number 
  } {
    const dimensions = {
      letter: { width: 816, height: 1056 },
      a4: { width: 794, height: 1123 },
      legal: { width: 816, height: 1344 }
    };

    if (options.format === 'custom' && options.customDimensions) {
      return this.convertToPixels(
        options.customDimensions.width,
        options.customDimensions.height,
        options.customDimensions.unit
      );
    }

    const baseDimensions = dimensions[options.format] || dimensions.letter;

    // Handle orientation
    if (options.orientation === 'landscape') {
      return {
        width: baseDimensions.height,
        height: baseDimensions.width
      };
    }

    return baseDimensions;
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

  private async mergePDFs(pdfBuffers: Buffer[]): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      const pdf = await PDFDocument.load(buffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }

    return Buffer.from(await mergedPdf.save());
  }

  private async compressPDF(pdfBuffer: Buffer): Promise<Buffer> {
    // PDF compression implementation
    // This is a simplified version - use pdf-lib's optimization features
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Remove unused objects
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    return Buffer.from(await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 200
    }));
  }
}
```

## Environment Configuration

### Development Environment (.env.development)

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
PUBLIC_URL=http://localhost:3000

# Chrome Configuration (optional - for external Chrome)
CHROME_URL=ws://localhost:9222/devtools/browser/
CHROME_TOKEN=

# Storage Configuration
STORAGE_TYPE=local
STORAGE_PATH=./uploads

# Logging
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### Production Environment (.env.production)

```bash
# Server Configuration
NODE_ENV=production
PORT=80
PUBLIC_URL=https://pdf-service.example.com

# Chrome Configuration
CHROME_URL=ws://chrome-service:3000
CHROME_TOKEN=secure-token-here
CHROME_IGNORE_HTTPS_ERRORS=true

# Storage Configuration
STORAGE_TYPE=s3
AWS_REGION=us-east-1
AWS_BUCKET=pdf-exports
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Performance
MAX_CONCURRENT_RENDERS=10
PAGE_POOL_SIZE=5
RENDER_TIMEOUT=60000
```

## Docker Setup

### Dockerfile

```dockerfile
FROM node:20-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app files
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  pdf-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CHROME_URL=ws://chrome:3000
    depends_on:
      - chrome
    networks:
      - pdf-network

  chrome:
    image: browserless/chrome:latest
    environment:
      - CONNECTION_TIMEOUT=60000
      - MAX_CONCURRENT_SESSIONS=10
      - ENABLE_CORS=true
      - TOKEN=secure-token-here
    ports:
      - "3001:3000"
    networks:
      - pdf-network

networks:
  pdf-network:
    driver: bridge
```

## Security Considerations

### Input Validation

```typescript
import { body, validationResult } from 'express-validator';

export const validatePDFRequest = [
  body('document').notEmpty().withMessage('Document is required'),
  body('document.content').isObject().withMessage('Invalid document content'),
  body('options.format').optional().isIn(['letter', 'a4', 'legal', 'custom']),
  body('options.margins').optional().custom((value) => {
    if (typeof value !== 'object') return false;
    const { top, right, bottom, left } = value;
    return [top, right, bottom, left].every(v => 
      typeof v === 'number' && v >= 0 && v <= 100
    );
  }),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

export const pdfRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many PDF generation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to routes
app.use('/api/pdf', pdfRateLimiter);
```

## Monitoring and Logging

### Winston Logger Configuration

```typescript
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : logFormat
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'combined.log'
    })
  ]
});
```

## Performance Optimization

### Caching Strategy

```typescript
import NodeCache from 'node-cache';

export class TemplateCache {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600, // 1 hour
      checkperiod: 600 // Check every 10 minutes
    });
  }

  async getTemplate(templateId: string): Promise<string | undefined> {
    return this.cache.get<string>(templateId);
  }

  async setTemplate(templateId: string, content: string): Promise<void> {
    this.cache.set(templateId, content);
  }
}
```