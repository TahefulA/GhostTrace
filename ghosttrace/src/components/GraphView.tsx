import React, { useState, useMemo, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  Layers,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Eye,
  Info,
  Shield,
  HelpCircle,
  Compass,
  Navigation,
  Target,
  ChevronRight,
  ChevronLeft,
  Crosshair,
  ExternalLink,
  Flame,
  GitBranch,
  Search,
  CheckCircle2,
  X,
  Radio,
  BookOpen,
} from 'lucide-react';
import type { GraphNode, GraphEdge, PackageHealthStatus } from '../types';
import { generateSampleGraph } from '../lib/graph';

// WebGL availability check
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Color mapper for nodes
export function getNodeColor(status: PackageHealthStatus, riskScore: number): string {
  if (status === 'vulnerable' || riskScore >= 75) return '#f43f5e'; // rose-500
  if (status === 'deprecated') return '#f59e0b'; // amber-500
  if (status === 'major-behind') return '#f97316'; // orange-500
  if (status === 'minor-behind' || status === 'patch-behind') return '#eab308'; // yellow-500
  return '#10b981'; // emerald-500 (up-to-date)
}

// Lightweight ErrorBoundary for 3D Canvas
interface ErrorBoundaryProps {
  children: ReactNode;
  onErrorFallback: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GhostTrace Canvas Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.onErrorFallback(this.state.error);
    }
    return this.props.children;
  }
}

// AutoFit camera to bounding box of nodes
function AutoFitCamera({
  nodes,
  resetTrigger,
}: {
  nodes: GraphNode[];
  resetTrigger: number;
}) {
  const { camera, controls } = useThree();

  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const z = node.z ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dz = maxZ - minZ;
    const maxDim = Math.max(dx, dy, dz, 60);

    const fov = (camera as THREE.PerspectiveCamera).fov || 60;
    const distance = Math.max(120, (maxDim / 2) / Math.tan((fov * Math.PI) / 360) * 1.5);

    camera.position.set(cx, cy, cz + distance);
    camera.lookAt(cx, cy, cz);
    camera.updateProjectionMatrix();

    if (controls) {
      const orbit = controls as any;
      if (orbit.target) {
        orbit.target.set(cx, cy, cz);
        orbit.update();
      }
    }
  }, [nodes, camera, controls, resetTrigger]);

  return null;
}

// Smooth camera fly-to teleport animation
function CameraTeleporter({
  teleportTarget,
}: {
  teleportTarget: { x: number; y: number; z: number; key: number } | null;
}) {
  const { camera, controls } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);
  const isAnimating = useRef(false);

  useEffect(() => {
    if (
      teleportTarget &&
      Number.isFinite(teleportTarget.x) &&
      Number.isFinite(teleportTarget.y) &&
      Number.isFinite(teleportTarget.z)
    ) {
      targetPos.current = new THREE.Vector3(
        teleportTarget.x,
        teleportTarget.y + 12,
        teleportTarget.z + 45
      );
      targetLook.current = new THREE.Vector3(
        teleportTarget.x,
        teleportTarget.y,
        teleportTarget.z
      );
      isAnimating.current = true;
    }
  }, [teleportTarget]);

  useFrame((_, delta) => {
    if (!isAnimating.current || !targetPos.current || !targetLook.current) return;
    const factor = Math.min(1, delta * 6);
    camera.position.lerp(targetPos.current, factor);
    if (controls) {
      const orbit = controls as any;
      if (orbit.target) {
        orbit.target.lerp(targetLook.current, factor);
        orbit.update();
      }
    } else {
      camera.lookAt(targetLook.current);
    }
    if (camera.position.distanceTo(targetPos.current) < 0.6) {
      camera.position.copy(targetPos.current);
      if (controls && (controls as any).target) {
        (controls as any).target.copy(targetLook.current);
      }
      isAnimating.current = false;
    }
  });

  return null;
}

// Instanced Mesh component rendering all 3D nodes
function InstancedNodes({
  nodes,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
}: {
  nodes: GraphNode[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onHoverNode: (node: GraphNode | null) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Update matrices and colors
  useEffect(() => {
    if (!meshRef.current || nodes.length === 0) return;

    nodes.forEach((node, i) => {
      const x = Number.isFinite(node.x) ? node.x! : 0;
      const y = Number.isFinite(node.y) ? node.y! : 0;
      const z = Number.isFinite(node.z) ? node.z! : 0;

      tempObject.position.set(x, y, z);

      // Visible minimum size (min 3.5 radius, scaling up with blast radius)
      const isSelected = selectedNodeId === node.id;
      const baseRadius = Math.max(3.5, 3.5 + Math.sqrt(node.blastRadius || 0) * 1.3);
      const scale = isSelected ? baseRadius * 1.7 : baseRadius;

      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);

      // Color mapping
      const hex = getNodeColor(node.status, node.riskScore);
      tempColor.set(isSelected ? '#ffffff' : hex);
      meshRef.current!.setColorAt(i, tempColor);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [nodes, selectedNodeId, tempObject, tempColor]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && nodes[e.instanceId]) {
          onHoverNode(nodes[e.instanceId]);
        }
      }}
      onPointerOut={() => onHoverNode(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && nodes[e.instanceId]) {
          onSelectNode?.(nodes[e.instanceId].id);
        }
      }}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial roughness={0.3} metalness={0.2} />
    </instancedMesh>
  );
}

// 3D Line Segments for Graph Edges
function GraphEdges({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const lineGeometry = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    const positions: number[] = [];
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (
        source &&
        target &&
        Number.isFinite(source.x) &&
        Number.isFinite(source.y) &&
        Number.isFinite(source.z) &&
        Number.isFinite(target.x) &&
        Number.isFinite(target.y) &&
        Number.isFinite(target.z)
      ) {
        positions.push(
          source.x!,
          source.y!,
          source.z!,
          target.x!,
          target.y!,
          target.z!
        );
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    return geometry;
  }, [nodes, edges]);

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial
        color="#38bdf8"
        transparent={true}
        opacity={0.3}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// 2D SVG Graph Fallback component with teleport support
function Fallback2DGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
  teleportTarget,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onHoverNode: (node: GraphNode | null) => void;
  teleportTarget?: { x: number; y: number; z: number; key: number } | null;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Compute 2D bounds to center the view
  const { cx, cy, scaleFactor } = useMemo(() => {
    if (nodes.length === 0) return { cx: 400, cy: 300, scaleFactor: 1 };
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const width = Math.max(maxX - minX, 100);
    const height = Math.max(maxY - minY, 100);
    const scaleFactor = Math.min(650 / width, 450 / height, 1.8);
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      scaleFactor,
    };
  }, [nodes]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  // Handle teleport centering in 2D
  useEffect(() => {
    if (teleportTarget && Number.isFinite(teleportTarget.x) && Number.isFinite(teleportTarget.y)) {
      setPan({
        x: 400 - (teleportTarget.x - cx) * scaleFactor * 1.5,
        y: 300 - (teleportTarget.y - cy) * scaleFactor * 1.5,
      });
      setZoom(1.6);
    }
  }, [teleportTarget, cx, cy, scaleFactor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-neutral-950 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 p-1">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.25, 4))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.25, 0.4))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          title="Zoom Out"
        >
          -
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          title="Reset 2D"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      <svg className="w-full h-full pointer-events-none" viewBox="0 0 800 600">
        <g
          transform={`translate(${pan.x + 400}, ${pan.y + 300}) scale(${zoom}) translate(-400, -300)`}
          className="pointer-events-auto"
        >
          {edges.map((edge, i) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const sx = 400 + (source.x ?? 0 - cx) * scaleFactor;
            const sy = 300 + (source.y ?? 0 - cy) * scaleFactor;
            const tx = 400 + (target.x ?? 0 - cx) * scaleFactor;
            const ty = 300 + (target.y ?? 0 - cy) * scaleFactor;

            return (
              <line
                key={`edge-${i}`}
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                stroke="#0284c7"
                strokeOpacity={0.25}
                strokeWidth={1}
              />
            );
          })}

          {nodes.map((node) => {
            const nx = 400 + (node.x ?? 0 - cx) * scaleFactor;
            const ny = 300 + (node.y ?? 0 - cy) * scaleFactor;
            const isSelected = selectedNodeId === node.id;
            const radius = isSelected ? 8 : Math.max(4, 3 + Math.sqrt(node.blastRadius || 0) * 1.2);
            const color = getNodeColor(node.status, node.riskScore);

            return (
              <g
                key={node.id}
                transform={`translate(${nx}, ${ny})`}
                className="cursor-pointer"
                onMouseEnter={() => onHoverNode(node)}
                onMouseLeave={() => onHoverNode(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode?.(node.id);
                }}
              >
                <circle
                  r={radius}
                  fill={color}
                  stroke={isSelected ? '#ffffff' : '#09090b'}
                  strokeWidth={1.5}
                />
                <text
                  y={radius + 9}
                  fontSize={8}
                  fill="#d4d4d8"
                  textAnchor="middle"
                  className="font-mono pointer-events-none select-none"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onOpenDetailModal?: (id: string) => void;
  onLoadSampleGraph?: (sample: { nodes: GraphNode[]; edges: GraphEdge[] }) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId,
  onSelectNode,
  onOpenDetailModal,
  onLoadSampleGraph,
}) => {
  const webGLSupported = useMemo(() => isWebGLAvailable(), []);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(
    webGLSupported ? '3d' : '2d'
  );
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [internalFocusedNode, setInternalFocusedNode] = useState<GraphNode | null>(null);
  const [filterDirectOnly, setFilterDirectOnly] = useState(false);
  const [filterAtRiskOnly, setFilterAtRiskOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resetTrigger, setResetTrigger] = useState(0);

  // Side Guide state
  const [showGuide, setShowGuide] = useState(true);
  const [guideTab, setGuideTab] = useState<'tour' | 'waypoints' | 'legend'>('tour');
  const [tourIndex, setTourIndex] = useState(0);
  const [waypointFilter, setWaypointFilter] = useState<'all' | 'direct' | 'risk' | 'hubs'>('all');
  const [waypointSearch, setWaypointSearch] = useState('');

  // 3D Teleport camera trigger
  const [teleportTarget, setTeleportTarget] = useState<{
    x: number;
    y: number;
    z: number;
    key: number;
  } | null>(null);

  // Sync selectedNodeId prop with internalFocusedNode
  useEffect(() => {
    if (selectedNodeId) {
      const match = initialNodes.find((n) => n.id === selectedNodeId);
      if (match) setInternalFocusedNode(match);
    }
  }, [selectedNodeId, initialNodes]);

  // Teleport to a node
  const handleTeleportToNode = (node: GraphNode) => {
    if (Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)) {
      setTeleportTarget({
        x: node.x!,
        y: node.y!,
        z: node.z!,
        key: Date.now(),
      });
      setInternalFocusedNode(node);
      onSelectNode?.(node.id);
    }
  };

  const handleLoadSample = () => {
    const sample = generateSampleGraph();
    if (onLoadSampleGraph) {
      onLoadSampleGraph(sample);
    }
  };

  // Filter nodes for canvas
  const filteredNodes = useMemo(() => {
    return initialNodes.filter((node) => {
      if (filterDirectOnly && !node.isDirect) return false;
      if (filterAtRiskOnly && node.status === 'up-to-date' && node.riskScore < 40)
        return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (
          node.name.toLowerCase().includes(query) ||
          node.installedVersion.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [initialNodes, filterDirectOnly, filterAtRiskOnly, searchQuery]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return initialEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
  }, [filteredNodes, initialEdges]);

  // Key Tour Waypoints
  const tourSteps = useMemo(() => {
    if (initialNodes.length === 0) return [];

    // 1. Direct Root cluster
    const directRoot =
      initialNodes
        .filter((n) => n.isDirect)
        .sort((a, b) => (b.blastRadius || 0) - (a.blastRadius || 0))[0] ||
      initialNodes[0];

    // 2. Highest vulnerability or risk
    const highRisk =
      initialNodes
        .filter((n) => n.status === 'vulnerable' || n.riskScore >= 70)
        .sort((a, b) => b.riskScore - a.riskScore)[0] ||
      [...initialNodes].sort((a, b) => b.riskScore - a.riskScore)[0];

    // 3. Max Blast Radius Hub
    const maxHub = [...initialNodes].sort(
      (a, b) => (b.blastRadius || 0) - (a.blastRadius || 0)
    )[0];

    // 4. Outdated / Major lag
    const outdated =
      initialNodes.find((n) => n.status === 'major-behind' || n.status === 'deprecated') ||
      initialNodes.find((n) => n.status === 'minor-behind') ||
      initialNodes[0];

    // 5. Deepest transitive leaf
    const deepLeaf = [...initialNodes].sort((a, b) => (b.depth || 0) - (a.depth || 0))[0];

    return [
      {
        stepNum: 1,
        title: 'Starting Point: Direct Roots',
        badge: 'Root Anchor',
        badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
        targetNode: directRoot,
        summary:
          'Declared directly in package.json. These form the primary entry roots anchoring your entire tree.',
        details: directRoot
          ? `Primary anchor: "${directRoot.name}" (${directRoot.installedVersion}). Gravitates at the center of the orbit.`
          : 'Root entry packages',
      },
      {
        stepNum: 2,
        title: 'Highest Security Vulnerability',
        badge: 'Vulnerability Hotspot',
        badgeColor: 'text-rose-300 border-rose-500/40 bg-rose-950/40',
        targetNode: highRisk,
        summary:
          'Packages carrying security advisories or high risk scores. Displayed with prominent red coloring.',
        details: highRisk
          ? `Focused package: "${highRisk.name}" has risk score ${highRisk.riskScore}/100. Status: ${highRisk.status}.`
          : 'Security hotspots across the graph',
      },
      {
        stepNum: 3,
        title: 'Core Hub & Maximum Blast Radius',
        badge: 'Heaviest Hub',
        badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
        targetNode: maxHub,
        summary:
          'Foundational dependencies that the largest number of packages rely upon. Notice the larger node sphere.',
        details: maxHub
          ? `Largest hub: "${maxHub.name}" supports ${maxHub.blastRadius} downstream packages in your application.`
          : 'Core infrastructure packages',
      },
      {
        stepNum: 4,
        title: 'Major Version Debt',
        badge: 'Semver Gap',
        badgeColor: 'text-orange-300 border-orange-500/40 bg-orange-950/40',
        targetNode: outdated,
        summary:
          'Packages one or more semver major versions behind latest. Major bumps require checking breaking API changes.',
        details: outdated
          ? `Package "${outdated.name}" (${outdated.installedVersion}). Status: ${outdated.status}.`
          : 'Outdated semver packages',
      },
      {
        stepNum: 5,
        title: 'Deep Transitive Orbit',
        badge: 'Nested Leaf',
        badgeColor: 'text-indigo-300 border-indigo-500/40 bg-indigo-950/40',
        targetNode: deepLeaf,
        summary:
          'Sub-dependencies nested 2+ levels deep. You do not manage them directly, but they execute in your runtime.',
        details: deepLeaf
          ? `Deepest branch: "${deepLeaf.name}" at Level ${deepLeaf.depth} depth.`
          : 'Deep nested dependency leaves',
      },
    ];
  }, [initialNodes]);

  // Filtered waypoints list
  const waypointsList = useMemo(() => {
    let list = initialNodes;
    if (waypointFilter === 'direct') {
      list = list.filter((n) => n.isDirect);
    } else if (waypointFilter === 'risk') {
      list = list.filter((n) => n.status === 'vulnerable' || n.riskScore >= 60 || n.status === 'deprecated');
    } else if (waypointFilter === 'hubs') {
      list = [...list].sort((a, b) => (b.blastRadius || 0) - (a.blastRadius || 0)).slice(0, 25);
    }
    if (waypointSearch.trim()) {
      const q = waypointSearch.toLowerCase().trim();
      list = list.filter((n) => n.name.toLowerCase().includes(q) || n.installedVersion.includes(q));
    }
    return list;
  }, [initialNodes, waypointFilter, waypointSearch]);

  const currentTour = tourSteps[tourIndex];
  const activeFocus = internalFocusedNode || hoveredNode || (currentTour ? currentTour.targetNode : null);

  const handleNextTour = () => {
    const nextIdx = (tourIndex + 1) % tourSteps.length;
    setTourIndex(nextIdx);
    const target = tourSteps[nextIdx]?.targetNode;
    if (target) handleTeleportToNode(target);
  };

  const handlePrevTour = () => {
    const prevIdx = (tourIndex - 1 + tourSteps.length) % tourSteps.length;
    setTourIndex(prevIdx);
    const target = tourSteps[prevIdx]?.targetNode;
    if (target) handleTeleportToNode(target);
  };

  return (
    <div className="space-y-3">
      {/* Graph Toolbar / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          {/* 3D vs 2D Toggle */}
          <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5 text-xs font-mono">
            <button
              onClick={() => {
                if (!webGLSupported) {
                  return;
                }
                setViewMode('3d');
              }}
              disabled={!webGLSupported}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                viewMode === '3d'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 disabled:opacity-40 disabled:hover:text-neutral-400'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>3D Orbit</span>
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                viewMode === '2d'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>2D Canvas</span>
            </button>
          </div>

          {/* Side Guide Toggle Button */}
          <button
            onClick={() => setShowGuide((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
              showGuide
                ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 font-medium'
                : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
            }`}
            title="Toggle Side Teleport Guide"
          >
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>{showGuide ? 'Hide Guide' : 'Open Side Guide'}</span>
          </button>

          {/* Reset Camera button */}
          <button
            onClick={() => setResetTrigger((t) => t + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
            title="Reset Camera Center"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset View</span>
          </button>

          {/* Sample Graph Loader */}
          <button
            onClick={handleLoadSample}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-900/40 transition-colors"
            title="Load built-in 15-node test graph to verify renderer"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Load sample graph</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search in canvas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:border-cyan-500 focus:outline-none w-32 sm:w-40"
          />

          <button
            onClick={() => setFilterDirectOnly((prev) => !prev)}
            className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
              filterDirectOnly
                ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 font-medium'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Direct only
          </button>

          <button
            onClick={() => setFilterAtRiskOnly((prev) => !prev)}
            className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
              filterAtRiskOnly
                ? 'border-rose-500/50 bg-rose-950/40 text-rose-300 font-medium'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            At Risk
          </button>
        </div>
      </div>

      {/* Main Container: Split Layout with 3D/2D Canvas and Side Teleport Guide */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch w-full">
        {/* Visual Graph View Area */}
        <div className="relative flex-1 h-[72vh] min-h-[520px] rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl">
          {/* Quick HUD Metrics Badge */}
          <div className="absolute top-3 left-3 z-10 rounded-lg border border-neutral-800/80 bg-neutral-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono text-neutral-400 pointer-events-none">
            <span>
              {filteredNodes.length} nodes &bull; {filteredEdges.length} connections
            </span>
          </div>

          {/* Status Legend HUD */}
          <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2.5 rounded-lg border border-neutral-800/80 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 text-[10.5px] font-mono text-neutral-300 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Up to date</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <span>Minor/Patch</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span>Major behind</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Deprecated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Vulnerable</span>
            </div>
          </div>

          {/* 3D Mode */}
          {viewMode === '3d' && (
            <CanvasErrorBoundary
              onErrorFallback={(err) => (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-400 mb-2" />
                  <p className="text-sm font-semibold text-neutral-200">
                    WebGL Rendering Error
                  </p>
                  <p className="text-xs text-neutral-400 font-mono max-w-md mt-1 mb-4">
                    {err.message}
                  </p>
                  <button
                    onClick={() => setViewMode('2d')}
                    className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-xs text-neutral-200 transition-colors"
                  >
                    Switch to 2D Fallback View
                  </button>
                </div>
              )}
            >
              <Canvas camera={{ position: [0, 0, 200], fov: 60 }}>
                <ambientLight intensity={0.9} />
                <directionalLight position={[150, 200, 150]} intensity={1.2} />
                <directionalLight position={[-150, -200, -150]} intensity={0.6} />

                <AutoFitCamera nodes={filteredNodes} resetTrigger={resetTrigger} />
                <CameraTeleporter teleportTarget={teleportTarget} />

                <InstancedNodes
                  nodes={filteredNodes}
                  selectedNodeId={internalFocusedNode?.id || selectedNodeId}
                  onSelectNode={(id) => {
                    const match = initialNodes.find((n) => n.id === id);
                    if (match) {
                      setInternalFocusedNode(match);
                      handleTeleportToNode(match);
                    }
                  }}
                  onHoverNode={setHoveredNode}
                />

                <GraphEdges nodes={filteredNodes} edges={filteredEdges} />

                <OrbitControls
                  makeDefault
                  enableDamping
                  dampingFactor={0.08}
                  maxDistance={2500}
                  minDistance={10}
                />
              </Canvas>
            </CanvasErrorBoundary>
          )}

          {/* 2D Fallback Mode */}
          {viewMode === '2d' && (
            <Fallback2DGraph
              nodes={filteredNodes}
              edges={filteredEdges}
              selectedNodeId={internalFocusedNode?.id || selectedNodeId}
              onSelectNode={(id) => {
                const match = initialNodes.find((n) => n.id === id);
                if (match) {
                  setInternalFocusedNode(match);
                  handleTeleportToNode(match);
                }
              }}
              onHoverNode={setHoveredNode}
              teleportTarget={teleportTarget}
            />
          )}
        </div>

        {/* Side Teleport Guide & Navigator */}
        {showGuide && (
          <aside className="w-full lg:w-84 xl:w-96 shrink-0 h-[72vh] min-h-[520px] flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/90 backdrop-blur-md overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right duration-200">
            {/* Guide Header */}
            <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-cyan-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                  Graph Teleport Guide
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/40 text-cyan-300">
                {initialNodes.length} Packages
              </span>
            </div>

            {/* Guide Navigation Tabs */}
            <div className="flex border-b border-neutral-800 text-xs bg-neutral-950/30">
              <button
                onClick={() => setGuideTab('tour')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-colors ${
                  guideTab === 'tour'
                    ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Guided Tour
              </button>
              <button
                onClick={() => setGuideTab('waypoints')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-colors ${
                  guideTab === 'waypoints'
                    ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Waypoints List
              </button>
              <button
                onClick={() => setGuideTab('legend')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-colors ${
                  guideTab === 'legend'
                    ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Visual Decoder
              </button>
            </div>

            {/* Tab 1: Guided Tour Walkthrough */}
            {guideTab === 'tour' && (
              <div className="flex-1 flex flex-col justify-between p-3.5 overflow-y-auto">
                <div className="space-y-3">
                  {/* Step tracker header */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-neutral-400">
                      Waypoint {tourIndex + 1} of {tourSteps.length}
                    </span>
                    {currentTour && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${currentTour.badgeColor}`}>
                        {currentTour.badge}
                      </span>
                    )}
                  </div>

                  {currentTour && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-100 flex items-center gap-1.5">
                          <Target className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span>{currentTour.title}</span>
                        </h4>
                        <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                          {currentTour.summary}
                        </p>
                      </div>

                      {/* Featured Node Teleport Card */}
                      {currentTour.targetNode ? (
                        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-neutral-100 truncate pr-2">
                              {currentTour.targetNode.name}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                              v{currentTour.targetNode.installedVersion}
                            </span>
                          </div>

                          <p className="text-[11px] text-neutral-400 leading-snug">
                            {currentTour.details}
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleTeleportToNode(currentTour.targetNode!)}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-cyan-400 active:scale-[0.98] transition-all shadow-md shadow-cyan-500/20"
                            >
                              <Crosshair className="h-3.5 w-3.5" />
                              <span>Teleport Camera Here</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 text-xs text-neutral-500">
                          No specific package found matching this waypoint in this graph.
                        </div>
                      )}

                      {/* Explanation of 3D layout role */}
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-2.5 text-[11px] text-neutral-400 space-y-1">
                        <span className="font-semibold text-neutral-300 flex items-center gap-1">
                          <Info className="h-3 w-3 text-cyan-400" />
                          <span>Spatial Orientation:</span>
                        </span>
                        <p className="text-[10.5px] leading-relaxed">
                          {tourIndex === 0
                            ? 'Root packages are pulled toward the core center of gravity. Everything else branches outward.'
                            : tourIndex === 1
                            ? 'Red spheres highlight security risks. Their size reveals how far that risk cascades downstream.'
                            : tourIndex === 2
                            ? 'Denser clusters of lines indicate heavy dependency convergence. Changing this package has high ripple effects.'
                            : tourIndex === 3
                            ? 'Orange nodes require version upgrades. Review breaking changelogs before upgrading.'
                            : 'Outer orbital leaves are transitive dependencies pulled in by secondary packages.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tour Prev / Next Controls */}
                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2 mt-4">
                  <button
                    onClick={handlePrevTour}
                    className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>

                  <div className="flex gap-1">
                    {tourSteps.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setTourIndex(i);
                          const target = tourSteps[i]?.targetNode;
                          if (target) handleTeleportToNode(target);
                        }}
                        className={`h-1.5 rounded-full transition-all ${
                          i === tourIndex ? 'w-4 bg-cyan-400' : 'w-1.5 bg-neutral-700'
                        }`}
                        title={`Go to Step ${i + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleNextTour}
                    className="flex items-center gap-1 rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition-colors"
                  >
                    <span>Next Point</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Waypoints List with 1-click Teleport */}
            {guideTab === 'waypoints' && (
              <div className="flex-1 flex flex-col p-3 overflow-hidden">
                {/* Search & Filter bar */}
                <div className="space-y-2 pb-2.5 border-b border-neutral-800">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search 500+ nodes to teleport..."
                      value={waypointSearch}
                      onChange={(e) => setWaypointSearch(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      onClick={() => setWaypointFilter('all')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        waypointFilter === 'all'
                          ? 'bg-neutral-700 text-white font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      All ({initialNodes.length})
                    </button>
                    <button
                      onClick={() => setWaypointFilter('direct')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        waypointFilter === 'direct'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Direct ({initialNodes.filter((n) => n.isDirect).length})
                    </button>
                    <button
                      onClick={() => setWaypointFilter('risk')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        waypointFilter === 'risk'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800 font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      High Risk
                    </button>
                    <button
                      onClick={() => setWaypointFilter('hubs')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        waypointFilter === 'hubs'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800 font-medium'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Top Hubs
                    </button>
                  </div>
                </div>

                {/* Waypoint list */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 pr-1">
                  {waypointsList.length === 0 ? (
                    <p className="text-xs text-neutral-500 text-center py-8">
                      No nodes matching filter
                    </p>
                  ) : (
                    waypointsList.slice(0, 100).map((node) => {
                      const isFocused = internalFocusedNode?.id === node.id;
                      const colorHex = getNodeColor(node.status, node.riskScore);

                      return (
                        <div
                          key={node.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                            isFocused
                              ? 'border-cyan-500/60 bg-cyan-950/30 text-white'
                              : 'border-neutral-800/80 bg-neutral-950/40 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: colorHex }}
                            />
                            <div className="truncate">
                              <span className="font-mono font-medium block truncate">
                                {node.name}
                              </span>
                              <span className="text-[10px] text-neutral-500 block">
                                v{node.installedVersion} &bull; {node.isDirect ? 'Direct' : `Level ${node.depth}`}
                                {node.blastRadius > 0 && ` &bull; ${node.blastRadius} deps`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleTeleportToNode(node)}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-cyan-500 hover:text-neutral-950 text-[10.5px] font-medium text-cyan-300 transition-colors"
                            title="Teleport 3D camera to this package"
                          >
                            <Target className="h-3 w-3" />
                            <span>Teleport</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Visual Decoder & Legend */}
            {guideTab === 'legend' && (
              <div className="flex-1 p-3.5 space-y-4 overflow-y-auto text-xs text-neutral-300">
                <div>
                  <h4 className="font-semibold text-neutral-100 flex items-center gap-1.5 mb-2">
                    <BookOpen className="h-4 w-4 text-cyan-400" />
                    <span>How to Read the 3D Space</span>
                  </h4>
                  <p className="text-[11.5px] text-neutral-400 leading-relaxed">
                    This interactive 3D simulation transforms hundreds of static lockfile rows into an intuitive physical constellation:
                  </p>
                </div>

                <div className="space-y-2 border-t border-neutral-800 pt-3">
                  <span className="text-[11px] font-semibold text-neutral-200 block uppercase tracking-wider">
                    Node Color Code
                  </span>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span><strong>Green:</strong> Up to date with latest release</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shrink-0" />
                      <span><strong>Yellow:</strong> Minor or patch update behind</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
                      <span><strong>Orange:</strong> Major semver versions behind</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span><strong>Amber:</strong> Deprecated package status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
                      <span><strong>Red:</strong> Known vulnerability advisory / CVE</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-neutral-800 pt-3 text-[11.5px]">
                  <span className="text-[11px] font-semibold text-neutral-200 block uppercase tracking-wider">
                    Geometry &amp; Dimensions
                  </span>
                  <div className="space-y-2 text-neutral-400">
                    <p>
                      <strong className="text-neutral-200">Sphere Radius:</strong> Scaled proportionally by downstream <strong>Blast Radius</strong>. Larger spheres indicate packages that many other packages depend upon.
                    </p>
                    <p>
                      <strong className="text-neutral-200">Cyan Lines:</strong> Real dependency connections (<code className="text-cyan-300">Package A imports Package B</code>).
                    </p>
                    <p>
                      <strong className="text-neutral-200">Spatial Position:</strong> Physics-based d3-force-3d simulation pulls root packages to the center and fans transitive leaves into 3D radial clusters.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Active Focused Package Inspector Footer */}
            {activeFocus && (
              <div className="border-t border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: getNodeColor(activeFocus.status, activeFocus.riskScore),
                      }}
                    />
                    <span className="font-mono text-xs font-bold text-neutral-100 truncate">
                      {activeFocus.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">
                    v{activeFocus.installedVersion}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-neutral-400 bg-neutral-900/60 rounded p-1.5 border border-neutral-800">
                  <div>
                    <span className="text-neutral-500 block">Type</span>
                    <span className="font-semibold text-neutral-200">
                      {activeFocus.isDirect ? 'Direct' : `Transitive L${activeFocus.depth}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Risk Score</span>
                    <span
                      className="font-semibold"
                      style={{
                        color: getNodeColor(activeFocus.status, activeFocus.riskScore),
                      }}
                    >
                      {activeFocus.riskScore}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Blast Radius</span>
                    <span className="font-semibold text-neutral-200">
                      {activeFocus.blastRadius} deps
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleTeleportToNode(activeFocus)}
                    className="flex-1 flex items-center justify-center gap-1 rounded bg-neutral-800 hover:bg-neutral-700 py-1 text-[11px] text-cyan-300 transition-colors"
                  >
                    <Target className="h-3 w-3" />
                    <span>Focus in 3D</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenDetailModal?.(activeFocus.id) || onSelectNode?.(activeFocus.id)}
                    className="flex-1 flex items-center justify-center gap-1 rounded bg-cyan-600 hover:bg-cyan-500 py-1 text-[11px] font-semibold text-white transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>View Package Modal</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
