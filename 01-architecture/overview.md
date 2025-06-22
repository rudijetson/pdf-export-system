# PDF Export Architecture Overview

## System Architecture

The PDF export system uses a client-server architecture with server-side rendering for consistent, high-quality PDF generation.

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Client    │────▶│   Server    │────▶│   Browser    │
│  (React)    │     │  (Node.js)  │     │ (Puppeteer)  │
└─────────────┘     └─────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    ▼
       │                    │            ┌──────────────┐
       │                    │            │   Renderer   │
       │                    │            │    (HTML)    │
       │                    │            └──────────────┘
       │                    │                    │
       │                    ▼                    ▼
       │            ┌──────────────┐     ┌──────────────┐
       │            │   Storage    │     │     PDF      │
       └───────────▶│   Service    │◀────│  Generator   │
                    └──────────────┘     └──────────────┘
```

## Core Components

### 1. Client Application
- **Purpose**: User interface for configuring and triggering PDF exports
- **Technologies**: React, TypeScript
- **Responsibilities**:
  - Document layout configuration
  - Content editing
  - Export trigger
  - Download management

### 2. Server Application
- **Purpose**: Orchestrates PDF generation process
- **Technologies**: Node.js, Express/NestJS, TypeScript
- **Responsibilities**:
  - API endpoints for PDF generation
  - Browser instance management
  - PDF merging and optimization
  - File storage integration

### 3. Browser Engine
- **Purpose**: Renders HTML/CSS to PDF with exact dimensions
- **Technologies**: Puppeteer, Chrome/Chromium
- **Responsibilities**:
  - HTML rendering
  - CSS processing
  - PDF page generation
  - Viewport management

### 4. Storage Service
- **Purpose**: Stores generated PDFs for download
- **Technologies**: S3, Local filesystem, or cloud storage
- **Responsibilities**:
  - File upload/download
  - Temporary storage
  - URL generation

## Key Design Principles

### 1. Server-Side Rendering
All PDF generation happens on the server to ensure:
- Consistent output across all devices
- No client-side dependencies
- Better performance for complex documents
- Security (no client access to raw data)

### 2. Exact Dimensions
The system uses precise pixel calculations:
- Millimeter to pixel conversion (3.78px per mm)
- Fixed viewport sizes
- No responsive scaling during PDF generation

### 3. Modular Architecture
Each component has a single responsibility:
- Separation of concerns
- Easy to test and maintain
- Scalable design

### 4. Stateless Processing
Each PDF generation request is independent:
- No server-side state
- Horizontally scalable
- Fault tolerant

## Communication Flow

1. **Client Request**
   ```json
   {
     "documentId": "123",
     "format": "letter",
     "margins": { "top": 18, "right": 18, "bottom": 18, "left": 18 },
     "content": { /* document data */ }
   }
   ```

2. **Server Processing**
   - Validates request
   - Prepares browser context
   - Injects document data
   - Triggers rendering

3. **Browser Rendering**
   - Loads HTML template
   - Applies styles
   - Renders each page
   - Generates PDF bytes

4. **Response**
   ```json
   {
     "url": "https://storage.example.com/pdfs/123.pdf",
     "pages": 3,
     "size": 245632,
     "expires": "2024-01-01T00:00:00Z"
   }
   ```

## Scalability Considerations

### Horizontal Scaling
- Multiple server instances
- Browser pool management
- Load balancing

### Performance Optimization
- Browser instance reuse
- Concurrent page rendering
- Efficient memory usage

### Caching
- Template caching
- Font caching
- Generated PDF caching

## Security

### Input Validation
- Sanitize user content
- Validate dimensions
- Limit file sizes

### Isolation
- Separate browser contexts
- Sandboxed rendering
- No direct file system access

### Access Control
- Authenticated requests
- Temporary URLs
- Automatic cleanup