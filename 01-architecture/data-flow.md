# PDF Export Data Flow

## Overview

This document describes how data flows through the PDF export system from user input to final PDF output.

## Data Flow Diagram

```
User Input → Client State → API Request → Server Processing → Browser Rendering → PDF Generation → Storage → Download
```

## Detailed Flow

### 1. User Input Phase

**Data Sources**:
- Document content (markdown, text, structured data)
- Layout configuration (pages, columns, sections)
- Style settings (fonts, colors, spacing)
- Page settings (size, margins, orientation)

**Data Structure**:
```typescript
interface DocumentData {
  content: {
    sections: Section[];
    metadata: Metadata;
  };
  layout: {
    pages: Page[];
    format: 'letter' | 'a4' | 'custom';
    margins: Margins;
  };
  styles: {
    typography: Typography;
    colors: ColorScheme;
    customCSS?: string;
  };
}
```

### 2. Client State Management

**State Storage**:
- React Context/Redux for global state
- Local storage for persistence
- Session storage for temporary data

**Data Transformation**:
```typescript
// Raw user input
const userContent = "# Title\nSome **markdown** content";

// Transformed for rendering
const processedContent = {
  type: "markdown",
  raw: userContent,
  parsed: parseMarkdown(userContent),
  html: renderMarkdownToHTML(userContent)
};
```

### 3. API Request

**Request Format**:
```typescript
POST /api/pdf/export
{
  "document": {
    "id": "doc-123",
    "version": "1.0",
    "content": { /* processed content */ },
    "layout": { /* layout configuration */ },
    "styles": { /* style settings */ }
  },
  "options": {
    "format": "letter",
    "quality": "high",
    "compression": true
  }
}
```

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
X-Request-ID: <unique-id>
```

### 4. Server Processing

**Data Pipeline**:
1. **Validation**
   ```typescript
   validateRequest(request) {
     - Check authentication
     - Validate schema
     - Verify permissions
     - Sanitize input
   }
   ```

2. **Preparation**
   ```typescript
   prepareRenderData(document) {
     - Generate unique render ID
     - Create browser context
     - Prepare HTML template
     - Inject data into template
   }
   ```

3. **Configuration**
   ```typescript
   configurePDFOptions(options) {
     return {
       format: options.format,
       width: calculateWidth(options.format),
       height: calculateHeight(options.format),
       margin: options.margins,
       printBackground: true,
       preferCSSPageSize: false
     };
   }
   ```

### 5. Browser Rendering

**Data Injection**:
```javascript
// Inject into browser context
await page.evaluateOnNewDocument((data) => {
  window.__DOCUMENT_DATA__ = data;
  localStorage.setItem('document', JSON.stringify(data));
}, documentData);
```

**Rendering Process**:
1. Load base HTML template
2. Inject document data
3. Apply styles
4. Render content
5. Calculate page breaks
6. Generate page layouts

### 6. PDF Generation

**Page-by-Page Generation**:
```typescript
for (const pageIndex of pageIndices) {
  // Set page visibility
  await page.evaluate((index) => {
    document.querySelectorAll('.page').forEach((el, i) => {
      el.style.display = i === index ? 'block' : 'none';
    });
  }, pageIndex);

  // Generate PDF for single page
  const pdfBuffer = await page.pdf({
    width: pageWidth,
    height: pageHeight,
    printBackground: true
  });

  pages.push(pdfBuffer);
}
```

**Multi-Page Merging**:
```typescript
const mergedPdf = await PDFDocument.create();

for (const pageBuffer of pages) {
  const page = await PDFDocument.load(pageBuffer);
  const [copiedPage] = await mergedPdf.copyPages(page, [0]);
  mergedPdf.addPage(copiedPage);
}

const finalPdf = await mergedPdf.save();
```

### 7. Storage & Response

**Storage Flow**:
```typescript
// Upload to storage
const storageResult = await storage.upload({
  buffer: finalPdf,
  key: `pdfs/${documentId}/${timestamp}.pdf`,
  contentType: 'application/pdf',
  metadata: {
    documentId,
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000) // 1 hour
  }
});

// Generate response
return {
  success: true,
  data: {
    url: storageResult.url,
    size: finalPdf.length,
    pages: pages.length,
    expires: storageResult.expiresAt
  }
};
```

## Data Transformation Examples

### Markdown to PDF

```typescript
// Input
const markdown = "# Header\n\nParagraph with **bold** text.";

// Step 1: Parse markdown
const ast = parseMarkdown(markdown);
// AST: { type: 'document', children: [...] }

// Step 2: Convert to HTML
const html = renderToHTML(ast);
// HTML: <h1>Header</h1><p>Paragraph with <strong>bold</strong> text.</p>

// Step 3: Apply styling
const styledHTML = applyStyles(html, styles);
// Adds CSS classes and inline styles

// Step 4: Position on page
const positionedHTML = positionContent(styledHTML, layout);
// Wraps in page containers with absolute positioning
```

### Layout Data Structure

```typescript
interface LayoutData {
  pages: Array<{
    id: string;
    columns: Array<{
      id: string;
      width: number; // percentage
      sections: Array<{
        id: string;
        type: string;
        content: any;
        visible: boolean;
      }>;
    }>;
  }>;
}

// Transform for rendering
function transformLayout(layout: LayoutData): RenderLayout {
  return {
    pages: layout.pages.map(page => ({
      ...page,
      style: {
        width: `${PAGE_WIDTH}px`,
        height: `${PAGE_HEIGHT}px`,
        position: 'relative'
      },
      columns: page.columns.map(column => ({
        ...column,
        style: {
          width: `${column.width}%`,
          float: 'left',
          height: '100%'
        }
      }))
    }))
  };
}
```

## Error Handling

### Data Validation Errors
```typescript
try {
  validateDocumentData(data);
} catch (error) {
  return {
    error: {
      code: 'INVALID_DATA',
      message: error.message,
      fields: error.fields
    }
  };
}
```

### Rendering Errors
```typescript
page.on('pageerror', error => {
  logger.error('Page error:', error);
  throw new RenderingError('Failed to render page', error);
});
```

### Recovery Strategies
1. Retry with backoff
2. Fallback to simpler rendering
3. Partial success reporting
4. Error page insertion

## Performance Considerations

### Data Size Limits
- Maximum document size: 10MB
- Maximum pages: 100
- Maximum custom CSS: 1MB

### Optimization Techniques
1. **Streaming**: Process pages as they're ready
2. **Compression**: Compress PDF output
3. **Caching**: Cache rendered templates
4. **Pooling**: Reuse browser instances

### Monitoring Points
- Request size
- Processing time per page
- Memory usage
- Storage upload time
- Total end-to-end time