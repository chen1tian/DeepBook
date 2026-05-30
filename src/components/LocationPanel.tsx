"use client";

import { useState } from "react";
import { X, MapPin, Plus, Pencil, Trash2, Check } from "lucide-react";
import type { LocationNode, LocationConnection, LocationNetwork } from "@/lib/location-types";

interface Props {
  open: boolean;
  onClose: () => void;
  network: LocationNetwork;
  onSave: (network: LocationNetwork) => Promise<void>;
}

/* ── SVG Layout ───────────────────────────────────── */

interface LayoutNode {
  id: string;
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
}

interface LayoutEdge {
  from: LayoutNode;
  to: LayoutNode;
  description: string;
}

function computeLayout(network: LocationNetwork, width: number, height: number): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const { nodes, connections, currentNodeId } = network;
  if (nodes.length === 0) return { nodes: [], edges: [] };

  // BFS to assign layers
  const layerMap = new Map<string, number>();
  const startId = currentNodeId || nodes[0].id;
  const queue = [startId];
  layerMap.set(startId, 0);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const currentLayer = layerMap.get(current)!;

    for (const conn of connections) {
      const neighbor = conn.from === current ? conn.to : conn.to === current ? conn.from : null;
      if (neighbor && !layerMap.has(neighbor)) {
        layerMap.set(neighbor, currentLayer + 1);
        queue.push(neighbor);
      }
    }
  }

  // Unvisited nodes get max layer + 1
  let maxLayer = 0;
  for (const [, layer] of layerMap) if (layer > maxLayer) maxLayer = layer;
  for (const node of nodes) {
    if (!layerMap.has(node.id)) {
      maxLayer++;
      layerMap.set(node.id, maxLayer);
    }
  }

  // Group by layer
  const layers = new Map<number, string[]>();
  for (const [id, layer] of layerMap) {
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(id);
  }

  const layerCount = layers.size;
  const maxNodesInLayer = Math.max(...Array.from(layers.values()).map((l) => l.length), 1);

  const marginX = 60;
  const marginY = 50;
  const availW = width - marginX * 2;
  const availH = height - marginY * 2;
  const layerW = layerCount > 1 ? availW / (layerCount - 1 || 1) : availW / 2;

  const layoutNodes: LayoutNode[] = [];
  const idMap = new Map(nodes.map((n) => [n.id, n]));

  for (const [layer, ids] of layers) {
    const count = ids.length;
    const spacing = Math.min(availH / (maxNodesInLayer + 1), 80);
    const startY = marginY + (availH - (count - 1) * spacing) / 2;

    ids.forEach((id, i) => {
      const node = idMap.get(id);
      if (!node) return;
      layoutNodes.push({
        id: node.id,
        name: node.name,
        x: marginX + layer * layerW,
        y: startY + i * spacing,
        isCurrent: node.id === currentNodeId,
      });
    });
  }

  // Build edges
  const edges: LayoutEdge[] = [];
  const layoutMap = new Map(layoutNodes.map((n) => [n.id, n]));
  for (const conn of connections) {
    const from = layoutMap.get(conn.from);
    const to = layoutMap.get(conn.to);
    if (from && to) edges.push({ from, to, description: conn.description });
  }

  return { nodes: layoutNodes, edges };
}

/* ── Component ────────────────────────────────────── */

export default function LocationPanel({ open, onClose, network, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const svgW = 420;
  const svgH = 320;
  const { nodes: layoutNodes, edges } = computeLayout(network, svgW, svgH);
  const currentNode = network.nodes.find((n) => n.id === network.currentNodeId);

  function startEdit(node: LocationNode) {
    setEditingId(node.id);
    setEditName(node.name);
    setEditDesc(node.description);
    setIsAdding(false);
  }

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setEditName("");
    setEditDesc("");
  }

  function cancelEdit() {
    setEditingId(null);
    setIsAdding(false);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    let updated: LocationNetwork;
    if (isAdding) {
      const newNode: LocationNode = {
        id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: editName.trim(),
        description: editDesc.trim(),
        firstVisitedAt: new Date().toISOString(),
        lastVisitedAt: new Date().toISOString(),
      };
      updated = { ...network, nodes: [...network.nodes, newNode] };
    } else {
      updated = {
        ...network,
        nodes: network.nodes.map((n) =>
          n.id === editingId ? { ...n, name: editName.trim(), description: editDesc.trim() } : n
        ),
      };
    }
    await onSave(updated);
    setSaving(false);
    cancelEdit();
  }

  async function handleDelete(id: string) {
    const updated: LocationNetwork = {
      ...network,
      nodes: network.nodes.filter((n) => n.id !== id),
      connections: network.connections.filter((c) => c.from !== id && c.to !== id),
      currentNodeId: network.currentNodeId === id ? null : network.currentNodeId,
    };
    await onSave(updated);
  }

  async function handleSetCurrent(id: string) {
    const updated: LocationNetwork = {
      ...network,
      currentNodeId: id,
      nodes: network.nodes.map((n) =>
        n.id === id ? { ...n, lastVisitedAt: new Date().toISOString() } : n
      ),
    };
    await onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-96 max-w-[95vw] flex-col bg-zinc-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-emerald-400" />
            <span className="text-xs font-medium text-zinc-400">地点网络</span>
            <span className="text-[10px] text-zinc-600">({network.nodes.length} 个地点)</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={startAdd} className="rounded p-1 text-zinc-500 hover:text-emerald-400" title="添加地点">
              <Plus size={16} />
            </button>
            <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* SVG graph */}
        {network.nodes.length > 0 ? (
          <div className="shrink-0 border-b border-white/5 bg-zinc-950 p-2">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
              {/* edges */}
              {edges.map((e, i) => (
                <line
                  key={`edge-${i}`}
                  x1={e.from.x} y1={e.from.y}
                  x2={e.to.x} y2={e.to.y}
                  stroke="rgb(63,63,70)"
                  strokeWidth={1.5}
                  strokeDasharray={e.description ? "none" : "4,3"}
                />
              ))}
              {/* connection labels */}
              {edges.filter((e) => e.description).map((e, i) => {
                const mx = (e.from.x + e.to.x) / 2;
                const my = (e.from.y + e.to.y) / 2 - 6;
                return (
                  <text
                    key={`elabel-${i}`}
                    x={mx} y={my}
                    textAnchor="middle"
                    className="fill-zinc-600"
                    fontSize="8"
                  >
                    {e.description.length > 8 ? e.description.slice(0, 8) + "\u2026" : e.description}
                  </text>
                );
              })}
              {/* nodes */}
              {layoutNodes.map((n) => (
                <g key={n.id}>
                  <circle
                    cx={n.x} cy={n.y} r={n.isCurrent ? 26 : 22}
                    className={`${n.isCurrent ? "fill-emerald-500/20 stroke-emerald-400" : "fill-zinc-800 stroke-zinc-600"} stroke-[1.5]`}
                  />
                  <text
                    x={n.x} y={n.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`${n.isCurrent ? "fill-emerald-400" : "fill-zinc-400"} font-medium`}
                    fontSize="10"
                  >
                    {n.name.length > 4 ? n.name.slice(0, 4) + "\u2026" : n.name}
                  </text>
                  {n.isCurrent && (
                    <text
                      x={n.x} y={n.y + 38}
                      textAnchor="middle"
                      className="fill-emerald-500"
                      fontSize="9"
                    >
                      当前
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-center border-b border-white/5 bg-zinc-950 py-12">
            <p className="text-xs text-zinc-600">AI 分析对话后会自动构建地点网络</p>
          </div>
        )}

        {/* current location indicator */}
        {currentNode && (
          <div className="shrink-0 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400">当前位置：{currentNode.name}</span>
            </div>
          </div>
        )}

        {/* add/edit form */}
        {(isAdding || editingId) && (
          <div className="shrink-0 border-b border-white/5 bg-zinc-800 p-3 space-y-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="地点名称"
              className="w-full rounded bg-zinc-700 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="地点描述（可选）"
              rows={2}
              className="w-full resize-none rounded bg-zinc-700 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editName.trim()}
                className="rounded p-1.5 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-30"
                title="保存"
              >
                <Check size={14} />
              </button>
              <button onClick={cancelEdit} className="rounded p-1.5 text-zinc-500 hover:text-zinc-300" title="取消">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* location list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {network.nodes.length === 0 && (
            <p className="py-8 text-center text-xs text-zinc-600">暂无地点数据</p>
          )}
          {network.nodes.map((node) => (
            <div
              key={node.id}
              className={`rounded-lg px-3 py-2.5 ring-1 transition group ${
                node.id === network.currentNodeId
                  ? "bg-emerald-500/5 ring-emerald-500/30"
                  : "bg-zinc-800/50 ring-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-zinc-200 truncate">{node.name}</span>
                    {node.id === network.currentNodeId && (
                      <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">当前</span>
                    )}
                  </div>
                  {node.description && (
                    <p className="mt-0.5 text-xs text-zinc-500 truncate">{node.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  {node.id !== network.currentNodeId && (
                    <button
                      onClick={() => handleSetCurrent(node.id)}
                      className="rounded p-1 text-zinc-500 hover:text-emerald-400"
                      title="设为当前位置"
                    >
                      <MapPin size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(node)}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-300"
                    title="编辑"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(node.id)}
                    className="rounded p-1 text-zinc-500 hover:text-red-400"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
