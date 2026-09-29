import { get, set, del, entries } from 'idb-keyval';
import type { ScanResult } from '../types';

const SCANS_PREFIX = 'ghosttrace_scan_';
const MAX_HISTORY_ITEMS = 10;

/**
 * Saves a scan to IndexedDB history
 */
export async function saveScanToHistory(scan: ScanResult): Promise<void> {
  try {
    const key = `${SCANS_PREFIX}${scan.id}`;
    await set(key, scan);
  } catch (err) {
    console.warn('Failed to persist scan to IndexedDB:', err);
  }
}

/**
 * Retrieves the most recent scans sorted by timestamp descending
 */
export async function getRecentScans(): Promise<ScanResult[]> {
  try {
    const allEntries = await entries();
    const scans: ScanResult[] = [];

    for (const [key, val] of allEntries) {
      if (typeof key === 'string' && key.startsWith(SCANS_PREFIX)) {
        if (val && typeof val === 'object' && 'id' in val) {
          scans.push(val as ScanResult);
        }
      }
    }

    // Sort descending by timestamp
    scans.sort((a, b) => b.timestamp - a.timestamp);
    return scans.slice(0, MAX_HISTORY_ITEMS);
  } catch (err) {
    console.warn('Failed to read scans from IndexedDB:', err);
    return [];
  }
}

/**
 * Fetches a scan by its ID from IndexedDB
 */
export async function getScanById(id: string): Promise<ScanResult | null> {
  try {
    const key = `${SCANS_PREFIX}${id}`;
    const scan = await get<ScanResult>(key);
    return scan || null;
  } catch (err) {
    console.warn('Failed to fetch scan by ID:', err);
    return null;
  }
}

/**
 * Deletes a scan from IndexedDB
 */
export async function deleteScanFromHistory(id: string): Promise<void> {
  try {
    const key = `${SCANS_PREFIX}${id}`;
    await del(key);
  } catch (err) {
    console.warn('Failed to delete scan:', err);
  }
}

/**
 * Exports a scan object as formatted JSON file
 */
export function exportScanAsJson(scan: ScanResult): void {
  const jsonStr = JSON.stringify(scan, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ghosttrace-${scan.repo.owner}-${scan.repo.repo}-${scan.id.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and imports a scan from JSON string
 */
export function importScanFromJson(jsonStr: string): ScanResult {
  const data = JSON.parse(jsonStr);
  if (!data || !data.repo || !data.graph || !Array.isArray(data.graph.nodes)) {
    throw new Error('Invalid GhostTrace scan JSON format.');
  }
  return data as ScanResult;
}
