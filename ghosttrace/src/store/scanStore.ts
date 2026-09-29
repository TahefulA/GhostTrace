import { create } from 'zustand';
import type {
  ScanResult,
  ScanProgress,
  GitHubRateLimit,
  GraphNode,
  PackageHealthStatus,
} from '../types';

export type ActiveTab = 'overview' | 'graph' | 'packages' | 'plan';

interface ScanState {
  // Authentication / Rate Limits (In-memory only!)
  githubToken: string;
  setGithubToken: (token: string) => void;
  rateLimit: GitHubRateLimit | null;
  setRateLimit: (rateLimit: GitHubRateLimit) => void;

  // Active scan progress
  isScanning: boolean;
  progress: ScanProgress;
  abortController: AbortController | null;
  startScanProgress: (abortController: AbortController) => void;
  updateProgress: (progress: Partial<ScanProgress>) => void;
  cancelScan: () => void;
  finishScan: (result: ScanResult) => void;
  failScan: (error: string) => void;

  // Scan Results
  currentScan: ScanResult | null;
  setCurrentScan: (scan: ScanResult | null) => void;
  scanError: string | null;
  setScanError: (error: string | null) => void;
  clearScanError: () => void;

  // UI View Controls
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: PackageHealthStatus | 'all';
  setStatusFilter: (status: PackageHealthStatus | 'all') => void;
  directOnly: boolean;
  setDirectOnly: (directOnly: boolean) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  // In-memory token
  githubToken: '',
  setGithubToken: (token) => set({ githubToken: token }),

  rateLimit: null,
  setRateLimit: (rateLimit) => set({ rateLimit }),

  isScanning: false,
  progress: {
    step: 'idle',
    percent: 0,
    message: '',
  },
  abortController: null,

  startScanProgress: (abortController) =>
    set({
      isScanning: true,
      abortController,
      scanError: null,
      progress: {
        step: 'fetching_metadata',
        percent: 5,
        message: 'Connecting to GitHub...',
      },
    }),

  updateProgress: (progressUpdate) =>
    set((state) => ({
      progress: { ...state.progress, ...progressUpdate },
    })),

  cancelScan: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      isScanning: false,
      abortController: null,
      scanError: null,
      progress: {
        step: 'idle',
        percent: 0,
        message: 'Scan cancelled',
      },
    });
  },

  finishScan: (result) =>
    set({
      isScanning: false,
      abortController: null,
      currentScan: result,
      scanError: null,
      progress: {
        step: 'completed',
        percent: 100,
        message: 'Scan completed successfully',
      },
    }),

  failScan: (error) =>
    set({
      isScanning: false,
      abortController: null,
      scanError: error,
      progress: {
        step: 'error',
        percent: 0,
        message: error,
      },
    }),

  currentScan: null,
  setCurrentScan: (scan) => set({ currentScan: scan, scanError: null }),
  scanError: null,
  setScanError: (error) => set({ scanError: error }),
  clearScanError: () => set({ scanError: null }),

  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  statusFilter: 'all',
  setStatusFilter: (status) => set({ statusFilter: status }),

  directOnly: false,
  setDirectOnly: (directOnly) => set({ directOnly }),

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
}));
