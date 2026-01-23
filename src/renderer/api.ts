import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

export const api = {
  compressFiles: (paths: string[], options: { mode: 'lossy' | 'lossless', quality: number }) =>
    invoke('compress_files', { paths, options }),

  onProgress: async (callback: (payload: { done: number, total: number, result: any }) => void): Promise<UnlistenFn> => {
    return await listen('compression-progress', (event) => {
      callback(event.payload as any);
    });
  },

  getPathForFile: (file: File) => {
    // In Tauri Webview, the File object often exposes the full path directly
    // @ts-ignore
    return file.path || file.name;
  },

  selectFiles: async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    if (Array.isArray(selected)) return selected;
    if (selected === null) return [];
    return [selected];
  },

  selectDirectory: async () => {
    const selected = await open({
      multiple: false,
      directory: true
    });
    if (selected === null) return [];
    if (Array.isArray(selected)) return selected;
    return [selected];
  },

  scanPaths: (paths: string[]) => invoke('scan_paths', { paths }),
};
