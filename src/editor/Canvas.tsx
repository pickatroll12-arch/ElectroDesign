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
  type Box,
  type WorldPort,
} from '../model/geometry';
import { tipoConductor } from '../model/conductores';
import {
  addWire,
  beginTransaction,
  currentSheet,
  endTransaction,
  getState,
  moveSelectionFrom,
  placeBox,
  placeSymbol,
  resizeInstance,
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
  | { kind: 'caja'; sym: string; start: Pt }
  | { kind: 'redim'; id: string; mano: Mano; base: Box; paso: number; minimo: number; moved: boolean }
  | null;

/** Manijas para cambiar el tamaño: las cuatro esquinas, o el extremo derecho de una barra. */
type Mano = 'nw' | 'ne' | 'sw' | 'se' | 'e';

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
  const wireTipo = useStore((s) => s.wireTipo);
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
    // Radio de captura: unos 12 px, pero siempre menor que el paso de la grilla para
    // que un clic en el punto vecino no salte al borne.
    const tol = Math.min(3.5, Math.max(2, 12 / viewRef.current.k));
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
      if ((drag.current?.kind === 'mover' || drag.current?.kind === 'redim') && drag.current.moved) endTransaction();
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

    const mano = (e.target as Element).getAttribute('data-mano') as Mano | null;
    if (mano && tool === 'seleccionar') {
      const inst = currentSheet().instances.find((i) => i.id === getState().selection[0]);
      const redim = inst && getSymbol(inst.sym).redim;
      if (inst && redim) {
        drag.current = { kind: 'redim', id: inst.id, mano, base: instBox(inst), paso: redim.paso, minimo: redim.minimo, moved: false };
        return;
      }
    }

    if (tool.startsWith('colocar:')) {
      // Las cajas y los contornos de tablero se dibujan arrastrando.
      const def = getSymbol(tool.slice(8));
      if (def.redim && !def.redim.soloAncho) {
        const inicio = snapPt(w);
        drag.current = { kind: 'caja', sym: def.id, start: inicio };
        setMarco({ a: inicio, b: inicio });
        return;
      }
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
    if (d?.kind === 'caja') {
      setMarco({ a: d.start, b: snapPt(w) });
      return;
    }
    if (d?.kind === 'redim') {
      const b = d.base;
      const lado = (v: number) => Math.max(d.minimo, Math.round(v / d.paso) * d.paso);
      let x1 = b.x;
      let y1 = b.y;
      let x2 = b.x + b.w;
      let y2 = b.y + b.h;
      if (d.mano === 'e' || d.mano === 'ne' || d.mano === 'se') x2 = x1 + lado(w.x - x1);
      if (d.mano === 'nw' || d.mano === 'sw') x1 = x2 - lado(x2 - w.x);
      if (d.mano === 'se' || d.mano === 'sw') y2 = y1 + lado(w.y - y1);
      if (d.mano === 'ne' || d.mano === 'nw') y1 = y2 - lado(y2 - w.y);
      const actual = currentSheet().instances.find((i) => i.id === d.id);
      const ya = actual && instBox(actual);
      if (ya && (ya.x !== x1 || ya.y !== y1 || ya.w !== x2 - x1 || ya.h !== y2 - y1)) {
        if (!d.moved) {
          d.moved = true;
          beginTransaction();
        }
        resizeInstance(d.id, x1, y1, x2 - x1, y2 - y1);
      }
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
    if ((d?.kind === 'mover' || d?.kind === 'redim') && d.moved) endTransaction();
    if (d?.kind === 'caja') {
      const fin = aMundo(e);
      const c = boxFromPoints(d.start, snapPt(fin));
      setMarco(null);
      const redim = getSymbol(d.sym).redim!;
      const lado = (v: number) => Math.max(redim.minimo, Math.round(v / redim.paso) * redim.paso);
      // Un clic sin arrastrar coloca la caja con su tamaño por defecto.
      const id = c.w < redim.minimo || c.h < redim.minimo ? placeSymbol(d.sym, fin) : placeBox(d.sym, c.x, c.y, lado(c.w), lado(c.h));
      setTool('seleccionar');
      select([id]);
    }
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

  const symElegido = tool.startsWith('colocar:') ? getSymbol(tool.slice(8)) : null;
  const symFantasma = symElegido && !(symElegido.redim && !symElegido.redim.soloAncho) ? symElegido : null;

  // Manijas del símbolo seleccionado, si se puede cambiar de tamaño.
  const manijas = useMemo(() => {
    if (tool !== 'seleccionar' || selection.length !== 1) return [];
    const inst = sheet.instances.find((i) => i.id === selection[0]);
    const redim = inst && getSymbol(inst.sym).redim;
    if (!inst || !redim || inst.rot !== 0) return [];
    const b = instBox(inst);
    if (redim.soloAncho) return [{ id: 'e' as Mano, x: b.x + b.w, y: b.y + b.h / 2, cursor: 'ew-resize' }];
    return [
      { id: 'nw' as Mano, x: b.x, y: b.y, cursor: 'nwse-resize' },
      { id: 'ne' as Mano, x: b.x + b.w, y: b.y, cursor: 'nesw-resize' },
      { id: 'sw' as Mano, x: b.x, y: b.y + b.h, cursor: 'nesw-resize' },
      { id: 'se' as Mano, x: b.x + b.w, y: b.y + b.h, cursor: 'nwse-resize' },
    ];
  }, [tool, selection, sheet]);
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
            stroke={wireTipo === 'fase' ? AZUL : tipoConductor(wireTipo).color}
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

      {manijas.map((m) => (
        <rect
          key={m.id}
          data-mano={m.id}
          x={m.x - 5 * px}
          y={m.y - 5 * px}
          width={10 * px}
          height={10 * px}
          fill="#fff"
          stroke={AZUL}
          strokeWidth={1.5 * px}
          style={{ cursor: m.cursor }}
        />
      ))}
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
