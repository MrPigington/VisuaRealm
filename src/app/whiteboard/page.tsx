"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  FormEvent,
} from "react";

type Tool = "select" | "rect" | "ellipse" | "line" | "arrow" | "free" | "sticky";

type Point = { x: number; y: number };

type ShapeBase = {
  id: string;
  type: "rect" | "ellipse" | "line" | "arrow" | "free" | "sticky";
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

export type StickyShape = ShapeBase & {
  type: "sticky";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
};

export type Shape = RectShape | EllipseShape | LineShape | FreeShape | StickyShape;

interface Whiteboard {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  shapes: Shape[];
  backgroundImage?: string | null;
  height?: number; // canvas height in px
}

const STORAGE_KEY = "visuarealm_whiteboards_v2";
const DEFAULT_HEIGHT = 1400;

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

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      backgroundImage: null,
      height: DEFAULT_HEIGHT,
    };
    setBoards([defaultBoard]);
    setActiveBoardId(defaultBoard.id);
  }, []);

  // Save boards to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  }, [boards]);

  const activeBoard =
    boards.find((b) => b.id === activeBoardId) || boards[0] || null;

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
      backgroundImage: null,
      height: DEFAULT_HEIGHT,
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

  // Change canvas height (longer board)
  function handleCanvasHeightChange(value: number) {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, (board) => ({
      ...board,
      height: value,
      updatedAt: Date.now(),
    }));
  }

  // Background image
  function handleBackgroundClick() {
    fileInputRef.current?.click();
  }

  function handleBackgroundChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!activeBoard) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateBoard(activeBoard.id, (board) => ({
        ...board,
        backgroundImage: dataUrl,
        updatedAt: Date.now(),
      }));
    };
    reader.readAsDataURL(file);
    // reset input
    e.target.value = "";
  }

  function handleRemoveBackground() {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, (board) => ({
      ...board,
      backgroundImage: null,
      updatedAt: Date.now(),
    }));
  }

  // Sticky note edit
  function handleEditSticky(id: string) {
    if (!activeBoard) return;
    const board = activeBoard;
    const shape = board.shapes.find((s) => s.id === id);
    if (!shape || shape.type !== "sticky") return;

    const current = (shape as StickyShape).text;
    const next = window.prompt("Edit sticky note text:", current);
    if (next === null) return;

    updateBoard(board.id, (b) => ({
      ...b,
      shapes: b.shapes.map((s) =>
        s.id === id && s.type === "sticky"
          ? { ...(s as StickyShape), text: next, updatedAt: Date.now() }
          : s
      ),
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

    // Sticky notes: place instantly on click
    if (tool === "sticky") {
      const { x, y } = getSvgPoint(e);
      const text = window.prompt("Sticky note text:");
      if (!text) return;

      const id = createId();
      const sticky: StickyShape = {
        id,
        type: "sticky",
        x,
        y,
        width: 180,
        height: 110,
        text,
        stroke: "#facc15",
        strokeWidth: 1.5,
        fill: "#facc15",
      };

      updateBoard(activeBoard.id, (board) => ({
        ...board,
        shapes: [...board.shapes, sticky],
        updatedAt: Date.now(),
      }));
      return;
    }

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

  // AI diagram generator
  async function handleAiGenerate(e: FormEvent) {
    e.preventDefault();
    if (!activeBoard) return;
    if (!aiPrompt.trim()) return;
    if (aiLoading) return;

    setAiLoading(true);

    const canvasHeight = activeBoard.height || DEFAULT_HEIGHT;

    const prompt = `
You are the VisuaRealm Whiteboard Diagram AI.

The user will describe a diagram they want (flows, app layout, funnels, org charts, etc.).
You MUST respond ONLY with STRICT JSON that matches this schema:

{
  "shapes": [
    {
      "type": "rect" | "ellipse" | "line" | "arrow",
      // for rect:
      "x": number,
      "y": number,
      "width": number,
      "height": number,

      // for ellipse:
      "cx": number,
      "cy": number,
      "rx": number,
      "ry": number,

      // for line/arrow:
      "x1": number,
      "y1": number,
      "x2": number,
      "y2": number
    }
  ]
}

Rules:
- Use coordinates within width 0..1200 and height 0..${canvasHeight}.
- Do NOT include comments or explanations.
- Do NOT wrap JSON in markdown.
- Keep shapes reasonably spaced and readable.
- Use rectangles for main steps/boxes, ellipses for start/end, arrows for flow connections.

User request:
${aiPrompt.trim()}
`.trim();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      const raw: string =
        (data && (data.reply || data.content || data.message)) || "";

      if (!raw.trim()) {
        setAiLoading(false);
        return;
      }

      // Try to pull JSON out (in case model wrapped it)
      let jsonText = raw.trim();
      const codeBlockMatch = jsonText.match(/```json([\s\S]*?)```/i);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
      } else {
        const genericBlock = jsonText.match(/```([\s\S]*?)```/);
        if (genericBlock) {
          jsonText = genericBlock[1].trim();
        }
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        // Last resort: try parsing raw
        parsed = JSON.parse(raw);
      }

      const incoming = Array.isArray(parsed.shapes)
        ? parsed.shapes
        : [];

      const newShapes: Shape[] = incoming
        .map((s: any): Shape | null => {
          const base = {
            id: createId(),
            stroke: strokeColor,
            strokeWidth,
            fill: fillColor,
          };

          if (s.type === "rect") {
            if (
              typeof s.x !== "number" ||
              typeof s.y !== "number" ||
              typeof s.width !== "number" ||
              typeof s.height !== "number"
            )
              return null;
            const rect: RectShape = {
              ...base,
              type: "rect",
              x: s.x,
              y: s.y,
              width: s.width,
              height: s.height,
            };
            return rect;
          }

          if (s.type === "ellipse") {
            if (
              typeof s.cx !== "number" ||
              typeof s.cy !== "number" ||
              typeof s.rx !== "number" ||
              typeof s.ry !== "number"
            )
              return null;
            const ell: EllipseShape = {
              ...base,
              type: "ellipse",
              cx: s.cx,
              cy: s.cy,
              rx: s.rx,
              ry: s.ry,
            };
            return ell;
          }

          if (s.type === "line" || s.type === "arrow") {
            if (
              typeof s.x1 !== "number" ||
              typeof s.y1 !== "number" ||
              typeof s.x2 !== "number" ||
              typeof s.y2 !== "number"
            )
              return null;
            const line: LineShape = {
              ...base,
              type: s.type,
              x1: s.x1,
              y1: s.y1,
              x2: s.x2,
              y2: s.y2,
            };
            return line;
          }

          return null;
        })
        .filter(Boolean) as Shape[];

      if (newShapes.length) {
        updateBoard(activeBoard.id, (board) => ({
          ...board,
          shapes: [...board.shapes, ...newShapes],
          updatedAt: Date.now(),
        }));
      }
    } catch (err) {
      console.error("AI whiteboard error:", err);
    } finally {
      setAiLoading(false);
    }
  }

  // Download as PNG
  async function handleDownloadPng() {
    if (!svgRef.current || !activeBoard) return;

    const svgEl = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);

    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const width = svgEl.clientWidth || 1200;
      const height = (activeBoard.height || DEFAULT_HEIGHT) || 800;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      ctx.fillStyle = "#050509";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${activeBoard.name || "whiteboard"}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
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
          rx={6}
          ry={6}
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

    if (shape.type === "sticky") {
      const s = shape as StickyShape;
      const x = s.x;
      const y = s.y;
      const lines = s.text.split("\n");

      return (
        <g
          key={s.id}
          onDoubleClick={() => handleEditSticky(s.id)}
          style={{ cursor: "pointer" }}
        >
          <rect
            x={x}
            y={y}
            width={s.width}
            height={s.height}
            rx={6}
            ry={6}
            fill={s.fill ?? "#facc15"}
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
          />
          <text
            x={x + 10}
            y={y + 22}
            fontSize={12}
            fill="#1f2937"
          >
            {lines.map((line, idx) => (
              <tspan
                key={idx}
                x={x + 10}
                dy={idx === 0 ? 0 : 14}
              >
                {line}
              </tspan>
            ))}
          </text>
        </g>
      );
    }

    return null;
  }

  const canvasHeight = activeBoard?.height || DEFAULT_HEIGHT;

  return (
    <main className="min-h-screen bg-[#050509] text-gray-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-neutral-800 px-4 md:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gradient-to-r from-[#050509] via-[#050712] to-[#050509]">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            VisuaRealm Whiteboards
          </h1>
          <p className="text-xs text-gray-400">
            Diagram ideas, flows, and app layouts — then let AI help build them.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-start md:justify-end">
          <button
            onClick={handleNewBoard}
            className="px-3 py-1.5 text-xs rounded-full bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm"
          >
            + New Board
          </button>
          <button
            onClick={handleUndo}
            className="px-3 py-1.5 text-xs rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition-colors"
          >
            ⤺ Undo
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs rounded-full bg-neutral-950 hover:bg-neutral-900 border border-red-500/60 text-red-300 transition-colors"
          >
            🗑 Clear Board
          </button>
          <button
            onClick={handleDownloadPng}
            className="px-3 py-1.5 text-xs rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-600 transition-colors"
          >
            ⬇ Export PNG
          </button>
        </div>
      </header>

      {/* Hidden file input for background */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBackgroundChange}
      />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6">
        {/* Boards List */}
        <aside className="md:w-64 w-full bg-neutral-950/90 border border-neutral-800 rounded-2xl p-3 flex flex-col gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
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
                      ? "bg-blue-600/20 border-blue-500 text-blue-100 shadow-[0_0_16px_rgba(37,99,235,0.45)]"
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
            <div className="mt-2 space-y-2">
              <div>
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

              <div>
                <label className="block text-[10px] text-gray-500 mb-1">
                  Canvas height
                </label>
                <select
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500"
                  value={canvasHeight}
                  onChange={(e) =>
                    handleCanvasHeightChange(Number(e.target.value))
                  }
                >
                  <option value={900}>Short (900px)</option>
                  <option value={1400}>Standard (1400px)</option>
                  <option value={2000}>Tall (2000px)</option>
                  <option value={2600}>Long (2600px)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackgroundClick}
                  className="flex-1 px-2 py-1.5 text-[11px] rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-gray-200 transition-colors"
                >
                  🖼 Set Background
                </button>
                {activeBoard.backgroundImage && (
                  <button
                    onClick={handleRemoveBackground}
                    className="px-2 py-1.5 text-[11px] rounded-full bg-neutral-950 hover:bg-neutral-900 border border-neutral-700 text-gray-300 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Whiteboard + Toolbar */}
        <section className="flex-1 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="w-full bg-neutral-950/90 border border-neutral-800 rounded-2xl px-3 py-2 flex flex-wrap items-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.7)]">
            <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500 mr-2">
              Tools
            </span>

            {[
              { key: "select", label: "Select" },
              { key: "rect", label: "Rect" },
              { key: "ellipse", label: "Circle" },
              { key: "line", label: "Line" },
              { key: "arrow", label: "Arrow" },
              { key: "free", label: "Freehand" },
              { key: "sticky", label: "Sticky" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTool(t.key as Tool)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  tool === t.key
                    ? "bg-blue-600 text-white border-blue-400 shadow-[0_0_12px_rgba(37,99,235,0.55)]"
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

          {/* AI toolbar */}
          <form
            onSubmit={handleAiGenerate}
            className="w-full bg-neutral-950/90 border border-neutral-800 rounded-2xl px-3 py-2 flex flex-col md:flex-row gap-2 items-stretch md:items-center shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                AI Diagram
              </span>
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe a flow, layout, or diagram to auto-draw..."
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-full px-3 py-1.5 text-xs outline-none placeholder:text-gray-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-1.5 text-xs rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-200 disabled:opacity-70 text-white transition-colors flex items-center justify-center min-w-[120px]"
            >
              {aiLoading ? "Drawing..." : "Generate"}
            </button>
          </form>

          {/* Whiteboard Canvas */}
          <div className="flex-1 bg-neutral-950/95 border border-neutral-800 rounded-2xl overflow-hidden shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
            <div className="w-full h-full max-h-[75vh] overflow-auto">
              <svg
                ref={svgRef}
                className="w-full"
                style={{ height: canvasHeight }}
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

                {/* Optional background image */}
                {activeBoard?.backgroundImage && (
                  <image
                    href={activeBoard.backgroundImage}
                    x={0}
                    y={0}
                    width="100%"
                    height={canvasHeight}
                    preserveAspectRatio="xMidYMid slice"
                    opacity={0.25}
                  />
                )}

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
                  height={canvasHeight}
                  fill="url(#smallGrid)"
                  opacity={0.9}
                />

                {/* Existing shapes (sticky notes naturally render above base shapes) */}
                {activeBoard?.shapes.map((shape) => renderShape(shape))}
              </svg>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
