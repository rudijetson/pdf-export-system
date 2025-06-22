# Content Layout Structure

## Overview

The content layout system provides a flexible, multi-dimensional structure for organizing content across pages. This document explains the hierarchical layout system and how content flows within fixed-size pages.

## Layout Hierarchy

```
Document
└── Pages[]
    └── Columns[]
        └── Sections[]
            └── Content
```

### Visual Representation

```
┌─────────────────── Page 1 ──────────────────┐
│ ┌──── Column 1 ────┐ ┌──── Column 2 ────┐ │
│ │ ┌─ Section A ──┐ │ │ ┌─ Section D ──┐ │ │
│ │ │   Content    │ │ │ │   Content    │ │ │
│ │ └──────────────┘ │ │ └──────────────┘ │ │
│ │ ┌─ Section B ──┐ │ │ ┌─ Section E ──┐ │ │
│ │ │   Content    │ │ │ │   Content    │ │ │
│ │ └──────────────┘ │ │ └──────────────┘ │ │
│ │ ┌─ Section C ──┐ │ │                  │ │
│ │ │   Content    │ │ │                  │ │
│ │ └──────────────┘ │ │                  │ │
│ └───────────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────┘
```

## Data Structure

### TypeScript Interface

```typescript
interface LayoutStructure {
  pages: Page[];
  settings: LayoutSettings;
}

interface Page {
  id: string;
  index: number;
  columns: Column[];
  style?: PageStyle;
}

interface Column {
  id: string;
  width: number;        // Percentage (0-100)
  minHeight?: number;   // Minimum height in pixels
  sections: Section[];
  style?: ColumnStyle;
}

interface Section {
  id: string;
  type: SectionType;
  content: SectionContent;
  visible: boolean;
  style?: SectionStyle;
  metadata?: SectionMetadata;
}

interface LayoutSettings {
  columnGap: number;    // Gap between columns in pixels
  sectionGap: number;   // Gap between sections in pixels
  pageMargins: Margins;
  breakpoints?: Breakpoint[];
}

type SectionType = 
  | 'text'
  | 'markdown'
  | 'image'
  | 'table'
  | 'list'
  | 'custom';

interface SectionContent {
  type: SectionType;
  data: any;          // Type depends on section type
  formatting?: ContentFormatting;
}
```

### Example Layout Data

```typescript
const exampleLayout: LayoutStructure = {
  pages: [
    {
      id: 'page-1',
      index: 0,
      columns: [
        {
          id: 'main-column',
          width: 70,  // 70% width
          sections: [
            {
              id: 'header',
              type: 'markdown',
              content: {
                type: 'markdown',
                data: '# Document Title\n\nIntroduction paragraph...'
              },
              visible: true
            },
            {
              id: 'body',
              type: 'text',
              content: {
                type: 'text',
                data: 'Main content goes here...'
              },
              visible: true
            }
          ]
        },
        {
          id: 'sidebar',
          width: 30,  // 30% width
          sections: [
            {
              id: 'info-box',
              type: 'custom',
              content: {
                type: 'custom',
                data: { /* custom data */ }
              },
              visible: true
            }
          ]
        }
      ]
    }
  ],
  settings: {
    columnGap: 24,
    sectionGap: 16,
    pageMargins: {
      top: 48,
      right: 48,
      bottom: 48,
      left: 48
    }
  }
};
```

## Layout Engine Implementation

### Core Layout Class

```typescript
export class LayoutEngine {
  private pageWidth: number;
  private pageHeight: number;
  private settings: LayoutSettings;

  constructor(
    pageWidth: number,
    pageHeight: number,
    settings: LayoutSettings
  ) {
    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;
    this.settings = settings;
  }

  // Calculate available content area
  getContentArea(): { width: number; height: number } {
    const { pageMargins } = this.settings;
    return {
      width: this.pageWidth - pageMargins.left - pageMargins.right,
      height: this.pageHeight - pageMargins.top - pageMargins.bottom
    };
  }

  // Calculate column dimensions
  calculateColumnDimensions(columns: Column[]): ColumnDimension[] {
    const contentArea = this.getContentArea();
    const totalGaps = (columns.length - 1) * this.settings.columnGap;
    const availableWidth = contentArea.width - totalGaps;

    let currentX = this.settings.pageMargins.left;
    
    return columns.map((column, index) => {
      const width = (column.width / 100) * availableWidth;
      const dimension: ColumnDimension = {
        x: currentX,
        y: this.settings.pageMargins.top,
        width: width,
        height: contentArea.height,
        column: column
      };
      
      currentX += width + (index < columns.length - 1 ? this.settings.columnGap : 0);
      
      return dimension;
    });
  }

  // Layout sections within a column
  layoutSections(
    sections: Section[],
    columnDimension: ColumnDimension
  ): SectionLayout[] {
    const layouts: SectionLayout[] = [];
    let currentY = columnDimension.y;

    for (const section of sections) {
      if (!section.visible) continue;

      const sectionHeight = this.calculateSectionHeight(section, columnDimension.width);
      
      layouts.push({
        section: section,
        x: columnDimension.x,
        y: currentY,
        width: columnDimension.width,
        height: sectionHeight
      });

      currentY += sectionHeight + this.settings.sectionGap;
    }

    return layouts;
  }

  // Calculate section height based on content
  private calculateSectionHeight(
    section: Section,
    availableWidth: number
  ): number {
    // This would be implemented based on content type
    // For now, return a placeholder
    switch (section.type) {
      case 'text':
        return this.calculateTextHeight(section.content.data, availableWidth);
      case 'image':
        return this.calculateImageHeight(section.content.data, availableWidth);
      default:
        return 100; // Default height
    }
  }

  private calculateTextHeight(text: string, width: number): number {
    // Simplified calculation - in practice, use actual font metrics
    const averageCharsPerLine = width / 8; // Assuming 8px per character
    const lines = Math.ceil(text.length / averageCharsPerLine);
    const lineHeight = 20; // 20px line height
    return lines * lineHeight;
  }

  private calculateImageHeight(imageData: any, width: number): number {
    // Maintain aspect ratio
    const aspectRatio = imageData.height / imageData.width;
    return width * aspectRatio;
  }
}
```

## Column Layouts

### Two-Column Layout (70/30)

```typescript
const twoColumnLayout = {
  columns: [
    {
      id: 'main',
      width: 70,
      sections: []
    },
    {
      id: 'sidebar',
      width: 30,
      sections: []
    }
  ]
};
```

### Three-Column Layout (Equal)

```typescript
const threeColumnLayout = {
  columns: [
    {
      id: 'left',
      width: 33.33,
      sections: []
    },
    {
      id: 'center',
      width: 33.33,
      sections: []
    },
    {
      id: 'right',
      width: 33.33,
      sections: []
    }
  ]
};
```

### Single Column Layout

```typescript
const singleColumnLayout = {
  columns: [
    {
      id: 'main',
      width: 100,
      sections: []
    }
  ]
};
```

## Section Management

### Adding Sections

```typescript
class SectionManager {
  static addSection(
    layout: LayoutStructure,
    pageIndex: number,
    columnId: string,
    section: Section,
    position?: number
  ): LayoutStructure {
    const newLayout = structuredClone(layout);
    const page = newLayout.pages[pageIndex];
    const column = page.columns.find(c => c.id === columnId);
    
    if (!column) {
      throw new Error(`Column ${columnId} not found`);
    }

    if (position !== undefined) {
      column.sections.splice(position, 0, section);
    } else {
      column.sections.push(section);
    }

    return newLayout;
  }

  static removeSection(
    layout: LayoutStructure,
    pageIndex: number,
    columnId: string,
    sectionId: string
  ): LayoutStructure {
    const newLayout = structuredClone(layout);
    const page = newLayout.pages[pageIndex];
    const column = page.columns.find(c => c.id === columnId);
    
    if (!column) {
      throw new Error(`Column ${columnId} not found`);
    }

    column.sections = column.sections.filter(s => s.id !== sectionId);
    
    return newLayout;
  }

  static moveSection(
    layout: LayoutStructure,
    from: { pageIndex: number; columnId: string; sectionId: string },
    to: { pageIndex: number; columnId: string; position: number }
  ): LayoutStructure {
    const newLayout = structuredClone(layout);
    
    // Find and remove section from source
    const sourcePage = newLayout.pages[from.pageIndex];
    const sourceColumn = sourcePage.columns.find(c => c.id === from.columnId);
    const sectionIndex = sourceColumn?.sections.findIndex(s => s.id === from.sectionId) ?? -1;
    
    if (sectionIndex === -1) {
      throw new Error('Section not found');
    }

    const [section] = sourceColumn!.sections.splice(sectionIndex, 1);
    
    // Add to destination
    const destPage = newLayout.pages[to.pageIndex];
    const destColumn = destPage.columns.find(c => c.id === to.columnId);
    
    if (!destColumn) {
      throw new Error('Destination column not found');
    }

    destColumn.sections.splice(to.position, 0, section);
    
    return newLayout;
  }
}
```

## Responsive Behavior

### Breakpoint System

```typescript
interface Breakpoint {
  maxWidth: number;
  layout: ColumnLayout;
}

const responsiveLayout: LayoutStructure = {
  pages: [{
    id: 'page-1',
    index: 0,
    columns: [
      { id: 'main', width: 70, sections: [] },
      { id: 'sidebar', width: 30, sections: [] }
    ]
  }],
  settings: {
    columnGap: 24,
    sectionGap: 16,
    pageMargins: { top: 48, right: 48, bottom: 48, left: 48 },
    breakpoints: [
      {
        maxWidth: 600,  // Mobile
        layout: {
          columns: [
            { id: 'main', width: 100, sections: [] }
          ]
        }
      }
    ]
  }
};
```

## Flow Control

### Page Break Management

```typescript
interface PageBreakRule {
  sectionId?: string;
  sectionType?: SectionType;
  breakBefore?: boolean;
  breakAfter?: boolean;
  breakInside?: 'auto' | 'avoid';
  orphans?: number;      // Minimum lines at bottom
  widows?: number;       // Minimum lines at top
}

class PageBreakManager {
  static applyPageBreaks(
    layout: LayoutStructure,
    rules: PageBreakRule[]
  ): LayoutStructure {
    // Implementation would handle page break logic
    const newLayout = structuredClone(layout);
    
    // Apply rules to sections
    for (const page of newLayout.pages) {
      for (const column of page.columns) {
        for (const section of column.sections) {
          const rule = rules.find(r => 
            r.sectionId === section.id || 
            r.sectionType === section.type
          );
          
          if (rule) {
            section.style = {
              ...section.style,
              pageBreakBefore: rule.breakBefore ? 'always' : 'auto',
              pageBreakAfter: rule.breakAfter ? 'always' : 'auto',
              pageBreakInside: rule.breakInside || 'auto'
            };
          }
        }
      }
    }
    
    return newLayout;
  }
}
```

## Rendering the Layout

### React Component Example

```typescript
import React from 'react';

interface LayoutRendererProps {
  layout: LayoutStructure;
  pageIndex: number;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({ 
  layout, 
  pageIndex 
}) => {
  const page = layout.pages[pageIndex];
  const engine = new LayoutEngine(816, 1056, layout.settings);
  const columnDimensions = engine.calculateColumnDimensions(page.columns);

  return (
    <div className="page" style={{
      width: '816px',
      height: '1056px',
      position: 'relative',
      margin: '0 auto',
      backgroundColor: 'white',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)'
    }}>
      {columnDimensions.map((colDim, colIndex) => {
        const column = page.columns[colIndex];
        const sectionLayouts = engine.layoutSections(column.sections, colDim);
        
        return (
          <div
            key={column.id}
            className="column"
            style={{
              position: 'absolute',
              left: `${colDim.x}px`,
              top: `${colDim.y}px`,
              width: `${colDim.width}px`,
              height: `${colDim.height}px`
            }}
          >
            {sectionLayouts.map(sectionLayout => (
              <div
                key={sectionLayout.section.id}
                className="section"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: `${sectionLayout.y - colDim.y}px`,
                  width: `${sectionLayout.width}px`,
                  height: `${sectionLayout.height}px`
                }}
              >
                <SectionRenderer section={sectionLayout.section} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
```

## Best Practices

### 1. Content Priority
- Place most important content in the first column
- Use visual hierarchy within sections
- Consider reading patterns (F-pattern, Z-pattern)

### 2. Flexibility
- Design layouts that work with variable content
- Use minimum/maximum heights where appropriate
- Plan for content overflow

### 3. Consistency
- Maintain consistent spacing throughout
- Use a grid system for alignment
- Keep section styles uniform

### 4. Performance
- Minimize deep nesting
- Use efficient rendering strategies
- Cache layout calculations