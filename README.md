# PngCompress

A cross-platform desktop image compression tool built with Electron.

## Features

- 🖼️ **Multiple Format Support** - PNG, JPG, JPEG
- 🔄 **Two Compression Modes**
  - Lossless - Reduce file size without quality loss
  - Lossy - Adjustable quality for maximum compression
- 📁 **Batch Processing** - Compress multiple files or entire folders
- 🌏 **Bilingual** - Chinese and English interface
- 💻 **Cross-platform** - Windows and macOS

## Download

Download the latest version from the [Releases](https://github.com/youzi001/pngCompress/releases) page:

| Platform | File | Description |
|----------|------|-------------|
| macOS (Apple Silicon) | `PngCompress-x.x.x-arm64.dmg` | For M1/M2/M3 Mac |
| macOS (Intel) | `PngCompress-x.x.x.dmg` | For Intel Mac |
| Windows | `PngCompress Setup x.x.x.exe` | Windows installer |

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

## Release (自动发布流程)

项目使用 GitHub Actions 自动构建和发布多平台版本。

### 触发构建的方式

**方式1：使用 npm version（推荐）**

```bash
# 更新补丁版本 1.0.0 -> 1.0.1
npm version patch

# 更新次要版本 1.0.0 -> 1.1.0
npm version minor

# 更新主要版本 1.0.0 -> 2.0.0
npm version major

# 推送代码和 tag
git push origin master --tags
```

**方式2：手动创建 tag**

```bash
# 创建 tag
git tag -a v1.0.1 -m "Release v1.0.1"

# 推送 tag 触发构建
git push origin v1.0.1
```

### 构建流程

1. 推送 `v*` 格式的 tag 后，GitHub Actions 自动触发
2. 在 macOS runner 上构建 Intel 和 Apple Silicon 版本
3. 在 Windows runner 上构建 exe 安装包
4. 所有构建完成后自动创建 Release 并上传安装包

### 查看构建状态

- Actions 页面：https://github.com/youzi001/pngCompress/actions
- Releases 页面：https://github.com/youzi001/pngCompress/releases

### 首次设置（重要！）

在首次发布前，需要配置仓库权限：

1. 打开 https://github.com/youzi001/pngCompress/settings/actions
2. 滚动到 **Workflow permissions**
3. 选择 **Read and write permissions**
4. 勾选 **Allow GitHub Actions to create and approve pull requests**
5. 点击 **Save**

## Tech Stack

- Electron
- React
- TypeScript
- Sharp (image processing)
- Vite
- Tailwind CSS

## License

MIT
