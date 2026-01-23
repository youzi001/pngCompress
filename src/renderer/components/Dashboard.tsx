import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { listen } from '@tauri-apps/api/event';

interface FileItem {
  id: string;
  name: string;
  path: string;
  originalSize: number;
  compressedSize: number;
  savedSize: number;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  progress: number;
  error?: string;
}

const i18n = {
  en: {
    title: 'Image Compressor',
    lossless: 'Lossless',
    lossy: 'Lossy',
    quality: 'Quality',
    add: '+ Add',
    dropTitle: 'Drop images or folders here',
    dropHint: 'PNG, JPG, JPEG supported',
    features: [
      'Lossless & Lossy compression',
      'Batch processing',
      'Folder support',
      'Local processing, no upload'
    ],
    file: 'File',
    original: 'Original',
    compressed: 'After',
    saved: 'Saved',
    status: 'Status',
    pending: 'Pending',
    processing: 'Working',
    done: 'Done',
    error: 'Error',
    skip: 'Skip',
    dropToAdd: '+ Drop to add',
    completed: 'completed',
    total: 'Total',
    savedLabel: 'Saved',
    clear: 'Clear',
    delete: 'Delete',
    errorTooltip: 'Compression failed',
    unsupportedFiles: 'Unsupported files skipped',
    onlySupport: 'Only PNG, JPG, JPEG are supported',
    duplicateTitle: 'Files already exist',
    duplicateMsg: 'files were ignored',
  },
  zh: {
    title: '图片压缩工具',
    lossless: '无损',
    lossy: '有损',
    quality: '质量',
    add: '+ 添加',
    dropTitle: '拖入图片或文件夹',
    dropHint: '支持 PNG, JPG, JPEG',
    features: [
      '无损 & 有损压缩',
      '批量处理',
      '支持文件夹',
      '本地处理，无需上传'
    ],
    file: '文件',
    original: '原始',
    compressed: '压缩后',
    saved: '节省',
    status: '状态',
    pending: '等待',
    processing: '处理中',
    done: '完成',
    error: '错误',
    skip: '跳过',
    dropToAdd: '+ 拖入添加',
    completed: '已完成',
    total: '总计',
    savedLabel: '节省',
    clear: '清空',
    delete: '删除',
    errorTooltip: '压缩失败',
    unsupportedFiles: '已跳过不支持的文件',
    onlySupport: '仅支持 PNG, JPG, JPEG 格式',
    duplicateTitle: '文件已存在',
    duplicateMsg: '个文件被忽略',
  }
};

type Lang = 'en' | 'zh';

// Toast 组件
const Toast: React.FC<{ message: string; subMessage?: string; visible: boolean; onClose: () => void }> = 
  ({ message, subMessage, visible, onClose }) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="toast"
        >
          <div className="toast-icon">⚠️</div>
          <div className="toast-content">
            <div className="toast-message">{message}</div>
            {subMessage && <div className="toast-sub">{subMessage}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 单个文件行组件
const FileRow: React.FC<{ 
  file: FileItem; 
  t: typeof i18n.en; 
  formatSize: (n: number) => string;
  onDelete: (id: string) => void;
}> = ({ file, t, formatSize, onDelete }) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const MIN_DURATION = 800;

  useEffect(() => {
    if (file.status === 'processing') {
      startTimeRef.current = Date.now();
      setDisplayProgress(0);
      
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(90, (elapsed / MIN_DURATION) * 90);
        setDisplayProgress(progress);
        if (progress < 90) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
      return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    } else if (['success', 'error', 'skipped'].includes(file.status)) {
      const elapsed = Date.now() - startTimeRef.current;
      const remainingTime = Math.max(0, MIN_DURATION - elapsed);
      const timer = setTimeout(() => setDisplayProgress(100), remainingTime);
      return () => clearTimeout(timer);
    }
  }, [file.status]);

  const getStatusContent = () => {
    const labels = { pending: t.pending, success: t.done, error: t.error, skipped: t.skip };
    
    // 错误状态：直接显示错误标签，带 tooltip
    if (file.status === 'error') {
      const errorMessage = file.error || t.errorTooltip;
      return (
        <span 
          className="badge error" 
          title={errorMessage}
          style={{ cursor: 'help' }}
        >
          {labels.error}
        </span>
      );
    }
    
    if (file.status === 'processing') {
      return (
        <div className="progress-cell">
          <div className="mini-progress-bar">
            <motion.div 
              className="mini-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="progress-text">{Math.round(displayProgress)}%</span>
        </div>
      );
    }
    
    if (file.status === 'pending') {
      return <span className="badge pending">{labels.pending}</span>;
    }
    
    // 完成动画中
    if (displayProgress > 0 && displayProgress < 100) {
      return (
        <div className="progress-cell">
          <div className="mini-progress-bar">
            <motion.div 
              className="mini-progress-fill completing"
              animate={{ width: '100%' }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <span className="progress-text">100%</span>
        </div>
      );
    }
    
    return <span className={`badge ${file.status}`}>{labels[file.status as keyof typeof labels]}</span>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="file-row"
    >
      <div className="file-info">
        <span className="file-name">{file.name}</span>
        <span className="file-path">{file.path}</span>
      </div>
      <span className="file-size">{formatSize(file.originalSize)}</span>
      <span className="file-size compressed">{formatSize(file.compressedSize)}</span>
      <span className={`file-saved ${file.savedSize > 0 ? 'positive' : ''}`}>
        {file.savedSize > 0 ? `-${formatSize(file.savedSize)}` : '—'}
      </span>
      <span className="file-status">{getStatusContent()}</span>
      <button 
        className="btn-delete" 
        onClick={() => onDelete(file.id)}
        title={t.delete}
      >
        ×
      </button>
    </motion.div>
  );
};

const Dashboard: React.FC = () => {
  const [lang, setLang] = useState<Lang>('zh');
  const t = i18n[lang];
  
  const [mode, setMode] = useState<'lossy' | 'lossless'>('lossless');
  const [quality, setQuality] = useState(75);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', subMessage: '' });

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const showToast = (message: string, subMessage?: string) => {
    setToast({ visible: true, message, subMessage: subMessage || '' });
  };

  const unlistenRef = useRef<(() => void) | null>(null);
  const unlistenDropRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    const setupFileDrop = async () => {
      const unlisten = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        if (event.payload.paths && event.payload.paths.length > 0) {
          addFilesToQueue(event.payload.paths);
        }
      });

      if (!isMounted) {
        unlisten(); // Clean up immediately if component unmounted while awaiting
      } else {
        unlistenFn = unlisten;
        unlistenDropRef.current = unlisten;
      }
    };
    setupFileDrop();
    
    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
      if (unlistenRef.current) unlistenRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure we always have access to latest files for deduplication logic
  const filesRef = useRef(files);
  // We only update ref from render if the render state is actually newer or same length
  // to avoid overwriting our speculative update in addFilesToQueue
  if (files.length >= filesRef.current.length) {
     filesRef.current = files;
  }

  const addFilesToQueue = async (inputPaths: string[]) => {
    // 1. Scan for all image paths (recursive)
    const allImagePaths = await api.scanPaths(inputPaths) as string[];

    // 2. Access current files from Ref
    const currentFiles = filesRef.current;
    const existingPaths = new Set(currentFiles.map(f => f.path));
    
    // 3. Filter strictly
    const newPaths = allImagePaths.filter(p => !existingPaths.has(p));
    
    // If we have concurrent calls, newPaths might be empty for the second call
    if (newPaths.length === 0) {
        // If all paths are duplicates, we should still notify the user
        const duplicateCount = allImagePaths.length;
        if (duplicateCount > 0 && inputPaths.length > 0) {
             showToast(t.duplicateTitle, `${duplicateCount} ${t.duplicateMsg}`);
        }
        return;
    }

    const duplicateCount = allImagePaths.length - newPaths.length;

    // 4. Side Effect: Toast
    if (duplicateCount > 0) {
       showToast(t.duplicateTitle, `${duplicateCount} ${t.duplicateMsg}`);
    }

    // 5. Create items
    const newFilesItems = newPaths.map((path, index) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: path.split(/[/\\]/).pop() || 'unknown',
      path,
      originalSize: 0,
      compressedSize: 0,
      savedSize: 0,
      status: 'pending' as const,
      progress: 0
    }));

    // 6. IMMEDIATE REF UPDATE to prevent race condition
    // This allows subsequent calls (within ms) to see these files as 'existing'
    filesRef.current = [...currentFiles, ...newFilesItems];

    // 7. Update State
    setFiles(prev => {
        // Final safety check inside setter to be absolutely sure
        const prevPaths = new Set(prev.map(f => f.path));
        const trulyNewItems = newFilesItems.filter(f => !prevPaths.has(f.path));
        if (trulyNewItems.length === 0) return prev;
        return [...prev, ...trulyNewItems];
    });
    
    // 8. Trigger Logic
    processNewFiles(newPaths, currentFiles.length);
  };

  // Refs to track latest state for async callbacks (fixing closure staleness)
  const modeRef = useRef(mode);
  const qualityRef = useRef(quality);
  modeRef.current = mode;
  qualityRef.current = quality;

  const processNewFiles = async (paths: string[], startIndex: number) => {
    setIsProcessing(true);
    
    if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
    }

    const unlisten = await api.onProgress((data) => {
      const result = data.result;
      const filePath = result.filePath;
      
      setFiles(prev => prev.map((f) => {
        if (f.path === filePath) {
          return {
            ...f,
            originalSize: result.originalSize || 0,
            compressedSize: result.compressedSize || 0,
            savedSize: result.savedBefore || 0,
            status: result.status === 'success' ? 'success' : 
                   result.status === 'skipped' ? 'skipped' : 'error',
            progress: 100,
            error: result.error,
          };
        }
        return f;
      }));

      if (data.done === data.total) setIsProcessing(false);
    });
    unlistenRef.current = unlisten;

    // 将所有待处理的新文件标记为 processing 状态
    setFiles(prev => prev.map((f) => 
       paths.includes(f.path) && f.status === 'pending'
        ? { ...f, status: 'processing' as const, progress: 0 } 
        : f
    ));

    try {
      // Use refs to get the LATEST mode/quality, not the ones captured in closure
      await api.compressFiles(paths, { mode: modeRef.current, quality: qualityRef.current });
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const paths = Array.from(droppedFiles)
        .map(f => api.getPathForFile(f))
        .filter((p): p is string => typeof p === 'string');
      if (paths.length) addFilesToQueue(paths);
    }
  }, [mode, quality, files, t]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = async () => {
    try {
      const paths = await api.selectFiles();
      if (paths?.length) addFilesToQueue(paths);
    } catch (e) { console.error(e); }
  };

  const handleClear = () => {
    setFiles([]);
    filesRef.current = []; // IMPORTANT: Sync Ref immediately
    setIsProcessing(false);
    if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
    }
  };

  const handleDeleteFile = (id: string) => {
    setFiles(prev => {
        const next = prev.filter(f => f.id !== id);
        filesRef.current = next; // IMPORTANT: Sync Ref immediately
        return next;
    });
  };

  const totalOriginal = files.reduce((sum, f) => sum + f.originalSize, 0);
  const totalSaved = files.reduce((sum, f) => sum + f.savedSize, 0);
  const doneCount = files.filter(f => ['success', 'error', 'skipped'].includes(f.status)).length;

  return (
    <div className="app" onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      <header className="header">
        <div className="toolbar">
          <div className="toolbar-section">
            <div className="mode-switcher">
              <button 
                className={`mode-btn ${mode === 'lossless' ? 'active' : ''}`}
                onClick={() => setMode('lossless')}
                disabled={isProcessing}
              >{t.lossless}</button>
              <button 
                className={`mode-btn ${mode === 'lossy' ? 'active' : ''}`}
                onClick={() => setMode('lossy')}
                disabled={isProcessing}
              >{t.lossy}</button>
            </div>
          </div>

          {mode === 'lossy' && (
            <>
              <div className="toolbar-divider"></div>
              <div className="toolbar-section">
                <span className="toolbar-label">{t.quality}:</span>
                <input
                  type="range" min="10" max="100" step="5"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="quality-slider"
                  disabled={isProcessing}
                />
                <span className="quality-value">{quality}%</span>
              </div>
            </>
          )}

          <div style={{ flex: 1 }}></div>

          <div className="lang-switcher">
            <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>中</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>

          <button className="btn btn-add" onClick={handleClick} disabled={isProcessing}>{t.add}</button>
        </div>
      </header>

      <main className={`main ${isDragging ? 'dragging' : ''}`}>
        {files.length === 0 ? (
          <div className="empty-state" onClick={handleClick}>
            <div className="empty-content">
              <div className="empty-icon">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </div>
              <div className="empty-title">{isDragging ? t.dropToAdd : t.dropTitle}</div>
              <div className="empty-hint">{t.dropHint}</div>
              
              <div className="features">
                {t.features.map((feat, i) => (
                  <div key={i} className="feature-item">
                    <span className="feature-check">✓</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="file-list-container">
            <div className="list-header">
              <span>{t.file}</span>
              <span>{t.original}</span>
              <span>{t.compressed}</span>
              <span>{t.saved}</span>
              <span>{t.status}</span>
              <span></span>
            </div>
            <div className="file-list">
              <AnimatePresence mode="popLayout">
                {files.map((file) => (
                  <FileRow key={file.id} file={file} t={t} formatSize={formatSize} onDelete={handleDeleteFile} />
                ))}
              </AnimatePresence>
            </div>
            {isDragging && (
              <div className="drop-overlay"><span>{t.dropToAdd}</span></div>
            )}
          </div>
        )}
      </main>

      <footer className="statusbar">
        <div className="statusbar-left">
          {files.length > 0 && (
            <>
              <span className="stat">{doneCount}/{files.length} {t.completed}</span>
              {totalOriginal > 0 && <span className="stat">{t.total}: {formatSize(totalOriginal)}</span>}
              {totalSaved > 0 && <span className="stat saved">{t.savedLabel}: {formatSize(totalSaved)}</span>}
            </>
          )}
        </div>
        {files.length > 0 && (
          <button className="btn btn-text" onClick={handleClear}>{t.clear}</button>
        )}
      </footer>

      {/* Toast 提示 */}
      <Toast 
        message={toast.message} 
        subMessage={toast.subMessage}
        visible={toast.visible} 
        onClose={() => setToast(prev => ({ ...prev, visible: false }))} 
      />
    </div>
  );
};

export default Dashboard;
