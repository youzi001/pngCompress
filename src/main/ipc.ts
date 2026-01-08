import { ipcMain, BrowserWindow } from 'electron';
import { processFiles, CompressionOptions, CompressionResult } from './compressor';

export function setupIPC(mainWindow: BrowserWindow) {
  ipcMain.handle(
    'compress-files',
    async (
      event,
      filePaths: string[],
      options: CompressionOptions
    ) => {
      console.log('Received compress-files:', filePaths, options);

      // Validate paths
      const validPaths = filePaths.filter(p => typeof p === 'string' && p.trim().length > 0);
      if (validPaths.length === 0) {
        console.warn('No valid file paths received in IPC');
        return { success: false, error: 'No valid file paths provided' };
      }
      
      try {
        await processFiles(validPaths, options, (done, total, result) => {
          if (!mainWindow.isDestroyed()) {
             mainWindow.webContents.send('compression-progress', {
                done,
                total,
                result
             });
          }
        });

        return { success: true };
      } catch (error: any) {
        console.error('Compression failed:', error);
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle('open-file-dialog', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'openDirectory', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    return result.filePaths;
  });

  // 扫描路径，展开文件夹，返回所有图片文件
  ipcMain.handle('scan-paths', async (_event, inputPaths: string[]) => {
    const fs = await import('fs-extra');
    const path = await import('path');
    const mime = await import('mime-types');
    
    const imageExtensions = ['.jpg', '.jpeg', '.png'];
    const results: string[] = [];

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (imageExtensions.includes(ext)) {
              results.push(fullPath);
            }
          }
        }
      } catch (e) {
        console.error('Error scanning directory:', dir, e);
      }
    }

    for (const p of inputPaths) {
      try {
        const stat = await fs.stat(p);
        if (stat.isDirectory()) {
          await scanDir(p);
        } else {
          const ext = path.extname(p).toLowerCase();
          if (imageExtensions.includes(ext)) {
            results.push(p);
          }
        }
      } catch (e) {
        console.error('Error accessing path:', p, e);
      }
    }

    return results;
  });
}
