// src/components/backtesting/CacheControl.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Database, Download, Upload, RefreshCw, Trash2, ToggleLeft, ToggleRight, Info } from 'lucide-react';

interface CacheStats {
  totalRecords: number;
  uniqueTickers: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  delistedCount: number;
}

interface CacheControlProps {
  onCacheToggle?: (enabled: boolean) => void;
  className?: string;
}

const CacheControl: React.FC<CacheControlProps> = ({ onCacheToggle, className = '' }) => {
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load cache stats on mount
  useEffect(() => {
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    try {
      const response = await fetch('/api/backtesting?action=cache-stats');
      if (response.ok) {
        const data = await response.json();
        setCacheStats({
          totalRecords: data.totalRecords,
          uniqueTickers: data.uniqueTickers,
          dateRange: data.dateRange,
          delistedCount: data.delistedCount
        });
      }
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  };

  const toggleCache = () => {
    const newState = !cacheEnabled;
    setCacheEnabled(newState);
    onCacheToggle?.(newState);
    setMessage(newState ? 'Cache enabled' : 'Cache disabled (using live API)');
    setTimeout(() => setMessage(''), 3000);
  };

  const clearCache = async () => {
    if (!confirm('Are you sure you want to clear all cached data? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/backtesting', { method: 'DELETE' });
      if (response.ok) {
        setMessage('Cache cleared successfully');
        await loadCacheStats();
      } else {
        setMessage('Failed to clear cache');
      }
    } catch (error) {
      setMessage('Error clearing cache');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const exportCache = async (format: 'csv' | 'xlsx') => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cache/export?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cache_export_${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setMessage(`Cache exported to ${format.toUpperCase()}`);
      } else {
        setMessage('Failed to export cache');
      }
    } catch (error) {
      setMessage('Error exporting cache');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    try {
      const response = await fetch('/api/cache/import', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setMessage(`Imported ${result.imported} records`);
        await loadCacheStats();
      } else {
        setMessage('Failed to import cache data');
      }
    } catch (error) {
      setMessage('Error importing cache data');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
      // Reset file input
      event.target.value = '';
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Cache Control</h3>
        </div>
        <button
          onClick={toggleCache}
          className="flex items-center gap-2"
          title={cacheEnabled ? 'Click to disable cache' : 'Click to enable cache'}
        >
          {cacheEnabled ? (
            <ToggleRight className="h-8 w-8 text-blue-600" />
          ) : (
            <ToggleLeft className="h-8 w-8 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-700">
            {cacheEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </button>
      </div>

      {/* Cache Stats */}
      {cacheStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-sm text-gray-600">Records</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(cacheStats.totalRecords)}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-sm text-gray-600">Tickers</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(cacheStats.uniqueTickers)}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-sm text-gray-600">Date Range</div>
            <div className="text-sm font-medium text-gray-900">
              {cacheStats.dateRange.earliest || 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-sm text-gray-600">Delisted</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(cacheStats.delistedCount)}
            </div>
          </div>
        </div>
      )}

      {/* Basic Controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => loadCacheStats()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Stats
        </button>
        
        <button
          onClick={clearCache}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Clear Cache
        </button>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
        >
          <Info className="h-4 w-4" />
          {showAdvanced ? 'Hide' : 'Show'} Import/Export
        </button>
      </div>

      {/* Advanced Controls */}
      {showAdvanced && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium text-gray-900 mb-3">Import/Export Cache Data</h4>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportCache('csv')}
              disabled={loading || cacheStats?.totalRecords === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            
            <button
              onClick={() => exportCache('xlsx')}
              disabled={loading || cacheStats?.totalRecords === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export XLSX
            </button>

            <label className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 cursor-pointer">
              <Upload className="h-4 w-4" />
              Import Data
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            <p>• Export downloads all cached data to CSV or XLSX format</p>
            <p>• Import allows you to restore cache from a previous export</p>
            <p>• Cache data persists between application runs</p>
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`mt-4 p-3 rounded-md text-sm ${
          message.includes('Failed') || message.includes('Error')
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      {/* Cache Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Cache Performance Tips:</p>
            <ul className="space-y-1 text-blue-800">
              <li>• {cacheEnabled ? 'Cache is active - API calls will be minimized' : 'Cache is disabled - all data will be fetched from API'}</li>
              <li>• First backtest may be slower as cache populates</li>
              <li>• Subsequent runs will be much faster ({'>'}90% cache hit rate)</li>
              <li>• Cache data persists between application restarts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheControl;