# PngCompress

A cross-platform desktop image compression tool built with Electron.

![Screenshot](screenshot.png)

## Features

- 🖼️ **Multiple Format Support** - PNG, JPG, JPEG
- 🔄 **Two Compression Modes**
  - Lossless - Reduce file size without quality loss
  - Lossy - Adjustable quality for maximum compression
- 📁 **Batch Processing** - Compress multiple files or entire folders
- 🌏 **Bilingual** - Chinese and English interface
- 💻 **Cross-platform** - Windows and macOS

## Download

Download the latest version from the [Releases](https://github.com/lijiaxu/pngCompress/releases) page:

- **macOS (Apple Silicon)**: `PngCompress-x.x.x-arm64.dmg`
- **macOS (Intel)**: `PngCompress-x.x.x.dmg`
- **Windows**: `PngCompress Setup x.x.x.exe`

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Build

```bash
# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build for all platforms
npm run build
```

## Tech Stack

- Electron
- React
- TypeScript
- Sharp (image processing)
- Vite
- Tailwind CSS

## License

MIT
