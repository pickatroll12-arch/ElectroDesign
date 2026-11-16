// Lienzo interactivo: zoom, desplazamiento, colocar símbolos, mover, seleccionar
// y trazar conductores. Funciona con ratón, lápiz y dedos (eventos de puntero).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { End, Pt, Sheet, Wire } from '../model/types';
import { sheetGeom } from '../model/formats';
import {
  GRID,
  boxFromPoints,
  boxesIntersect,
  instBox,
  instSize,
  routeWire,
  sheetPorts,
  snap,
  snapPt,
  type WorldPort,
} from '../model/geometry';
import {
  addWire,
  beginTransaction,
  currentSheet,
  endTransaction,
  getState,
  moveSelectionFrom,
  placeSymbol,
  select,
  setTool,
  useStore,
} from '../model/store';
import { defaultProps, getSymbol } from '../symbols';
import { SheetContent } from './SheetContent';

interface View {
  x: number;
  y: number;
  /** Píxeles por milímetro. */
  k: number;
}

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'mover'; start: Pt; base: Sheet; ids: string[]; moved: boolean }
  | { kind: 'marco'; start: Pt; add: string[] }
  | null;

interface Borrador {
  a: End;
  via: Pt[];
  cur: Pt;
}

const K_MIN = 0.25;
const K_MAX = 60;
const AZUL = '#1f7ae0';

export function Canvas({ onCursor }: { onCursor?: (p: Pt | null, zoom: number) => void }) {
  const project = useStore((s) => s.project);
  const sheetId = useStore((s) => s.sheetId);
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const sheet = project.sheets.find((h) => h.id === sheetId) ?? project.sheets[0];
  const geom = sheetGeom(sheet.format, sheet.landscape);

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 2 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const drag = useRef<Drag>(null);
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const pellizco = useRef<{ d: number; cx: number; cy: number; view: View } | null>(null);
  const espacio = useRef(false);
  const [marco, setMarco] = useState<{ a: Pt; b: Pt } | null>(null);
  const [fantasma, setFantasma] = useState<Pt | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [portCerca, setPortCerca] = useState<WorldPort | null>(null);

  // ---------- vista ----------

  const ajustar = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const margen = 24;
    const k = Math.min((r.width - 2 * margen) / geom.w, (r.height - 2 * margen) / geom.h);
    setView({ k, x: -(r.width / k - geom.w) / 2, y: -(r.height / k - geom.h) / 2 });
  }, [geom.w, geom.h]);

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Al cambiar de hoja o de formato, se encuadra la hoja completa.
  useLayoutEffect(() => {
    ajustar();
  }, [sheetId, ajustar]);

  useEffect(() => {
    window.addEventListener('ed:ajustar', ajustar);
    return () => window.removeEventListener('ed:ajustar', ajustar);
  }, [ajustar]);

  const aMundo = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (e.clientX - r.left) / v.k + v.x, y: (e.clientY - r.top) / v.k + v.y };
  };

  const zoomEn = (cx: number, cy: number, factor: number, base: View = viewRef.current) => {
    const r = svgRef.current!.getBoundingClientRect();
    const k = Math.min(K_MAX, Math.max(K_MIN, base.k * factor));
    const mx = (cx - r.left) / base.k + base.x;
    const my = (cy - r.top) / base.k + base.y;
    setView({ k, x: mx - (cx - r.left) / k, y: my - (cy - r.top) / k });
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomEn(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---------- teclado propio del lienzo ----------

  const terminarBorrador = useCallback(() => {
    setBorrador((b) => {
      if (b && b.via.length > 0) {
        const fin = b.via[b.via.length - 1];
        const via = b.via.filter((p) => p.x !== fin.x || p.y !== fin.y);
        addWire(b.a, fin, via);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !esCampo(e.target)) {
        espacio.current = true;
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        if (borrador) setBorrador(null);
        else if (getState().tool !== 'seleccionar') setTool('seleccionar');
        else select([]);
        setFantasma(null);
      }
      if (e.key === 'Enter' && borrador) terminarBorrador();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') espacio.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [borrador, terminarBorrador]);

  useEffect(() => {
    if (tool !== 'conductor') {
      setBorrador(null);
      setPortCerca(null);
    }
    if (!tool.startsWith('colocar:')) setFantasma(null);
  }, [tool]);

  // ---------- bornes ----------

  const puertos = useMemo(() => (tool === 'conductor' ? sheetPorts(sheet) : []), [tool, sheet]);

  const puertoEn = (p: Pt): WorldPort | null => {
    const tol = Math.max(2.4, 12 / viewRef.current.k);
    let mejor: WorldPort | null = null;
    let d = tol;
    for (const q of puertos) {
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist < d) {
        d = dist;
        mejor = q;
      }
    }
    return mejor;
  };

  // ---------- puntero ----------

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const el = svgRef.current!;
    el.setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Dos dedos: zoom y desplazamiento. Cancela cualquier otro gesto en curso.
    if (punteros.current.size === 2) {
      if (drag.current?.kind === 'mover' && drag.current.moved) endTransaction();
      drag.current = null;
      setMarco(null);
      const [p1, p2] = [...punteros.current.values()];
      pellizco.current = {
        d: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        cx: (p1.x + p2.x) / 2,
        cy: (p1.y + p2.y) / 2,
        view: viewRef.current,
      };
      return;
    }
    if (punteros.current.size > 2) return;

    const w = aMundo(e);
    const v = viewRef.current;
    if (e.button === 1 || e.button === 2 || tool === 'mover' || espacio.current) {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      return;
    }
    if (e.button !== 0) return;

    if (tool.startsWith('colocar:')) {
      const id = placeSymbol(tool.slice(8), w);
      // El texto se coloca una vez y queda seleccionado para escribirlo.
      if (tool === 'colocar:texto') {
        setTool('seleccionar');
        select([id]);
      }
      return;
    }

    if (tool === 'conductor') {
      const port = puertoEn(w);
      const punto: End = port ? { inst: port.inst, port: port.port } : snapPt(w);
      const cur = port ?? snapPt(w);
      if (!borrador) {
        setBorrador({ a: punto, via: [], cur });
      } else if (port) {
        const mismo = 'inst' in borrador.a && borrador.a.inst === port.inst && borrador.a.port === port.port;
        if (!mismo || borrador.via.length > 0) addWire(borrador.a, punto, borrador.via);
        setBorrador(null);
      } else {
        setBorrador({ ...borrador, via: [...borrador.via, snapPt(w)], cur });
      }
      return;
    }

    // Herramienta de selección
    const id = (e.target as Element).closest('[data-id]')?.getAttribute('data-id');
    const actual = getState().selection;
    if (id) {
      let sel = actual;
      if (e.shiftKey || e.ctrlKey || e.metaKey) sel = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id];
      else if (!actual.includes(id)) sel = [id];
      select(sel);
      if (sel.includes(id)) drag.current = { kind: 'mover', start: w, base: currentSheet(), ids: sel, moved: false };
    } else {
      const add = e.shiftKey ? actual : [];
      if (!e.shiftKey) select([]);
      drag.current = { kind: 'marco', start: w, add };
      setMarco({ a: w, b: w });
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (punteros.current.has(e.pointerId)) punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pellizco.current && punteros.current.size >= 2) {
      const [p1, p2] = [...punteros.current.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const pz = pellizco.current;
      const k = Math.min(K_MAX, Math.max(K_MIN, pz.view.k * (d / Math.max(1, pz.d))));
      const r = svgRef.current!.getBoundingClientRect();
      // El punto del plano que estaba bajo el centro del gesto sigue bajo los dedos.
      const mx = (pz.cx - r.left) / pz.view.k + pz.view.x;
      const my = (pz.cy - r.top) / pz.view.k + pz.view.y;
      setView({ k, x: mx - (cx - r.left) / k, y: my - (cy - r.top) / k });
      return;
    }

    const w = aMundo(e);
    onCursor?.(w, viewRef.current.k);
    const d = drag.current;
    if (d?.kind === 'pan') {
      const k = viewRef.current.k;
      setView((v) => ({ ...v, x: d.vx - (e.clientX - d.sx) / k, y: d.vy - (e.clientY - d.sy) / k }));
      return;
    }
    if (d?.kind === 'mover') {
      const dx = snap(w.x - d.start.x);
      const dy = snap(w.y - d.start.y);
      if (!d.moved && (dx !== 0 || dy !== 0)) {
        d.moved = true;
        beginTransaction();
      }
      if (d.moved) moveSelectionFrom(d.base, d.ids, dx, dy);
      return;
    }
    if (d?.kind === 'marco') {
      setMarco({ a: d.start, b: w });
      return;
    }
    if (tool.startsWith('colocar:')) {
      setFantasma(w);
    } else if (tool === 'conductor') {
      const port = puertoEn(w);
      setPortCerca(port);
      if (borrador) setBorrador({ ...borrador, cur: port ?? snapPt(w) });
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
    const d = drag.current;
    drag.current = null;
    if (d?.kind === 'mover' && d.moved) endTransaction();
    if (d?.kind === 'marco') {
      const w = aMundo(e);
      const caja = boxFromPoints(d.start, w);
      setMarco(null);
      if (caja.w > 1 || caja.h > 1) {
        const h = currentSheet();
        const ids = [
          ...h.instances.filter((i) => !getSymbol(i.sym).fondo && boxesIntersect(instBox(i), caja)).map((i) => i.id),
          ...h.wires
            .filter((c) => {
              const pts = routeWire(h, c);
              return pts?.every((p) => p.x >= caja.x && p.x <= caja.x + caja.w && p.y >= caja.y && p.y <= caja.y + caja.h);
            })
            .map((c) => c.id),
        ];
        select([...new Set([...d.add, ...ids])]);
      }
    }
  };

  const onLeave = () => {
    onCursor?.(null, viewRef.current.k);
    if (!drag.current) setFantasma(null);
  };

  // ---------- dibujo de ayudas ----------

  const vb = `${view.x} ${view.y} ${size.w / view.k} ${size.h / view.k}`;
  const px = 1 / view.k; // un píxel de pantalla, en mm

  const rutaBorrador = useMemo(() => {
    if (!borrador) return null;
    const temp: Wire = { id: '_', a: borrador.a, b: borrador.cur, via: borrador.via, label: '' };
    return routeWire(sheet, temp);
  }, [borrador, sheet]);

  const symFantasma = tool.startsWith('colocar:') ? getSymbol(tool.slice(8)) : null;
  const propsFantasma = useMemo(() => (symFantasma ? defaultProps(symFantasma) : {}), [symFantasma]);

  const cursor = tool === 'mover' ? 'grab' : tool === 'seleccionar' ? 'default' : 'crosshair';

  return (
    <svg
      ref={svgRef}
      className="lienzo"
      viewBox={vb}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onLeave}
      onDoubleClick={() => tool === 'conductor' && terminarBorrador()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern id="grilla" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={Math.max(0.12, px * 0.8)} fill="#9db3c8" />
          <circle cx={GRID} cy={0} r={Math.max(0.12, px * 0.8)} fill="#9db3c8" />
          <circle cx={0} cy={GRID} r={Math.max(0.12, px * 0.8)} fill="#9db3c8" />
          <circle cx={GRID} cy={GRID} r={Math.max(0.12, px * 0.8)} fill="#9db3c8" />
        </pattern>
      </defs>
      <rect x={3 * px} y={3 * px} width={geom.w} height={geom.h} fill="rgba(0,0,0,0.25)" />
      <SheetContent project={project} sheet={sheet} grid={view.k > 1.2} />

      {/* Selección */}
      <g pointerEvents="none">
        {sheet.instances
          .filter((i) => selection.includes(i.id))
          .map((i) => {
            const b = instBox(i);
            return (
              <rect
                key={i.id}
                x={b.x - 1.5}
                y={b.y - 1.5}
                width={b.w + 3}
                height={b.h + 3}
                fill="rgba(31,122,224,0.07)"
                stroke={AZUL}
                strokeWidth={1.4 * px}
                strokeDasharray={`${5 * px} ${3 * px}`}
              />
            );
          })}
        {sheet.wires
          .filter((c) => selection.includes(c.id))
          .map((c) => {
            const pts = routeWire(sheet, c);
            if (!pts) return null;
            return (
              <path
                key={c.id}
                d={pts.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}
                fill="none"
                stroke={AZUL}
                strokeWidth={Math.max(0.6, 3 * px)}
                opacity={0.75}
              />
            );
          })}

        {/* Bornes disponibles al trazar un conductor */}
        {puertos.map((p) => (
          <circle key={`${p.inst}:${p.port}`} cx={p.x} cy={p.y} r={Math.max(0.5, 2.5 * px)} fill="#fff" stroke={AZUL} strokeWidth={1.2 * px} />
        ))}
        {portCerca && <circle cx={portCerca.x} cy={portCerca.y} r={Math.max(1.2, 6 * px)} fill="rgba(31,122,224,0.3)" stroke={AZUL} strokeWidth={1.5 * px} />}

        {rutaBorrador && (
          <path
            d={rutaBorrador.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}
            fill="none"
            stroke={AZUL}
            strokeWidth={Math.max(0.35, 1.5 * px)}
            strokeDasharray={`${4 * px} ${3 * px}`}
          />
        )}

        {symFantasma && fantasma && (
          <FantasmaView sym={symFantasma.id} props={propsFantasma} centro={fantasma} />
        )}

        {marco && (
          <rect
            {...boxAttrs(marco.a, marco.b)}
            fill="rgba(31,122,224,0.08)"
            stroke={AZUL}
            strokeWidth={px}
          />
        )}
      </g>
    </svg>
  );
}

function FantasmaView({ sym, props, centro }: { sym: string; props: Record<string, string>; centro: Pt }) {
  const def = getSymbol(sym);
  const { w, h } = instSize({ id: '', sym, x: 0, y: 0, rot: 0, props });
  const x = snap(centro.x - w / 2);
  const y = snap(centro.y - h / 2);
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="none"
      stroke={AZUL}
      strokeWidth={0.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.75}
      dangerouslySetInnerHTML={{ __html: def.draw(props, 0) }}
    />
  );
}

function boxAttrs(a: Pt, b: Pt) {
  const c = boxFromPoints(a, b);
  return { x: c.x, y: c.y, width: c.w, height: c.h };
}

function esCampo(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}
