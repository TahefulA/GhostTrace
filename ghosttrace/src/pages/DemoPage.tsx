import React, { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useScanStore } from '../store/scanStore';
import { ScanPage } from './ScanPage';
import type { ScanResult } from '../types';

export const DemoPage: React.FC = () => {
  const { currentScan, setCurrentScan } = useScanStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDemoSnapshot() {
      try {
        setLoading(true);
        const res = await fetch('/demo/scan.json');
        if (!res.ok) {
          throw new Error(`Failed to load demo snapshot (HTTP ${res.status})`);
        }
        const data: ScanResult = await res.json();
        setCurrentScan(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load offline demo snapshot.');
      } finally {
        setLoading(false);
      }
    }

    loadDemoSnapshot();
  }, [setCurrentScan]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400 font-mono text-sm">
          <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
          <span>Loading offline demo snapshot...</span>
        </div>
      </div>
    );
  }

  if (error || !currentScan) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-rose-400 mb-3" />
        <h2 className="text-lg font-bold text-neutral-100">Unable to load demo</h2>
        <p className="text-xs text-neutral-400 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Demo Notice Banner */}
      <div className="bg-cyan-950/80 border-b border-cyan-800/60 px-4 py-2 text-center text-xs text-cyan-200 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
          <span>
            <strong>Demo Snapshot:</strong> Snapshot of a real scan of{' '}
            <span className="font-mono font-semibold">{currentScan.repo.owner}/{currentScan.repo.repo}</span>
            , taken on {new Date(currentScan.timestamp).toLocaleDateString()}. Zero API calls, no key required, works offline.
          </span>
        </div>
      </div>

      <ScanPage />
    </div>
  );
};
