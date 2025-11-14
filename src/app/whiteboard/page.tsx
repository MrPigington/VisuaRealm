// ────────────────────────────────────────────
// WHITEBOARD TOOL TYPES
// ────────────────────────────────────────────

export type Tool =
  | "select"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "free"
  | "sticky";

// ────────────────────────────────────────────
// BASIC POINT
// ────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

// ────────────────────────────────────────────
// BASE SHAPE
// ────────────────────────────────────────────

export interface ShapeBase {
  id: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

// ────────────────────────────────────────────
// SHAPE TYPES
// ────────────────────────────────────────────

export interface RectShape extends ShapeBase {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EllipseShape extends ShapeBase {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface LineShape extends ShapeBase {
  type: "line" | "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FreeShape extends ShapeBase {
  type: "free";
  points: Point[];
}

export interface StickyShape extends ShapeBase {
  type: "sticky";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export type Shape =
  | RectShape
  | EllipseShape
  | LineShape
  | FreeShape
  | StickyShape;

// ────────────────────────────────────────────
// WHITEBOARD
// ────────────────────────────────────────────

export interface Whiteboard {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  shapes: Shape[];
  backgroundImage: string | null;
  height: number;
}

// ────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────

export const STORAGE_KEY = "visuarealm_whiteboards_v1";

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
