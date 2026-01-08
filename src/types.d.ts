declare module 'imagemin';
declare module 'imagemin-mozjpeg';
declare module 'imagemin-pngquant';
declare module 'imagemin-optipng';
declare module 'imagemin-jpegtran';
declare module 'mime-types';

interface IElectronAPI {
  compressFiles: (paths: string[], options: { mode: 'lossy' | 'lossless', quality: number }) => Promise<any>;
  onProgress: (callback: (event: any, data: { done: number, total: number, result: any }) => void) => void;
  removeProgressListeners: () => void;
  getPathForFile: (file: File) => string;
  selectFiles: () => Promise<string[]>;
}

interface Window {
  electronAPI: IElectronAPI;
}
