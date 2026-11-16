import type { End, Instance, Pt, Rot, Sheet, Wire } from './types';
import { isPortEnd } from './types';
import { getSymbol } from '../symbols';

/** Paso de la grilla en mm. Todos los bornes caen sobre ella. */
export const GRID = 5;

export const snap = (v: number, step = GRID) => Math.round(v / step) * step;
export const snapPt = (p: Pt, step = GRID): Pt => ({ x: snap(p.x, step), y: snap(p.y, step) });

export function rotateVec(dx: number, dy: number, rot: Rot): Pt {
  switch (rot) {
    case 90:
      return { x: -dy, y: dx };
    case 180:
      return { x: -dx, y: -dy };
    case 270:
      return { x: dy, y: -dx };
    default:
      return { x: dx, y: dy };
  }
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function instSize(inst: Instance): { w: number; h: number } {
  const def = getSymbol(inst.sym);
  return def.size ? def.size(inst.props) : { w: def.w, h: def.h };
}

export function instCenter(inst: Instance): Pt {
  const { w, h } = instSize(inst);
  return { x: inst.x + w / 2, y: inst.y + h / 2 };
}

/** Caja envolvente del símbolo ya rotado. */
export function instBox(inst: Instance): Box {
  const { w, h } = instSize(inst);
  const c = instCenter(inst);
  const swap = inst.rot === 90 || inst.rot === 270;
  const bw = swap ? h : w;
  const bh = swap ? w : h;
  return { x: c.x - bw / 2, y: c.y - bh / 2, w: bw, h: bh };
}

export function localToWorld(inst: Instance, p: Pt): Pt {
  const { w, h } = instSize(inst);
  const r = rotateVec(p.x - w / 2, p.y - h / 2, inst.rot);
  return { x: inst.x + w / 2 + r.x, y: inst.y + h / 2 + r.y };
}

export interface WorldPort extends Pt {
  inst: string;
  port: string;
}

export function instPorts(inst: Instance): WorldPort[] {
  const def = getSymbol(inst.sym);
  return def.ports(inst.props).map((p) => ({ ...localToWorld(inst, p), inst: inst.id, port: p.id }));
}

export function sheetPorts(sheet: Sheet): WorldPort[] {
  return sheet.instances.flatMap(instPorts);
}

export function resolveEnd(sheet: Sheet, e: End): Pt | null {
  if (!isPortEnd(e)) return e;
  const inst = sheet.instances.find((i) => i.id === e.inst);
  if (!inst) return null;
  const p = instPorts(inst).find((q) => q.port === e.port);
  return p ? { x: p.x, y: p.y } : null;
}

/**
 * Traza ortogonal de un conductor.
 * Sin puntos intermedios y con extremos desalineados usa una "Z" (baja, cruza, baja),
 * que es la forma habitual en un unilineal de arriba hacia abajo.
 */
export function routeWire(sheet: Sheet, w: Wire): Pt[] | null {
  const a = resolveEnd(sheet, w.a);
  const b = resolveEnd(sheet, w.b);
  if (!a || !b) return null;
  const nodes = [a, ...w.via, b];
  const out: Pt[] = [nodes[0]];
  const push = (p: Pt) => {
    const last = out[out.length - 1];
    if (last.x !== p.x || last.y !== p.y) out.push(p);
  };
  for (let i = 1; i < nodes.length; i++) {
    const p = nodes[i - 1];
    const q = nodes[i];
    if (p.x !== q.x && p.y !== q.y) {
      if (nodes.length === 2) {
        const ym = snap((p.y + q.y) / 2);
        push({ x: p.x, y: ym });
        push({ x: q.x, y: ym });
      } else {
        push({ x: p.x, y: q.y });
      }
    }
    push(q);
  }
  return out;
}

export function pointOnSegment(p: Pt, a: Pt, b: Pt, tol = 0.01): boolean {
  if (Math.abs(a.x - b.x) < tol) {
    return Math.abs(p.x - a.x) < tol && p.y >= Math.min(a.y, b.y) - tol && p.y <= Math.max(a.y, b.y) + tol;
  }
  if (Math.abs(a.y - b.y) < tol) {
    return Math.abs(p.y - a.y) < tol && p.x >= Math.min(a.x, b.x) - tol && p.x <= Math.max(a.x, b.x) + tol;
  }
  return false;
}

/** Puntos donde se dibuja un nudo de conexión. */
export function junctions(sheet: Sheet): Pt[] {
  const routes = sheet.wires.map((w) => ({ w, pts: routeWire(sheet, w) }));
  const count = new Map<string, { p: Pt; n: number }>();
  const dots = new Map<string, Pt>();
  const key = (p: Pt) => `${p.x},${p.y}`;
  for (const { w, pts } of routes) {
    if (!pts) continue;
    const ends: [End, Pt][] = [
      [w.a, pts[0]],
      [w.b, pts[pts.length - 1]],
    ];
    for (const [end, p] of ends) {
      const k = key(p);
      const c = count.get(k) ?? { p, n: 0 };
      c.n++;
      count.set(k, c);
      if (isPortEnd(end)) {
        const inst = sheet.instances.find((i) => i.id === end.inst);
        if (inst && getSymbol(inst.sym).junctionOnConnect) dots.set(k, p);
      } else {
        // Extremo libre apoyado sobre el recorrido de otro conductor.
        for (const other of routes) {
          if (other.w === w || !other.pts) continue;
          for (let i = 1; i < other.pts.length; i++) {
            if (pointOnSegment(p, other.pts[i - 1], other.pts[i])) dots.set(k, p);
          }
        }
      }
    }
  }
  for (const [k, c] of count) if (c.n >= 3) dots.set(k, c.p);
  return [...dots.values()];
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function boxFromPoints(a: Pt, b: Pt): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}
