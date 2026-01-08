import fs from 'fs-extra';
import path from 'path';
import pLimit from 'p-limit';

export interface CompressionOptions {
  mode: 'lossy' | 'lossless';
  quality: number;
}

export interface CompressionResult {
  filePath: string;
  originalSize: number;
  compressedSize: number;
  savedBefore: number;
  status: 'success' | 'skipped' | 'error';
  error?: string;
}

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const limit = pLimit(3);

async function compressFile(
  filePath: string,
  options: CompressionOptions
): Promise<CompressionResult> {
  try {
    const stats = await fs.stat(filePath);
    const originalSize = stats.size;
    const ext = path.extname(filePath).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        filePath,
        originalSize,
        compressedSize: originalSize,
        savedBefore: 0,
        status: 'skipped',
        error: 'Unsupported format',
      };
    }

    const sharp = (await import('sharp')).default;
    const inputBuffer = await fs.readFile(filePath);
    let outputBuffer: Buffer;

    if (ext === '.png') {
      if (options.mode === 'lossy') {
        outputBuffer = await sharp(inputBuffer)
          .png({
            quality: options.quality,
            compressionLevel: 9,
            palette: true,
            effort: 10,
          })
          .toBuffer();
      } else {
        outputBuffer = await sharp(inputBuffer)
          .png({
            compressionLevel: 9,
            effort: 10,
          })
          .toBuffer();
      }
    } else {
      // JPEG
      if (options.mode === 'lossy') {
        outputBuffer = await sharp(inputBuffer)
          .jpeg({
            quality: options.quality,
            mozjpeg: true,
          })
          .toBuffer();
      } else {
        outputBuffer = await sharp(inputBuffer)
          .jpeg({
            quality: 100,
            mozjpeg: true,
          })
          .toBuffer();
      }
    }

    if (outputBuffer.length < originalSize) {
      await fs.writeFile(filePath, outputBuffer);
      return {
        filePath,
        originalSize,
        compressedSize: outputBuffer.length,
        savedBefore: originalSize - outputBuffer.length,
        status: 'success',
      };
    } else {
      return {
        filePath,
        originalSize,
        compressedSize: originalSize,
        savedBefore: 0,
        status: 'success',
      };
    }
  } catch (err: any) {
    console.error('Compression error for', filePath, err.message);
    return {
      filePath,
      originalSize: 0,
      compressedSize: 0,
      savedBefore: 0,
      status: 'error',
      error: err.message,
    };
  }
}

export async function processFiles(
  filePaths: string[],
  options: CompressionOptions,
  onProgress: (done: number, total: number, result: CompressionResult) => void
): Promise<void> {
  let allFiles: string[] = [];
  
  async function scanDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          allFiles.push(fullPath);
        }
      }
    }
  }

  for (const p of filePaths) {
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      await scanDir(p);
    } else {
      allFiles.push(p);
    }
  }

  const total = allFiles.length;
  let done = 0;

  const tasks = allFiles.map((file) =>
    limit(async () => {
      const result = await compressFile(file, options);
      done++;
      onProgress(done, total, result);
    })
  );

  await Promise.all(tasks);
}
