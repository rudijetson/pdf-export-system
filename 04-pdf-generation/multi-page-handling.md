# Multi-Page PDF Handling

## Overview

This document covers strategies and implementations for handling multi-page PDF generation, including content flow, page breaks, pagination, and merging multiple pages into a single PDF document.

## Core Concepts

### Page Flow Architecture

```
Content → Measurement → Pagination → Individual Rendering → Merging → Final PDF
```

### Key Challenges
1. **Content Overflow**: Detecting when content exceeds page boundaries
2. **Page Breaks**: Intelligent breaking of content across pages
3. **Consistency**: Maintaining formatting across pages
4. **Performance**: Efficiently rendering multiple pages
5. **Memory Management**: Handling large documents

## Content Measurement and Pagination

### Page Calculator Implementation

```typescript
export class PageCalculator {
  private pageHeight: number;
  private pageWidth: number;
  private margins: Margins;
  private lineHeight: number;

  constructor(config: PageConfig) {
    this.pageHeight = config.height;
    this.pageWidth = config.width;
    this.margins = config.margins;
    this.lineHeight = config.lineHeight || 20;
  }

  // Calculate how content will be distributed across pages
  calculatePages(sections: Section[]): PageLayout[] {
    const pages: PageLayout[] = [];
    let currentPage = this.createNewPage();
    let currentY = this.margins.top;
    const maxY = this.pageHeight - this.margins.bottom;

    for (const section of sections) {
      const sectionHeight = this.measureSection(section);
      
      // Check if section fits on current page
      if (currentY + sectionHeight > maxY) {
        // Check if section should break or move to next page
        if (this.canBreakSection(section) && sectionHeight > maxY - this.margins.top) {
          // Break section across pages
          const parts = this.breakSection(section, currentY, maxY);
          
          // Add first part to current page
          if (parts[0]) {
            currentPage.sections.push(parts[0]);
          }
          
          // Start new page with remaining parts
          pages.push(currentPage);
          currentPage = this.createNewPage();
          currentY = this.margins.top;
          
          // Add remaining parts
          for (let i = 1; i < parts.length; i++) {
            const partHeight = this.measureSection(parts[i]);
            
            if (currentY + partHeight > maxY) {
              pages.push(currentPage);
              currentPage = this.createNewPage();
              currentY = this.margins.top;
            }
            
            currentPage.sections.push(parts[i]);
            currentY += partHeight;
          }
        } else {
          // Move entire section to next page
          pages.push(currentPage);
          currentPage = this.createNewPage();
          currentY = this.margins.top;
          
          currentPage.sections.push(section);
          currentY += sectionHeight;
        }
      } else {
        // Section fits on current page
        currentPage.sections.push(section);
        currentY += sectionHeight;
      }
    }

    // Add final page if it has content
    if (currentPage.sections.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }

  private measureSection(section: Section): number {
    switch (section.type) {
      case 'text':
        return this.measureText(section.content);
      case 'image':
        return this.measureImage(section.content);
      case 'table':
        return this.measureTable(section.content);
      default:
        return 100; // Default height
    }
  }

  private measureText(content: string): number {
    // Calculate based on character count and line wrapping
    const charsPerLine = Math.floor((this.pageWidth - this.margins.left - this.margins.right) / 8);
    const lines = Math.ceil(content.length / charsPerLine);
    return lines * this.lineHeight;
  }

  private canBreakSection(section: Section): boolean {
    // Define which section types can be broken across pages
    const breakableTypes = ['text', 'list', 'table'];
    return breakableTypes.includes(section.type);
  }

  private breakSection(section: Section, startY: number, maxY: number): Section[] {
    const availableHeight = maxY - startY;
    
    switch (section.type) {
      case 'text':
        return this.breakTextSection(section, availableHeight);
      case 'table':
        return this.breakTableSection(section, availableHeight);
      default:
        return [section]; // Don't break
    }
  }

  private breakTextSection(section: Section, availableHeight: number): Section[] {
    const lines = Math.floor(availableHeight / this.lineHeight);
    const charsPerLine = Math.floor((this.pageWidth - this.margins.left - this.margins.right) / 8);
    const breakPoint = lines * charsPerLine;
    
    const text = section.content as string;
    
    // Find word boundary near break point
    let actualBreak = breakPoint;
    while (actualBreak > 0 && text[actualBreak] !== ' ') {
      actualBreak--;
    }
    
    if (actualBreak === 0) {
      actualBreak = breakPoint; // Force break if no word boundary
    }

    return [
      {
        ...section,
        id: `${section.id}-1`,
        content: text.substring(0, actualBreak).trim()
      },
      {
        ...section,
        id: `${section.id}-2`,
        content: text.substring(actualBreak).trim()
      }
    ];
  }

  private createNewPage(): PageLayout {
    return {
      id: `page-${Date.now()}`,
      sections: [],
      pageNumber: 0
    };
  }
}
```

## Rendering Strategy

### Sequential Page Rendering

```typescript
export class MultiPageRenderer {
  private browserManager: BrowserManager;
  private pageSize: PageSize;

  constructor(browserManager: BrowserManager, pageSize: PageSize) {
    this.browserManager = browserManager;
    this.pageSize = pageSize;
  }

  async renderPages(document: Document): Promise<Buffer[]> {
    const page = await this.browserManager.getPage();
    const pdfBuffers: Buffer[] = [];

    try {
      // Navigate to renderer
      await page.goto(`${process.env.BASE_URL}/renderer`, {
        waitUntil: 'networkidle0'
      });

      // Inject document data
      await page.evaluate((doc) => {
        window.__DOCUMENT__ = doc;
      }, document);

      // Calculate pages
      const pageLayouts = await page.evaluate(() => {
        return window.calculatePageLayouts();
      });

      // Render each page
      for (let i = 0; i < pageLayouts.length; i++) {
        await this.renderSinglePage(page, i, pdfBuffers);
      }

      return pdfBuffers;
    } finally {
      await this.browserManager.releasePage(page);
    }
  }

  private async renderSinglePage(
    page: Page,
    pageIndex: number,
    pdfBuffers: Buffer[]
  ): Promise<void> {
    // Show only current page
    await page.evaluate((index) => {
      const pages = document.querySelectorAll('.page');
      pages.forEach((p, i) => {
        (p as HTMLElement).style.display = i === index ? 'block' : 'none';
      });
    }, pageIndex);

    // Wait for render
    await page.waitForTimeout(100);

    // Generate PDF
    const pdf = await page.pdf({
      width: this.pageSize.width,
      height: this.pageSize.height,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    pdfBuffers.push(pdf);
  }
}
```

### Parallel Page Rendering (Advanced)

```typescript
export class ParallelPageRenderer {
  private browserManager: BrowserManager;
  private maxConcurrency: number = 3;

  async renderPagesParallel(
    document: Document,
    pageLayouts: PageLayout[]
  ): Promise<Buffer[]> {
    const chunks = this.chunkArray(pageLayouts, this.maxConcurrency);
    const allBuffers: Buffer[] = new Array(pageLayouts.length);

    for (const chunk of chunks) {
      const promises = chunk.map(async (layout, chunkIndex) => {
        const pageIndex = pageLayouts.indexOf(layout);
        const buffer = await this.renderPageWorker(document, layout, pageIndex);
        allBuffers[pageIndex] = buffer;
      });

      await Promise.all(promises);
    }

    return allBuffers;
  }

  private async renderPageWorker(
    document: Document,
    layout: PageLayout,
    pageIndex: number
  ): Promise<Buffer> {
    const page = await this.browserManager.getPage();

    try {
      await page.goto(`${process.env.BASE_URL}/renderer?page=${pageIndex}`, {
        waitUntil: 'networkidle0'
      });

      await page.evaluate((doc, layout) => {
        window.__DOCUMENT__ = doc;
        window.__PAGE_LAYOUT__ = layout;
        window.renderPage();
      }, document, layout);

      await page.waitForSelector('.render-complete');

      return await page.pdf({
        width: this.pageSize.width,
        height: this.pageSize.height,
        printBackground: true
      });
    } finally {
      await this.browserManager.releasePage(page);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## PDF Merging

### Using pdf-lib for Merging

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export class PDFMerger {
  async mergePages(
    pdfBuffers: Buffer[],
    options?: MergeOptions
  ): Promise<Buffer> {
    const mergedPdf = await PDFDocument.create();
    
    // Set document metadata
    if (options?.metadata) {
      mergedPdf.setTitle(options.metadata.title || '');
      mergedPdf.setAuthor(options.metadata.author || '');
      mergedPdf.setSubject(options.metadata.subject || '');
      mergedPdf.setCreationDate(new Date());
    }

    // Process each PDF buffer
    for (let i = 0; i < pdfBuffers.length; i++) {
      const pdfDoc = await PDFDocument.load(pdfBuffers[i]);
      const [page] = await mergedPdf.copyPages(pdfDoc, [0]);
      
      // Add page numbers if requested
      if (options?.addPageNumbers) {
        await this.addPageNumber(page, i + 1, pdfBuffers.length);
      }
      
      mergedPdf.addPage(page);
    }

    // Add table of contents if requested
    if (options?.addTableOfContents) {
      await this.addTableOfContents(mergedPdf, options.tableOfContents);
    }

    return Buffer.from(await mergedPdf.save());
  }

  private async addPageNumber(
    page: PDFPage,
    currentPage: number,
    totalPages: number
  ): Promise<void> {
    const { width, height } = page.getSize();
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    
    page.drawText(`${currentPage} / ${totalPages}`, {
      x: width / 2 - 30,
      y: 30,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
  }

  private async addTableOfContents(
    pdf: PDFDocument,
    entries: TOCEntry[]
  ): Promise<void> {
    const tocPage = pdf.insertPage(0);
    const { width, height } = tocPage.getSize();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    
    // Title
    tocPage.drawText('Table of Contents', {
      x: 50,
      y: height - 100,
      size: 24,
      font: boldFont
    });
    
    // Entries
    let yPosition = height - 150;
    
    for (const entry of entries) {
      tocPage.drawText(entry.title, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font
      });
      
      tocPage.drawText(entry.page.toString(), {
        x: width - 100,
        y: yPosition,
        size: 12,
        font: font
      });
      
      // Draw dots
      const dotsWidth = width - 200;
      const dotSpacing = 5;
      let dotX = 150;
      
      while (dotX < width - 110) {
        tocPage.drawText('.', {
          x: dotX,
          y: yPosition,
          size: 12,
          font: font
        });
        dotX += dotSpacing;
      }
      
      yPosition -= 25;
    }
  }
}

interface MergeOptions {
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
  };
  addPageNumbers?: boolean;
  addTableOfContents?: boolean;
  tableOfContents?: TOCEntry[];
}

interface TOCEntry {
  title: string;
  page: number;
}
```

## Page Break Strategies

### CSS Page Break Rules

```css
/* Force page breaks */
.page-break-before {
  page-break-before: always;
  break-before: always;
}

.page-break-after {
  page-break-after: always;
  break-after: always;
}

/* Avoid page breaks */
.keep-together {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Orphan and widow control */
.content {
  orphans: 3;
  widows: 3;
}

/* Section-specific rules */
h1, h2, h3 {
  page-break-after: avoid;
  break-after: avoid;
}

table {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Keep with next element */
.keep-with-next {
  page-break-after: avoid;
  break-after: avoid;
}
```

### JavaScript Page Break Detection

```typescript
export class PageBreakDetector {
  static detectOverflow(element: HTMLElement, pageHeight: number): boolean {
    const rect = element.getBoundingClientRect();
    const elementBottom = rect.top + rect.height;
    return elementBottom > pageHeight;
  }

  static findBreakPoint(
    container: HTMLElement,
    pageHeight: number
  ): HTMLElement | null {
    const children = Array.from(container.children) as HTMLElement[];
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      if (this.detectOverflow(child, pageHeight)) {
        // Check if this element can be broken
        const breakInside = window.getComputedStyle(child).breakInside;
        
        if (breakInside === 'avoid') {
          // Return previous element as break point
          return i > 0 ? children[i - 1] : null;
        } else {
          // Try to break inside this element
          return this.findBreakPoint(child, pageHeight) || child;
        }
      }
    }
    
    return null;
  }

  static applyPageBreaks(
    content: HTMLElement,
    pageHeight: number
  ): HTMLElement[] {
    const pages: HTMLElement[] = [];
    let currentPage = document.createElement('div');
    currentPage.className = 'page';
    
    const elements = Array.from(content.children) as HTMLElement[];
    
    for (const element of elements) {
      const clone = element.cloneNode(true) as HTMLElement;
      currentPage.appendChild(clone);
      
      if (this.detectOverflow(currentPage, pageHeight)) {
        // Remove last element
        currentPage.removeChild(clone);
        
        // Save current page
        pages.push(currentPage);
        
        // Start new page
        currentPage = document.createElement('div');
        currentPage.className = 'page';
        currentPage.appendChild(clone);
      }
    }
    
    // Add final page
    if (currentPage.children.length > 0) {
      pages.push(currentPage);
    }
    
    return pages;
  }
}
```

## Memory Management

### Streaming PDF Generation

```typescript
export class StreamingPDFGenerator {
  private tempDir: string = '/tmp/pdf-parts';

  async generateLargeDocument(
    document: Document,
    outputPath: string
  ): Promise<void> {
    // Ensure temp directory exists
    await fs.promises.mkdir(this.tempDir, { recursive: true });
    
    const pageFiles: string[] = [];
    
    try {
      // Generate pages in batches
      const batchSize = 10;
      const totalPages = document.pages.length;
      
      for (let i = 0; i < totalPages; i += batchSize) {
        const batch = document.pages.slice(i, i + batchSize);
        const batchFiles = await this.processBatch(batch, i);
        pageFiles.push(...batchFiles);
        
        // Clear memory
        if (global.gc) {
          global.gc();
        }
      }
      
      // Merge all pages
      await this.mergeFiles(pageFiles, outputPath);
      
    } finally {
      // Cleanup temp files
      await this.cleanup(pageFiles);
    }
  }

  private async processBatch(
    pages: Page[],
    startIndex: number
  ): Promise<string[]> {
    const files: string[] = [];
    
    for (let i = 0; i < pages.length; i++) {
      const pageIndex = startIndex + i;
      const filename = path.join(this.tempDir, `page-${pageIndex}.pdf`);
      
      const pdf = await this.renderPage(pages[i]);
      await fs.promises.writeFile(filename, pdf);
      
      files.push(filename);
    }
    
    return files;
  }

  private async mergeFiles(
    files: string[],
    outputPath: string
  ): Promise<void> {
    const mergedPdf = await PDFDocument.create();
    
    for (const file of files) {
      const pdfBytes = await fs.promises.readFile(file);
      const pdf = await PDFDocument.load(pdfBytes);
      const [page] = await mergedPdf.copyPages(pdf, [0]);
      mergedPdf.addPage(page);
      
      // Free memory
      pdfBytes.fill(0);
    }
    
    const output = await mergedPdf.save();
    await fs.promises.writeFile(outputPath, output);
  }

  private async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.promises.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}
```

## Performance Optimization

### Concurrent Processing

```typescript
export class OptimizedMultiPageRenderer {
  private workerPool: WorkerPool;
  
  constructor() {
    this.workerPool = new WorkerPool({
      size: os.cpus().length,
      workerScript: './pdf-worker.js'
    });
  }

  async renderDocument(document: Document): Promise<Buffer> {
    // Split document into chunks
    const chunks = this.splitIntoChunks(document.pages, 4);
    
    // Process chunks concurrently
    const results = await Promise.all(
      chunks.map(chunk => this.workerPool.process(chunk))
    );
    
    // Merge results
    return this.mergeResults(results);
  }

  private splitIntoChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
}
```

## Error Handling

### Robust Multi-Page Generation

```typescript
export class RobustPDFGenerator {
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  async generateWithRetry(
    document: Document
  ): Promise<{ success: boolean; pdf?: Buffer; errors?: Error[] }> {
    const errors: Error[] = [];
    const pageResults: (Buffer | null)[] = new Array(document.pages.length);
    
    // Try to render each page
    for (let i = 0; i < document.pages.length; i++) {
      let success = false;
      
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          pageResults[i] = await this.renderPage(document.pages[i]);
          success = true;
          break;
        } catch (error) {
          errors.push(new Error(`Page ${i + 1}, attempt ${attempt + 1}: ${error.message}`));
          
          if (attempt < this.maxRetries - 1) {
            await this.delay(this.retryDelay * (attempt + 1));
          }
        }
      }
      
      if (!success) {
        // Generate error page
        pageResults[i] = await this.generateErrorPage(i + 1);
      }
    }
    
    // Filter out null pages
    const validPages = pageResults.filter(p => p !== null) as Buffer[];
    
    if (validPages.length === 0) {
      return { success: false, errors };
    }
    
    try {
      const merged = await this.mergePDFs(validPages);
      return { 
        success: true, 
        pdf: merged,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      errors.push(error);
      return { success: false, errors };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async generateErrorPage(pageNumber: number): Promise<Buffer> {
    // Generate a simple error page
    const html = `
      <html>
        <body style="display: flex; align-items: center; justify-content: center; height: 100vh;">
          <div style="text-align: center;">
            <h1>Error Rendering Page ${pageNumber}</h1>
            <p>This page could not be rendered. Please try again.</p>
          </div>
        </body>
      </html>
    `;
    
    // Convert HTML to PDF (simplified)
    return Buffer.from(html);
  }
}
```

## Best Practices

### 1. Content Structure
- Use semantic HTML for better page break detection
- Apply appropriate CSS page break rules
- Structure content in logical sections

### 2. Performance
- Render pages concurrently when possible
- Use page pooling for better resource utilization
- Implement caching for repeated content

### 3. Memory Management
- Stream large documents
- Clear buffers after use
- Implement garbage collection hints

### 4. Error Recovery
- Implement retry logic
- Generate placeholder pages for failures
- Log detailed error information

### 5. User Experience
- Show progress for long documents
- Provide page count estimates
- Allow partial document generation