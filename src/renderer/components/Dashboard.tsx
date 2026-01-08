import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    unsupportedFiles: 'Unsupported files skipped',
    onlySupport: 'Only PNG, JPG, JPEG are supported',
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
    unsupportedFiles: '已跳过不支持的文件',
    onlySupport: '仅支持 PNG, JPG, JPEG 格式',
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
const FileRow: React.FC<{ file: FileItem; t: typeof i18n.en; formatSize: (n: number) => string }> = ({ file, t, formatSize }) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const animationRef = useRef<number>();
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

  const addFilesToQueue = async (inputPaths: string[]) => {
    const allImagePaths = await window.electronAPI.scanPaths(inputPaths);
    
    // 检查是否有不支持的文件被跳过
    const skippedCount = inputPaths.length - allImagePaths.length;
    if (skippedCount > 0 && inputPaths.length > 0) {
      // 如果输入的不是目录且被跳过了，说明是不支持的格式
      showToast(t.unsupportedFiles, t.onlySupport);
    }
    
    const existingPaths = new Set(files.map((f: FileItem) => f.path));
    const newPaths = allImagePaths.filter((p: string) => !existingPaths.has(p));
    if (newPaths.length === 0) return;

    const newFiles: FileItem[] = newPaths.map((p: string, i: number) => ({
      id: `${Date.now()}-${i}`,
      name: p.split('/').pop() || p,
      path: p,
      originalSize: 0,
      compressedSize: 0,
      savedSize: 0,
      status: 'pending' as const,
      progress: 0,
    }));
    
    const startIndex = files.length;
    setFiles(prev => [...prev, ...newFiles]);
    await processFiles(newPaths, startIndex);
  };

  const processFiles = async (paths: string[], startIndex: number) => {
    setIsProcessing(true);
    let processedCount = 0;
    
    window.electronAPI.removeProgressListeners();
    window.electronAPI.onProgress((_event: any, data: any) => {
      const result = data.result;
      const currentIndex = startIndex + processedCount;
      
      setFiles(prev => prev.map((f, idx) => {
        if (idx === currentIndex) {
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
        if (idx === currentIndex + 1 && data.done < data.total) {
          return { ...f, status: 'processing' as const, progress: 0 };
        }
        return f;
      }));

      processedCount++;
      if (data.done === data.total) setIsProcessing(false);
    });

    setFiles(prev => prev.map((f, i) => i === startIndex ? { ...f, status: 'processing' as const, progress: 0 } : f));

    try {
      await window.electronAPI.compressFiles(paths, { mode, quality });
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
        .map(f => {
          try { return window.electronAPI.getPathForFile(f); }
          catch { return (f as any).path; }
        })
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
      const paths = await window.electronAPI.selectFiles();
      if (paths?.length) addFilesToQueue(paths);
    } catch (e) { console.error(e); }
  };

  const handleClear = () => {
    setFiles([]);
    window.electronAPI.removeProgressListeners();
  };

  const totalOriginal = files.reduce((sum, f) => sum + f.originalSize, 0);
  const totalSaved = files.reduce((sum, f) => sum + f.savedSize, 0);
  const doneCount = files.filter(f => ['success', 'error', 'skipped'].includes(f.status)).length;

  return (
    <div className="app" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <header className="header">
        <div className="titlebar">
          <span className="titlebar-title">{t.title}</span>
        </div>
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
            </div>
            <div className="file-list">
              <AnimatePresence>
                {files.map((file) => (
                  <FileRow key={file.id} file={file} t={t} formatSize={formatSize} />
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
        {files.length > 0 && !isProcessing && (
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
