"use client";

import React, { useEffect, useState, useCallback } from "react";

type Tool = "select" | "rect" | "ellipse" | "line" | "arrow" | "free";

type Point = { x: number; y: number };

type ShapeBase = {
  id: string;
  type: "rect" | "ellipse" | "line" | "arrow" | "free";
  stroke: string;
  strokeWidth: number;
  fill?: string;
};

export type RectShape = ShapeBase & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EllipseShape = ShapeBase & {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type LineShape = ShapeBase & {
  type: "line" | "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type FreeShape = ShapeBase & {
  type: "free";
  points: Point[];
};

export type Shape = RectShape | EllipseShape | LineShape | FreeShape;

interface Whiteboard {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  shapes: Shape[];
}

const STORAGE_KEY = "visuarealm_whiteboards_v1";

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function WhiteboardPage() {
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>("rect");
  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(2);

  const [isDrawing, setIsDrawing] = useState(false);
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null);

  // Load boards from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Whiteboard[];
        if (parsed.length > 0) {
          setBoards(parsed);
          setActiveBoardId(parsed[0].id);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fallback default board
    const defaultBoard: Whiteboard = {
      id: createId(),
      name: "Board 1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes: [],
    };
    setBoards([defaultBoard]);
    setActiveBoardId(defaultBoard.id);
  }, []);

  // Save boards to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  }, [boards]);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0];

  // Helpers to update a board
  const updateBoard = useCallback(
    (boardId: string, updater: (board: Whiteboard) => Whiteboard) => {
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? updater({ ...b }) : b))
      );
    },
    []
  );

  // Create new board
  function handleNewBoard() {
    const newBoard: Whiteboard = {
      id: createId(),
      name: `Board ${boards.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shapes: [],
    };
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);
  }

  // Delete board (if more than one)
  function handleDeleteBoard(id: string) {
    if (boards.length === 1) return;
    const filtered = boards.filter((b) => b.id !== id);
    setBoards(filtered);
    if (activeBoardId === id && filtered.length > 0) {
      setActiveBoardId(filtered[0].id);
    }
  }

  // Undo last shape
  function handleUndo() {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, (board) => ({
      ...board,
      shapes: board.shapes.slice(0, -1),
      updatedAt: Date.now(),
    }));
  }

  // Clear all shapes
  function handleClear() {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, (board) => ({
      ...board,
      shapes: [],
      updatedAt: Date.now(),
    }));
  }

  // Pointer helpers
  function getSvgPoint(
    e: React.PointerEvent<SVGSVGElement>
  ): { x: number; y: number } {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!activeBoard) return;
    if (tool === "select") return;

    e.currentTarget.setPointerCapture(e.pointerId);

    const { x, y } = getSvgPoint(e);
    const id = createId();

    let newShape: Shape | null = null;

    if (tool === "rect") {
      newShape = {
        id,
        type: "rect",
        x,
        y,
        width: 0,
        height: 0,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
      };
    } else if (tool === "ellipse") {
      newShape = {
        id,
        type: "ellipse",
        cx: x,
        cy: y,
        rx: 0,
        ry: 0,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
      };
    } else if (tool === "line" || tool === "arrow") {
      newShape = {
        id,
        type: tool,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        stroke: strokeColor,
        strokeWidth,
      };
    } else if (tool === "free") {
      newShape = {
        id,
        type: "free",
        points: [{ x, y }],
        stroke: strokeColor,
        strokeWidth,
      };
    }

    if (!newShape) return;

    setIsDrawing(true);
    setActiveShapeId(id);

    updateBoard(activeBoard.id, (board) => ({
      ...board,
      shapes: [...board.shapes, newShape as Shape],
      updatedAt: Date.now(),
    }));
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!isDrawing || !activeShapeId || !activeBoard) return;

    const { x, y } = getSvgPoint(e);

    updateBoard(activeBoard.id, (board) => {
      const shapes = board.shapes.map((shape) => {
        if (shape.id !== activeShapeId) return shape;

        if (shape.type === "rect") {
          const rect = shape as RectShape;
          return {
            ...rect,
            width: x - rect.x,
            height: y - rect.y,
          };
        }

        if (shape.type === "ellipse") {
          const ell = shape as EllipseShape;
          return {
            ...ell,
            rx: Math.abs(x - ell.cx),
            ry: Math.abs(y - ell.cy),
          };
        }

        if (shape.type === "line" || shape.type === "arrow") {
          const line = shape as LineShape;
          return {
            ...line,
            x2: x,
            y2: y,
          };
        }

        if (shape.type === "free") {
          const free = shape as FreeShape;
          return {
            ...free,
            points: [...free.points, { x, y }],
          };
        }

        return shape;
      });

      return {
        ...board,
        shapes,
        updatedAt: Date.now(),
      };
    });
  }

  function handlePointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!isDrawing) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    setActiveShapeId(null);
  }

  // Rendering helpers
  function renderShape(shape: Shape) {
    if (shape.type === "rect") {
      const r = shape as RectShape;
      const x = r.width < 0 ? r.x + r.width : r.x;
      const y = r.height < 0 ? r.y + r.height : r.y;
      const w = Math.abs(r.width);
      const h = Math.abs(r.height);
      return (
        <rect
          key={r.id}
          x={x}
          y={y}
          width={w}
          height={h}
          stroke={r.stroke}
          strokeWidth={r.strokeWidth}
          fill={r.fill ?? "transparent"}
        />
      );
    }

    if (shape.type === "ellipse") {
      const e = shape as EllipseShape;
      return (
        <ellipse
          key={e.id}
          cx={e.cx}
          cy={e.cy}
          rx={Math.abs(e.rx)}
          ry={Math.abs(e.ry)}
          stroke={e.stroke}
          strokeWidth={e.strokeWidth}
          fill={e.fill ?? "transparent"}
        />
      );
    }

    if (shape.type === "line" || shape.type === "arrow") {
      const l = shape as LineShape;
      return (
        <line
          key={l.id}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={l.stroke}
          strokeWidth={l.strokeWidth}
          markerEnd={l.type === "arrow" ? "url(#arrowhead)" : undefined}
        />
      );
    }

    if (shape.type === "free") {
      const f = shape as FreeShape;
      const points = f.points.map((p) => `${p.x},${p.y}`).join(" ");
      return (
        <polyline
          key={f.id}
          points={points}
          fill="none"
          stroke={f.stroke}
          strokeWidth={f.strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    }

    return null;
  }

  return (
    <main className="min-h-screen bg-[#050509] text-gray-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-neutral-800 px-4 md:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            VisuaRealm Whiteboards
          </h1>
          <p className="text-xs text-gray-400">
            Sketch ideas, flows, and app layouts for the AI to build.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={handleNewBoard}
            className="px-3 py-1.5 text-xs rounded-full bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            + New Board
          </button>
          <button
            onClick={handleUndo}
            className="px-3 py-1.5 text-xs rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors"
          >
            ⤺ Undo
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs rounded-full bg-neutral-900 hover:bg-neutral-800 border border-red-500/50 text-red-300 transition-colors"
          >
            🗑 Clear Board
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6">
        {/* Boards List */}
        <aside className="md:w-64 w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Boards
            </h2>
          </div>

          <div className="space-y-1 max-h-64 md:max-h-full overflow-y-auto pr-1">
            {boards.map((board) => {
              const isActive = board.id === activeBoard?.id;
              return (
                <button
                  key={board.id}
                  onClick={() => setActiveBoardId(board.id)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs border transition-colors ${
                    isActive
                      ? "bg-blue-600/20 border-blue-500 text-blue-100"
                      : "bg-neutral-900/80 border-neutral-800 hover:bg-neutral-800/80"
                  }`}
                >
                  <span className="truncate">{board.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">
                      {board.shapes.length} items
                    </span>
                    {boards.length > 1 && (
                      <span
                        className="text-red-400 text-[11px] cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBoard(board.id);
                        }}
                      >
                        ✕
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {activeBoard && (
            <div className="mt-2">
              <label className="block text-[10px] text-gray-500 mb-1">
                Rename active board
              </label>
              <input
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500"
                value={activeBoard.name}
                onChange={(e) =>
                  updateBoard(activeBoard.id, (b) => ({
                    ...b,
                    name: e.target.value,
                    updatedAt: Date.now(),
                  }))
                }
              />
            </div>
          )}
        </aside>

        {/* Whiteboard + Toolbar */}
        <section className="flex-1 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-500 mr-2">
              Tools
            </span>

            {[
              { key: "select", label: "Select" },
              { key: "rect", label: "Rect" },
              { key: "ellipse", label: "Circle" },
              { key: "line", label: "Line" },
              { key: "arrow", label: "Arrow" },
              { key: "free", label: "Freehand" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTool(t.key as Tool)}
                className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                  tool === t.key
                    ? "bg-blue-600 text-white border-blue-400"
                    : "bg-neutral-900 text-gray-300 border-neutral-700 hover:bg-neutral-800"
                }`}
              >
                {t.label}
              </button>
            ))}

            <div className="h-6 w-px bg-neutral-800 mx-2" />

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Stroke</span>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-6 h-6 rounded-full border border-neutral-700 bg-neutral-900 p-0"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Fill</span>
              <input
                type="color"
                value={fillColor === "transparent" ? "#000000" : fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="w-6 h-6 rounded-full border border-neutral-700 bg-neutral-900 p-0"
              />
              <button
                onClick={() => setFillColor("transparent")}
                className="px-2 py-1 rounded-full text-[10px] border border-neutral-700 text-gray-400 hover:bg-neutral-900"
              >
                None
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] text-gray-500">Stroke width</span>
              <input
                type="range"
                min={1}
                max={8}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-[10px] text-gray-400 w-4 text-right">
                {strokeWidth}
              </span>
            </div>
          </div>

          {/* Whiteboard Canvas */}
          <div className="flex-1 bg-neutral-950/90 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="w-full h-full min-h-[360px] md:min-h-[520px]">
              <svg
                className="w-full h-full touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {/* Arrowhead definition */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
                  </marker>
                </defs>

                {/* Faint grid */}
                <pattern
                  id="smallGrid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.08)"
                    strokeWidth="0.5"
                  />
                </pattern>
                <rect
                  width="100%"
                  height="100%"
                  fill="url(#smallGrid)"
                  opacity={0.9}
                />

                {/* Existing shapes */}
                {activeBoard?.shapes.map((shape) => renderShape(shape))}
              </svg>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
