"use client";

import React, {
  useState,
  useRef,
  useEffect,
  PointerEvent as ReactPointerEvent,
  ChangeEvent,
} from "react";
import { supabase } from "@/lib/supabaseClient";

interface WhiteboardMeta {
  id: number;
  title: string;
  createdAt: number;
  updatedAt: number;
}

type Tool = "pen" | "eraser" | "text";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export default function WhiteboardPage() {
  const [user, setUser] = useState<any>(null);

  const [boards, setBoards] = useState<WhiteboardMeta[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // ===== AUTH (for header display – can be removed if you don’t care here) =====
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // ===== LOAD BOARDS FROM LOCALSTORAGE =====
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedMeta = localStorage.getItem("vr_whiteboards_meta");
      if (storedMeta) {
        const parsed: WhiteboardMeta[] = JSON.parse(storedMeta);
        setBoards(parsed);
        if (parsed.length > 0) {
          setActiveBoardId(parsed[0].id);
        }
      } else {
        // create a default board
        const initial: WhiteboardMeta = {
          id: Date.now(),
          title: "Main Whiteboard",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setBoards([initial]);
        setActiveBoardId(initial.id);
        saveBoardsMeta([initial]);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ===== SAVE BOARDS META =====
  function saveBoardsMeta(nextBoards: WhiteboardMeta[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem("vr_whiteboards_meta", JSON.stringify(nextBoards));
  }

  // ===== LOAD CANVAS WHEN ACTIVE BOARD CHANGES =====
  useEffect(() => {
    if (!activeBoardId || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // reset
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (typeof window === "undefined") return;

    const key = `vr_board_${activeBoardId}`;
    const dataUrl = localStorage.getItem(key);
    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      };
      img.src = dataUrl;
    }
  }, [activeBoardId]);

  // ===== SAVE CANVAS TO LOCALSTORAGE =====
  function saveActiveBoardImage() {
    if (!activeBoardId || !canvasRef.current || typeof window === "undefined") return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const key = `vr_board_${activeBoardId}`;
    localStorage.setItem(key, dataUrl);

    setBoards((prev) => {
      const next = prev.map((b) =>
        b.id === activeBoardId ? { ...b, updatedAt: Date.now() } : b
      );
      saveBoardsMeta(next);
      return next;
    });
  }

  // ===== CREATE / DELETE BOARDS =====
  function handleAddBoard() {
    const now = Date.now();
    const newBoard: WhiteboardMeta = {
      id: now,
      title: `Whiteboard ${boards.length + 1}`,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...boards, newBoard];
    setBoards(next);
    setActiveBoardId(newBoard.id);
    saveBoardsMeta(next);
  }

  function handleDeleteBoard(id: number) {
    if (boards.length === 1) {
      alert("Keep at least one whiteboard.");
      return;
    }
    const confirmed = window.confirm("Delete this whiteboard?");
    if (!confirmed) return;

    const next = boards.filter((b) => b.id !== id);
    setBoards(next);
    saveBoardsMeta(next);

    if (typeof window !== "undefined") {
      localStorage.removeItem(`vr_board_${id}`);
    }

    if (activeBoardId === id && next.length > 0) {
      setActiveBoardId(next[0].id);
    }
  }

  function handleRenameBoard(id: number, title: string) {
    setBoards((prev) => {
      const next = prev.map((b) =>
        b.id === id ? { ...b, title, updatedAt: Date.now() } : b
      );
      saveBoardsMeta(next);
      return next;
    });
  }

  // ===== POINTER HELPERS =====
  function getCanvasCoords(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return { x, y };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return;
    canvasRef.current.setPointerCapture(e.pointerId);

    const { x, y } = getCanvasCoords(e);
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (tool === "text") {
      const text = window.prompt("Enter text:");
      if (text && text.trim().length > 0) {
        ctx.font = "20px system-ui";
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        saveActiveBoardImage();
      }
      return;
    }

    setIsDrawing(true);
    lastPointRef.current = { x, y };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawing || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    const last = lastPointRef.current || { x, y };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPointRef.current = { x, y };
  }

  function endDrawing(e?: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return;
    if (e) {
      try {
        canvasRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      saveActiveBoardImage();
    }
  }

  // ===== CLEAR BOARD =====
  function handleClearBoard() {
    if (!canvasRef.current) return;
    const ok = window.confirm("Clear this entire whiteboard?");
    if (!ok) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    saveActiveBoardImage();
  }

  // ===== IMAGE UPLOAD =====
  function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current!.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        saveActiveBoardImage();
      };
      if (typeof reader.result === "string") {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  }

  const activeBoard = boards.find((b) => b.id === activeBoardId) || null;

  return (
    <main className="flex flex-col min-h-screen bg-[#050505] text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/95 border-b border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
            VR
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-semibold">
              VisuaRealm Whiteboard
            </h1>
            <p className="text-[11px] text-gray-400">
              Sketch ideas, flows, UI, and game plans.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs">
          {user && (
            <span className="text-gray-400">
              Signed in as <b>{user.email}</b>
            </span>
          )}
        </div>
      </header>

      {/* Layout */}
      <div className="flex-1 flex flex-col sm:flex-row">
        {/* Sidebar – boards list */}
        <aside className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-neutral-800 bg-neutral-950/80 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold tracking-wide uppercase text-gray-400">
              Whiteboards
            </h2>
            <button
              onClick={handleAddBoard}
              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
            >
              + New
            </button>
          </div>

          <div className="space-y-2 max-h-[40vh] sm:max-h-[calc(100vh-120px)] overflow-y-auto">
            {boards.map((board) => {
              const isActive = board.id === activeBoardId;
              const updated = new Date(board.updatedAt);
              const timeLabel = updated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <button
                  key={board.id}
                  onClick={() => setActiveBoardId(board.id)}
                  className={`w-full text-left p-2 rounded-lg border flex flex-col gap-1 transition ${
                    isActive
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={board.title}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleRenameBoard(board.id, e.target.value)}
                      className="flex-1 bg-transparent text-xs font-medium outline-none"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBoard(board.id);
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    Updated {timeLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main whiteboard area */}
        <section className="flex-1 flex flex-col min-h-[60vh]">
          {/* Toolbar */}
          <div className="border-b border-neutral-800 bg-neutral-950/90 px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="hidden sm:inline text-gray-400 text-[11px]">
              Tools
            </span>

            <div className="flex gap-1">
              <button
                onClick={() => setTool("pen")}
                className={`px-2 py-1 rounded-full border ${
                  tool === "pen"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-neutral-700 bg-neutral-900 text-gray-200"
                }`}
              >
                Pen
              </button>
              <button
                onClick={() => setTool("eraser")}
                className={`px-2 py-1 rounded-full border ${
                  tool === "eraser"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-neutral-700 bg-neutral-900 text-gray-200"
                }`}
              >
                Eraser
              </button>
              <button
                onClick={() => setTool("text")}
                className={`px-2 py-1 rounded-full border ${
                  tool === "text"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-neutral-700 bg-neutral-900 text-gray-200"
                }`}
              >
                Text
              </button>
            </div>

            <div className="h-6 w-px bg-neutral-800 mx-1" />

            <label className="flex items-center gap-1">
              <span className="text-[11px] text-gray-400">Color</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded border border-neutral-700 bg-neutral-900 p-0"
              />
            </label>

            <label className="flex items-center gap-1">
              <span className="text-[11px] text-gray-400">Size</span>
              <input
                type="range"
                min={1}
                max={30}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="w-6 text-right text-[11px] text-gray-300">
                {brushSize}
              </span>
            </label>

            <div className="h-6 w-px bg-neutral-800 mx-1" />

            <label className="flex items-center gap-1 cursor-pointer text-[11px] text-gray-300">
              <span className="px-2 py-1 rounded-full border border-neutral-700 bg-neutral-900 hover:bg-neutral-800">
                Upload image
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleClearBoard}
              className="ml-auto px-2 py-1 rounded-full border border-red-500/70 text-red-300 hover:bg-red-500/10"
            >
              Clear board
            </button>
          </div>

          {/* Canvas wrapper */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center bg-[#050505]"
          >
            <div className="w-full max-w-5xl aspect-[3/2] sm:aspect-[3/2] px-2 sm:px-4 py-3">
              <div className="w-full h-full border border-neutral-800 rounded-xl overflow-hidden bg-[#121212] shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="w-full h-full touch-none cursor-crosshair"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrawing}
                  onPointerLeave={endDrawing}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
