'use client';

import { useState, useEffect } from 'react';
import { Bug, Download, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { errorLogger, ErrorLog } from '@/lib/error-logging';
import { storageQuotaManager } from '@/lib/storage-quota';

interface ErrorDebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export function ErrorDebugPanel({ isVisible, onClose }: ErrorDebugPanelProps) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [storageInfo, setStorageInfo] = useState<any>(null);

  useEffect(() => {
    if (isVisible) {
      refreshLogs();
      refreshStorageInfo();
    }
  }, [isVisible]);

  const refreshLogs = () => {
    const allLogs = errorLogger.getLogs();
    setLogs(allLogs.reverse()); // Show newest first
  };

  const refreshStorageInfo = async () => {
    try {
      const status = await storageQuotaManager.getQuotaStatus();
      setStorageInfo(status);
    } catch (error) {
      console.error('Failed to get storage info:', error);
    }
  };

  const handleClearLogs = () => {
    if (confirm('Clear all error logs?')) {
      errorLogger.clearLogs();
      setLogs([]);
    }
  };

  const handleExportLogs = () => {
    const exportData = errorLogger.exportLogs();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    return true;
  });

  const categories = Array.from(new Set(logs.map(log => log.category)));

  const getLevelColor = (level: ErrorLog['level']) => {
    switch (level) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warn': return 'text-orange-600 dark:text-orange-400';
      case 'info': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getCategoryColor = (category: ErrorLog['category']) => {
    const colors = {
      api: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      storage: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      audio: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      network: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      ui: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    return colors[category] || colors.unknown;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Error Debug Panel</h2>
            <span className="text-sm text-muted-foreground">
              ({filteredLogs.length} of {logs.length} logs)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Storage Info */}
        {storageInfo && (
          <div className="p-4 border-b bg-muted/50">
            <h3 className="text-sm font-medium mb-2">Storage Status</h3>
            <div className="text-xs text-muted-foreground">
              <p>Used: {Math.round(storageInfo.quota.used / (1024 * 1024))}MB</p>
              <p>Available: {Math.round(storageInfo.quota.available / (1024 * 1024))}MB</p>
              <p>Percentage: {Math.round(storageInfo.quota.percentage)}%</p>
              {storageInfo.isNearLimit && (
                <p className="text-orange-600 dark:text-orange-400">⚠️ Storage nearly full</p>
              )}
              {storageInfo.isAtLimit && (
                <p className="text-red-600 dark:text-red-400">🚨 Storage full</p>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Level:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="all">All</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="all">All</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={refreshLogs}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            <Bug className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No logs found
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-3 bg-card">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleLogExpansion(log.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {expandedLogs.has(log.id) ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                    
                    <span className={`text-sm font-medium ${getLevelColor(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                    
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(log.category)}`}>
                      {log.category}
                    </span>
                    
                    <span className="text-sm truncate flex-1">
                      {log.message}
                    </span>
                    
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {expandedLogs.has(log.id) && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="text-xs text-muted-foreground">
                      <p><strong>ID:</strong> {log.id}</p>
                      <p><strong>Timestamp:</strong> {log.timestamp}</p>
                      <p><strong>URL:</strong> {log.url}</p>
                      <p><strong>User Agent:</strong> {log.userAgent}</p>
                    </div>
                    
                    {log.details && (
                      <div className="text-xs">
                        <strong>Details:</strong>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to use the debug panel
export function useErrorDebugPanel() {
  const [isVisible, setIsVisible] = useState(false);

  const show = () => setIsVisible(true);
  const hide = () => setIsVisible(false);
  const toggle = () => setIsVisible(!isVisible);

  return {
    isVisible,
    show,
    hide,
    toggle,
    DebugPanel: ({ children }: { children?: React.ReactNode }) => (
      <>
        {children}
        <ErrorDebugPanel isVisible={isVisible} onClose={hide} />
      </>
    ),
  };
}