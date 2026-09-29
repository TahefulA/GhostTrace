import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  ArrowUpDown,
} from 'lucide-react';
import type { GraphNode, PackageHealthStatus } from '../types';

interface PackagesTableProps {
  nodes: GraphNode[];
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

type SortField = 'name' | 'installedVersion' | 'depth' | 'riskScore' | 'blastRadius' | 'status';
type SortOrder = 'asc' | 'desc';

export const PackagesTable: React.FC<PackagesTableProps> = ({
  nodes,
  onSelectNode,
  selectedNodeId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directOnly, setDirectOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('depth');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter and sort nodes
  const filteredNodes = useMemo(() => {
    return nodes
      .filter((node) => {
        if (directOnly && !node.isDirect) return false;
        if (statusFilter !== 'all' && node.status !== statusFilter) return false;
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          return (
            node.name.toLowerCase().includes(term) ||
            node.installedVersion.toLowerCase().includes(term)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortField === 'installedVersion') cmp = a.installedVersion.localeCompare(b.installedVersion);
        else if (sortField === 'depth') cmp = a.depth - b.depth;
        else if (sortField === 'riskScore') cmp = a.riskScore - b.riskScore;
        else if (sortField === 'blastRadius') cmp = a.blastRadius - b.blastRadius;
        else if (sortField === 'status') cmp = a.status.localeCompare(b.status);

        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [nodes, searchTerm, statusFilter, directOnly, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'riskScore' || field === 'blastRadius' ? 'desc' : 'asc');
    }
  };

  const exportCSV = () => {
    const headers = [
      'Name',
      'Installed Version',
      'Latest Version',
      'Status',
      'Type',
      'Depth',
      'Blast Radius',
      'Risk Score',
    ];

    const rows = filteredNodes.map((n) => [
      n.name,
      n.installedVersion,
      n.enrichment?.latestVersion || '',
      n.status,
      n.isDirect ? (n.isDev ? 'Dev Direct' : 'Prod Direct') : 'Transitive',
      n.depth,
      n.blastRadius,
      n.riskScore,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dependencies-audit-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (node: GraphNode) => {
    switch (node.status) {
      case 'vulnerable':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 text-[11px] font-medium text-rose-300">
            <ShieldAlert className="h-3 w-3" /> Vulnerable
          </span>
        );
      case 'deprecated':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Deprecated
          </span>
        );
      case 'major-behind':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-orange-950/60 border border-orange-800/60 px-2 py-0.5 text-[11px] font-medium text-orange-300">
            <AlertCircle className="h-3 w-3" /> Major Behind
          </span>
        );
      case 'minor-behind':
      case 'patch-behind':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-yellow-950/50 border border-yellow-800/50 px-2 py-0.5 text-[11px] font-medium text-yellow-300">
            Update Available
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Up to Date
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by package name..."
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-9 pr-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter packages by health status"
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="vulnerable">Vulnerable</option>
              <option value="deprecated">Deprecated</option>
              <option value="major-behind">Major Behind</option>
              <option value="minor-behind">Minor Behind</option>
              <option value="patch-behind">Patch Behind</option>
              <option value="up-to-date">Up to Date</option>
            </select>
          </div>

          {/* Direct Only toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 pl-2">
            <input
              type="checkbox"
              checked={directOnly}
              onChange={(e) => setDirectOnly(e.target.checked)}
              className="rounded border-neutral-700 bg-neutral-800 text-cyan-500 focus:ring-0"
            />
            <span>Direct only</span>
          </label>
        </div>

        {/* Export CSV button */}
        <button
          onClick={exportCSV}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV ({filteredNodes.length})</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-neutral-800/80 bg-neutral-900/40 backdrop-blur-sm">
        <table className="w-full text-left text-xs text-neutral-300">
          <thead className="border-b border-neutral-800 bg-neutral-950/60 font-mono text-[11px] text-neutral-400">
            <tr>
              <th
                onClick={() => handleSort('name')}
                className="cursor-pointer py-3 px-4 hover:text-neutral-200"
              >
                <div className="flex items-center gap-1">
                  <span>Package</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('installedVersion')}
                className="cursor-pointer py-3 px-4 hover:text-neutral-200"
              >
                <div className="flex items-center gap-1">
                  <span>Version</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4">Latest</th>
              <th
                onClick={() => handleSort('status')}
                className="cursor-pointer py-3 px-4 hover:text-neutral-200"
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('depth')}
                className="cursor-pointer py-3 px-4 hover:text-neutral-200"
              >
                <div className="flex items-center gap-1">
                  <span>Depth</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('blastRadius')}
                className="cursor-pointer py-3 px-4 hover:text-neutral-200"
              >
                <div className="flex items-center gap-1">
                  <span>Blast Radius</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort('riskScore')}
                className="cursor-pointer py-3 px-4 hover:text-neutral-200 text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Risk Score</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-sans">
            {filteredNodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-500">
                  No packages match the selected criteria.
                </td>
              </tr>
            ) : (
              filteredNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;

                return (
                  <tr
                    key={node.id}
                    onClick={() => onSelectNode?.(node.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/40 text-cyan-200 font-medium'
                        : 'hover:bg-neutral-800/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-100">{node.name}</span>
                        {node.isDirect && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-sans ${
                              node.isDev
                                ? 'bg-neutral-800 text-neutral-400'
                                : 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                            }`}
                          >
                            {node.isDev ? 'dev' : 'direct'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-400">{node.installedVersion}</td>
                    <td className="py-3 px-4 font-mono text-neutral-300">
                      {node.enrichment?.latestVersion || '-'}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(node)}</td>
                    <td className="py-3 px-4 font-mono text-neutral-400">{node.depth}</td>
                    <td className="py-3 px-4 font-mono">
                      <span className={node.blastRadius > 5 ? 'text-amber-400 font-semibold' : 'text-neutral-400'}>
                        {node.blastRadius}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-right">
                      <span
                        className={`font-semibold ${
                          node.riskScore > 60
                            ? 'text-rose-400'
                            : node.riskScore > 30
                            ? 'text-amber-400'
                            : 'text-neutral-400'
                        }`}
                      >
                        {node.riskScore}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
