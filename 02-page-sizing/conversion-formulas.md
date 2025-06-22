# Page Size Conversion Formulas

## Core Conversion Mathematics

### Fundamental Units and Relationships

```
1 inch = 25.4 millimeters (exactly)
1 inch = 72 points (PostScript/PDF standard)
1 inch = 96 pixels (CSS/screen standard at 96 DPI)

Screen DPI (Dots Per Inch) = 96 (standard web rendering)
Print DPI = 300 (standard print quality)
```

### Essential Formulas

#### Millimeters ↔ Pixels
```typescript
// At standard 96 DPI
pixels = millimeters × (96 / 25.4)
pixels = millimeters × 3.779528

millimeters = pixels × (25.4 / 96)
millimeters = pixels × 0.264583
```

#### Inches ↔ Pixels
```typescript
// At standard 96 DPI
pixels = inches × 96

inches = pixels / 96
```

#### Custom DPI Conversions
```typescript
// For any DPI value
pixels = millimeters × (DPI / 25.4)
pixels = inches × DPI

millimeters = pixels × (25.4 / DPI)
inches = pixels / DPI
```

## Implementation Reference

### TypeScript Conversion Library

```typescript
export class UnitConverter {
  private static readonly MM_PER_INCH = 25.4;
  private static readonly POINTS_PER_INCH = 72;
  private static readonly DEFAULT_DPI = 96;

  // Core conversion methods
  static mmToPx(mm: number, dpi: number = this.DEFAULT_DPI): number {
    return mm * (dpi / this.MM_PER_INCH);
  }

  static pxToMm(px: number, dpi: number = this.DEFAULT_DPI): number {
    return px * (this.MM_PER_INCH / dpi);
  }

  static inToPx(inches: number, dpi: number = this.DEFAULT_DPI): number {
    return inches * dpi;
  }

  static pxToIn(px: number, dpi: number = this.DEFAULT_DPI): number {
    return px / dpi;
  }

  static mmToIn(mm: number): number {
    return mm / this.MM_PER_INCH;
  }

  static inToMm(inches: number): number {
    return inches * this.MM_PER_INCH;
  }

  // Points conversions (for PDF libraries)
  static ptToPx(points: number, dpi: number = this.DEFAULT_DPI): number {
    return (points / this.POINTS_PER_INCH) * dpi;
  }

  static pxToPt(px: number, dpi: number = this.DEFAULT_DPI): number {
    return (px / dpi) * this.POINTS_PER_INCH;
  }

  static mmToPt(mm: number): number {
    return (mm / this.MM_PER_INCH) * this.POINTS_PER_INCH;
  }

  static ptToMm(points: number): number {
    return (points / this.POINTS_PER_INCH) * this.MM_PER_INCH;
  }
}
```

### Precision and Rounding

```typescript
export class PrecisionConverter extends UnitConverter {
  // Round to nearest pixel (important for rendering)
  static mmToPxRounded(mm: number, dpi: number = 96): number {
    return Math.round(this.mmToPx(mm, dpi));
  }

  // Round to specific decimal places
  static roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  // Ensure even pixel values (important for centering)
  static toEvenPixels(px: number): number {
    return Math.round(px / 2) * 2;
  }

  // Snap to grid (useful for layout systems)
  static snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
  }
}
```

## Practical Examples

### Converting Standard Page Sizes

```typescript
// Letter size: 8.5" × 11"
const letterWidth = UnitConverter.inToPx(8.5);   // 816px at 96 DPI
const letterHeight = UnitConverter.inToPx(11);   // 1056px at 96 DPI

// A4 size: 210mm × 297mm  
const a4Width = UnitConverter.mmToPx(210);       // 793.7px → 794px
const a4Height = UnitConverter.mmToPx(297);      // 1122.5px → 1123px

// For high-DPI printing (300 DPI)
const letterWidth300 = UnitConverter.inToPx(8.5, 300);   // 2550px
const letterHeight300 = UnitConverter.inToPx(11, 300);   // 3300px
```

### Margin Calculations

```typescript
function calculateContentArea(
  pageWidth: number,
  pageHeight: number,
  margins: { top: number; right: number; bottom: number; left: number },
  unit: 'mm' | 'in' | 'px' = 'mm'
): { width: number; height: number } {
  let marginsPx = { ...margins };
  
  // Convert margins to pixels if needed
  if (unit === 'mm') {
    marginsPx = {
      top: UnitConverter.mmToPx(margins.top),
      right: UnitConverter.mmToPx(margins.right),
      bottom: UnitConverter.mmToPx(margins.bottom),
      left: UnitConverter.mmToPx(margins.left)
    };
  } else if (unit === 'in') {
    marginsPx = {
      top: UnitConverter.inToPx(margins.top),
      right: UnitConverter.inToPx(margins.right),
      bottom: UnitConverter.inToPx(margins.bottom),
      left: UnitConverter.inToPx(margins.left)
    };
  }

  return {
    width: pageWidth - marginsPx.left - marginsPx.right,
    height: pageHeight - marginsPx.top - marginsPx.bottom
  };
}

// Example: Letter with 0.5" margins
const contentArea = calculateContentArea(
  816, 1056, 
  { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  'in'
);
// Result: { width: 720px, height: 960px }
```

## CSS Integration

### Dynamic Style Generation

```typescript
function generatePageCSS(
  format: 'letter' | 'a4' | 'legal',
  margins?: { top: number; right: number; bottom: number; left: number }
): string {
  const sizes = {
    letter: { width: 8.5, height: 11, unit: 'in' },
    a4: { width: 210, height: 297, unit: 'mm' },
    legal: { width: 8.5, height: 14, unit: 'in' }
  };

  const size = sizes[format];
  const marginStr = margins 
    ? `${margins.top}${size.unit} ${margins.right}${size.unit} ${margins.bottom}${size.unit} ${margins.left}${size.unit}`
    : '0';

  return `
    @page {
      size: ${size.width}${size.unit} ${size.height}${size.unit};
      margin: ${marginStr};
    }

    .page {
      width: ${size.width}${size.unit};
      height: ${size.height}${size.unit};
      margin: 0;
      position: relative;
      overflow: hidden;
    }

    @media screen {
      .page {
        width: ${UnitConverter.inToPx(size.width)}px;
        height: ${UnitConverter.inToPx(size.height)}px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        margin: 20px auto;
      }
    }
  `;
}
```

## Viewport and Scale Calculations

### Fitting Content to Page

```typescript
interface ContentDimensions {
  width: number;
  height: number;
}

function calculateScaleToFit(
  content: ContentDimensions,
  container: ContentDimensions,
  padding: number = 0
): number {
  const availableWidth = container.width - (padding * 2);
  const availableHeight = container.height - (padding * 2);
  
  const scaleX = availableWidth / content.width;
  const scaleY = availableHeight / content.height;
  
  // Use minimum scale to ensure content fits both dimensions
  return Math.min(scaleX, scaleY);
}

// Example: Fit A3 content onto Letter page
const a3 = { width: UnitConverter.mmToPx(297), height: UnitConverter.mmToPx(420) };
const letter = { width: 816, height: 1056 };
const scale = calculateScaleToFit(a3, letter, 48);
// Scale ≈ 0.687
```

### DPI-Aware Rendering

```typescript
class DPIAwareRenderer {
  static getDeviceDPI(): number {
    // Check device pixel ratio
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Base DPI × device pixel ratio
    return 96 * devicePixelRatio;
  }

  static adjustForHighDPI(
    basePx: number,
    targetQuality: 'screen' | 'print' = 'screen'
  ): number {
    const deviceDPI = this.getDeviceDPI();
    
    if (targetQuality === 'print') {
      // Scale up for print quality
      return basePx * (300 / 96);
    }
    
    // Scale for device DPI
    return basePx * (deviceDPI / 96);
  }

  static generateHighDPIStyles(
    width: number,
    height: number,
    unit: 'mm' | 'in'
  ): string {
    const basePxWidth = unit === 'mm' 
      ? UnitConverter.mmToPx(width)
      : UnitConverter.inToPx(width);
      
    const basePxHeight = unit === 'mm'
      ? UnitConverter.mmToPx(height)
      : UnitConverter.inToPx(height);

    return `
      .page {
        width: ${basePxWidth}px;
        height: ${basePxHeight}px;
      }

      @media (-webkit-min-device-pixel-ratio: 2),
             (min-resolution: 192dpi) {
        .page {
          transform: scale(0.5);
          transform-origin: top left;
          width: ${basePxWidth * 2}px;
          height: ${basePxHeight * 2}px;
        }
      }
    `;
  }
}
```

## Validation and Error Handling

```typescript
export class DimensionValidator {
  static readonly MIN_PAGE_SIZE = 72;    // 1 inch minimum
  static readonly MAX_PAGE_SIZE = 7200;  // 100 inches maximum

  static validateDimension(
    value: number,
    unit: 'mm' | 'in' | 'px',
    dpi: number = 96
  ): { valid: boolean; pixels: number; error?: string } {
    let pixels: number;

    switch (unit) {
      case 'mm':
        pixels = UnitConverter.mmToPx(value, dpi);
        break;
      case 'in':
        pixels = UnitConverter.inToPx(value, dpi);
        break;
      case 'px':
        pixels = value;
        break;
    }

    if (pixels < this.MIN_PAGE_SIZE) {
      return {
        valid: false,
        pixels,
        error: `Page dimension too small: ${pixels}px (minimum: ${this.MIN_PAGE_SIZE}px)`
      };
    }

    if (pixels > this.MAX_PAGE_SIZE) {
      return {
        valid: false,
        pixels,
        error: `Page dimension too large: ${pixels}px (maximum: ${this.MAX_PAGE_SIZE}px)`
      };
    }

    return { valid: true, pixels };
  }

  static validateAspectRatio(
    width: number,
    height: number,
    maxRatio: number = 3
  ): boolean {
    const ratio = Math.max(width, height) / Math.min(width, height);
    return ratio <= maxRatio;
  }
}
```

## Quick Reference Table

| From ↓ To → | Pixels (96 DPI) | Millimeters | Inches | Points |
|-------------|-----------------|-------------|---------|---------|
| **Pixels**  | 1              | × 0.264583  | ÷ 96    | × 0.75  |
| **Millimeters** | × 3.779528 | 1          | ÷ 25.4  | × 2.835 |
| **Inches**  | × 96           | × 25.4      | 1       | × 72    |
| **Points**  | × 1.333        | × 0.353     | ÷ 72    | 1       |