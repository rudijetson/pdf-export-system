# Standard Page Dimensions

## Overview

This document details standard page dimensions used in PDF generation and how to implement precise page sizing for print documents.

## Common Page Sizes

### North American Sizes

#### Letter (8.5" × 11")
```typescript
const LETTER = {
  name: 'letter',
  width: {
    inches: 8.5,
    mm: 216,
    px: 816  // at 96 DPI
  },
  height: {
    inches: 11,
    mm: 279,
    px: 1056  // at 96 DPI
  }
};
```

#### Legal (8.5" × 14")
```typescript
const LEGAL = {
  name: 'legal',
  width: {
    inches: 8.5,
    mm: 216,
    px: 816
  },
  height: {
    inches: 14,
    mm: 356,
    px: 1344
  }
};
```

#### Tabloid/Ledger (11" × 17")
```typescript
const TABLOID = {
  name: 'tabloid',
  width: {
    inches: 11,
    mm: 279,
    px: 1056
  },
  height: {
    inches: 17,
    mm: 432,
    px: 1632
  }
};
```

### ISO 216 (International) Sizes

#### A4 (210mm × 297mm)
```typescript
const A4 = {
  name: 'a4',
  width: {
    inches: 8.27,
    mm: 210,
    px: 794  // at 96 DPI
  },
  height: {
    inches: 11.69,
    mm: 297,
    px: 1123  // at 96 DPI
  }
};
```

#### A3 (297mm × 420mm)
```typescript
const A3 = {
  name: 'a3',
  width: {
    inches: 11.69,
    mm: 297,
    px: 1123
  },
  height: {
    inches: 16.54,
    mm: 420,
    px: 1587
  }
};
```

#### A5 (148mm × 210mm)
```typescript
const A5 = {
  name: 'a5',
  width: {
    inches: 5.83,
    mm: 148,
    px: 559
  },
  height: {
    inches: 8.27,
    mm: 210,
    px: 794
  }
};
```

## Conversion Constants

### Key Conversion Factors

```typescript
// Puppeteer/Chrome uses 96 DPI for screen rendering
const DPI = 96;

// Conversion factors
const INCHES_TO_MM = 25.4;
const MM_TO_INCHES = 1 / 25.4;
const MM_TO_PX = 3.779528;  // at 96 DPI (96 / 25.4)
const PX_TO_MM = 1 / 3.779528;
const INCHES_TO_PX = 96;    // at 96 DPI
const PX_TO_INCHES = 1 / 96;

// Points (used in some PDF libraries)
const POINTS_TO_INCHES = 1 / 72;
const INCHES_TO_POINTS = 72;
const POINTS_TO_MM = 0.352778;
const MM_TO_POINTS = 2.834646;
```

### Conversion Functions

```typescript
// Universal conversion utility
class PageDimensions {
  static mmToPx(mm: number, dpi: number = 96): number {
    return Math.round(mm * (dpi / 25.4));
  }

  static pxToMm(px: number, dpi: number = 96): number {
    return px * (25.4 / dpi);
  }

  static inchesToPx(inches: number, dpi: number = 96): number {
    return Math.round(inches * dpi);
  }

  static pxToInches(px: number, dpi: number = 96): number {
    return px / dpi;
  }

  // Get exact pixel dimensions for a page size
  static getPixelDimensions(
    format: string, 
    dpi: number = 96
  ): { width: number; height: number } {
    const sizes = {
      letter: { width: 216, height: 279 },    // mm
      legal: { width: 216, height: 356 },     // mm
      tabloid: { width: 279, height: 432 },   // mm
      a4: { width: 210, height: 297 },        // mm
      a3: { width: 297, height: 420 },        // mm
      a5: { width: 148, height: 210 }         // mm
    };

    const size = sizes[format.toLowerCase()];
    if (!size) {
      throw new Error(`Unknown page format: ${format}`);
    }

    return {
      width: this.mmToPx(size.width, dpi),
      height: this.mmToPx(size.height, dpi)
    };
  }
}
```

## Implementation in Puppeteer

### Setting Page Size

```typescript
async function generatePDF(page: Page, format: string) {
  // Get exact dimensions
  const dimensions = PageDimensions.getPixelDimensions(format);
  
  // Set viewport to exact page size
  await page.setViewport({
    width: dimensions.width,
    height: dimensions.height,
    deviceScaleFactor: 1
  });

  // Generate PDF with exact dimensions
  const pdf = await page.pdf({
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  return pdf;
}
```

### CSS for Page Sizing

```css
/* Define page size in CSS */
@page {
  size: 8.5in 11in;  /* Letter size */
  margin: 0;
}

/* Alternative for A4 */
@page {
  size: 210mm 297mm;  /* A4 size */
  margin: 0;
}

/* Page container styling */
.page {
  width: 816px;   /* 8.5 inches at 96 DPI */
  height: 1056px; /* 11 inches at 96 DPI */
  position: relative;
  overflow: hidden;
  page-break-after: always;
  page-break-inside: avoid;
}

/* For print media */
@media print {
  .page {
    width: 8.5in;
    height: 11in;
    margin: 0;
    box-shadow: none;
  }
}
```

## Handling Custom Sizes

### Custom Size Definition

```typescript
interface CustomPageSize {
  width: number;
  height: number;
  unit: 'mm' | 'in' | 'px';
}

function createCustomSize(
  width: number,
  height: number,
  unit: 'mm' | 'in' | 'px'
): { width: number; height: number } {
  let widthPx: number;
  let heightPx: number;

  switch (unit) {
    case 'mm':
      widthPx = PageDimensions.mmToPx(width);
      heightPx = PageDimensions.mmToPx(height);
      break;
    case 'in':
      widthPx = PageDimensions.inchesToPx(width);
      heightPx = PageDimensions.inchesToPx(height);
      break;
    case 'px':
      widthPx = width;
      heightPx = height;
      break;
  }

  return { width: widthPx, height: heightPx };
}

// Example: 16" × 19" custom size
const customSize = createCustomSize(16, 19, 'in');
// Result: { width: 1536, height: 1824 } pixels
```

## Margin Handling

### Safe Print Margins

```typescript
interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit: 'mm' | 'in' | 'px';
}

const DEFAULT_MARGINS = {
  letter: {
    top: 12.7,    // 0.5 inches
    right: 12.7,
    bottom: 12.7,
    left: 12.7,
    unit: 'mm'
  },
  a4: {
    top: 15,      // ~0.59 inches
    right: 15,
    bottom: 15,
    left: 15,
    unit: 'mm'
  }
};

function applyMargins(
  pageSize: { width: number; height: number },
  margins: PageMargins
): { width: number; height: number } {
  const marginsPx = convertMarginsToPx(margins);
  
  return {
    width: pageSize.width - marginsPx.left - marginsPx.right,
    height: pageSize.height - marginsPx.top - marginsPx.bottom
  };
}
```

## Responsive Scaling

### Scaling Content to Fit

```typescript
function scaleContentToFit(
  contentSize: { width: number; height: number },
  pageSize: { width: number; height: number },
  margins: { top: number; right: number; bottom: number; left: number }
): number {
  const availableWidth = pageSize.width - margins.left - margins.right;
  const availableHeight = pageSize.height - margins.top - margins.bottom;
  
  const widthScale = availableWidth / contentSize.width;
  const heightScale = availableHeight / contentSize.height;
  
  // Use the smaller scale to ensure content fits
  return Math.min(widthScale, heightScale, 1); // Never scale up
}
```

## Best Practices

### 1. Always Use Exact Dimensions
```typescript
// Good
const pdf = await page.pdf({
  width: '816px',
  height: '1056px'
});

// Bad - relies on format string
const pdf = await page.pdf({
  format: 'Letter'  // May vary between implementations
});
```

### 2. Account for Printer Margins
Most printers cannot print to the edge of the paper. Leave at least:
- 0.25" (6.35mm) for laser printers
- 0.5" (12.7mm) for inkjet printers

### 3. Test Physical Output
Always test with actual printing to verify:
- Correct dimensions
- Proper margins
- No content cutoff

### 4. Handle DPI Variations
While screen rendering is typically 96 DPI, be prepared for:
- High-DPI displays (192 DPI, 288 DPI)
- Print resolution (300 DPI, 600 DPI)

```typescript
function calculatePrintDimensions(
  format: string,
  targetDPI: number = 300
): { width: number; height: number } {
  const screenDims = PageDimensions.getPixelDimensions(format, 96);
  const scale = targetDPI / 96;
  
  return {
    width: Math.round(screenDims.width * scale),
    height: Math.round(screenDims.height * scale)
  };
}
```