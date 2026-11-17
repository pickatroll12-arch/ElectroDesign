import { useSyncExternalStore } from 'react';
import type { End, Instance, Modo, Project, Pt, Rot, Sheet, Wire } from './types';
import { isPortEnd } from './types';
import { newId, newProject, newSheet } from './project';
import { defaultProps, getSymbol } from '../symbols';
import { GRID, instSize, resolveEnd, snap } from './geometry';
import type { WireTipo } from './conductores';

export type Tool = 'seleccionar' | 'mover' | 'conductor' | `colocar:${string}`;
export type Pantalla = 'inicio' | 'editor';

export interface State {
  pantalla: Pantalla;
  project: Project;
  sheetId: string;
  selection: string[];
  tool: Tool;
  /** Tipo con el que se trazan los conductores nuevos. */
  wireTipo: WireTipo;
  /** Hay cambios sin guardar. */
  dirty: boolean;
  fileName: string;
  /** Ruta en disco (solo en la app de escritorio). */
  filePath: string | null;
  undo: Project[];
  redo: Project[];
  aviso: string | null;
  /** Pregunta de confirmación abierta, dibujada por la app (no usa window.confirm). */
  pregunta: { texto: string; aceptar: string } | null;
}

const MAX_HISTORIAL = 100;

function inicial(): State {
  const project = newProject();
  return {
    pantalla: 'inicio',
    project,
    sheetId: project.sheets[0].id,
    selection: [],
    tool: 'seleccionar',
    wireTipo: 'fase',
    dirty: false,
    fileName: 'Sin título.edz',
    filePath: null,
    undo: [],
    redo: [],
    aviso: null,
    pregunta: null,
  };
}

let state: State = inicial();
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const getState = () => state;
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

export const currentSheet = (s: State = state): Sheet =>
  s.project.sheets.find((h) => h.id === s.sheetId) ?? s.project.sheets[0];

// ---------- historial ----------

let transaccion: Project | null = null;

/**
 * Aplica un cambio al proyecto. Cada llamada queda como un paso de deshacer,
 * salvo dentro de una transacción (un arrastre), que cuenta como un solo paso.
 */
export function edit(fn: (p: Project, sheet: Sheet) => void) {
  const next = structuredClone(state.project);
  const sheet = next.sheets.find((h) => h.id === state.sheetId) ?? next.sheets[0];
  fn(next, sheet);
  if (transaccion) {
    set({ project: next, dirty: true });
  } else {
    set({
      project: next,
      dirty: true,
      undo: [...state.undo.slice(-MAX_HISTORIAL + 1), state.project],
      redo: [],
    });
  }
}

export function beginTransaction() {
  if (!transaccion) transaccion = state.project;
}

export function endTransaction() {
  if (!transaccion) return;
  const antes = transaccion;
  transaccion = null;
  if (antes !== state.project) {
    set({ undo: [...state.undo.slice(-MAX_HISTORIAL + 1), antes], redo: [] });
  }
}

export function undo() {
  const prev = state.undo[state.undo.length - 1];
  if (!prev) return;
  set({
    project: prev,
    undo: state.undo.slice(0, -1),
    redo: [...state.redo, state.project],
    selection: [],
    dirty: true,
    sheetId: prev.sheets.some((h) => h.id === state.sheetId) ? state.sheetId : prev.sheets[0].id,
  });
}

export function redo() {
  const next = state.redo[state.redo.length - 1];
  if (!next) return;
  set({
    project: next,
    redo: state.redo.slice(0, -1),
    undo: [...state.undo, state.project],
    selection: [],
    dirty: true,
    sheetId: next.sheets.some((h) => h.id === state.sheetId) ? state.sheetId : next.sheets[0].id,
  });
}

// ---------- navegación y archivo ----------

export function irA(pantalla: Pantalla) {
  set({ pantalla, tool: 'seleccionar', selection: [] });
}

export function cargarProyecto(project: Project, fileName: string, filePath: string | null) {
  transaccion = null;
  set({
    pantalla: 'editor',
    project,
    sheetId: project.sheets[0].id,
    selection: [],
    tool: 'seleccionar',
    dirty: false,
    fileName,
    filePath,
    undo: [],
    redo: [],
  });
}

export function proyectoNuevo(modo: Modo) {
  cargarProyecto(newProject(modo), 'Sin título.edz', null);
}

export function marcarGuardado(fileName: string, filePath: string | null) {
  set({ dirty: false, fileName, filePath });
}

export function avisar(aviso: string | null) {
  set({ aviso });
}

let resolverPregunta: ((ok: boolean) => void) | null = null;

/**
 * Pide confirmación con un cuadro propio. Hay navegadores y visores que no
 * muestran window.confirm, así que la app no depende de él.
 */
export function preguntar(texto: string, aceptar = 'Continuar'): Promise<boolean> {
  resolverPregunta?.(false);
  return new Promise((resolve) => {
    resolverPregunta = resolve;
    set({ pregunta: { texto, aceptar } });
  });
}

export function responderPregunta(ok: boolean) {
  const r = resolverPregunta;
  resolverPregunta = null;
  set({ pregunta: null });
  r?.(ok);
}

export function setTool(tool: Tool) {
  set({ tool, selection: tool === 'seleccionar' ? state.selection : [] });
}

/** Elige el tipo de conductor y deja lista la herramienta para trazarlo. */
export function setWireTipo(wireTipo: WireTipo) {
  set({ wireTipo, tool: 'conductor', selection: [] });
}

export function select(ids: string[]) {
  set({ selection: ids });
}

// ---------- hojas ----------

export function setSheet(id: string) {
  set({ sheetId: id, selection: [] });
}

export function addSheet(modo: Modo) {
  const n = state.project.sheets.filter((h) => h.modo === modo).length + 1;
  const hoja = newSheet(modo, n);
  edit((p) => {
    p.sheets.push(hoja);
  });
  set({ sheetId: hoja.id, selection: [] });
}

export function removeSheet(id: string) {
  if (state.project.sheets.length <= 1) return;
  const idx = state.project.sheets.findIndex((h) => h.id === id);
  edit((p) => {
    p.sheets = p.sheets.filter((h) => h.id !== id);
  });
  const resto = state.project.sheets;
  set({ sheetId: resto[Math.max(0, idx - 1)].id, selection: [] });
}

// ---------- símbolos y conductores ----------

/** Siguiente designación libre para un prefijo: Q1, Q2... */
export function nextTag(sheets: Sheet[], prefijo: string): string {
  let max = 0;
  const re = new RegExp(`^${prefijo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  for (const h of sheets)
    for (const i of h.instances) {
      const m = re.exec(i.props.tag ?? '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  return `${prefijo}${max + 1}`;
}

/** Coloca un símbolo centrado en el punto dado y devuelve su id. */
export function placeSymbol(symId: string, centro: Pt): string {
  const def = getSymbol(symId);
  const props = defaultProps(def);
  if (def.prefijo) props.tag = nextTag(state.project.sheets, def.prefijo);
  if (def.id === 'circuito') {
    const usados = currentSheet().instances.filter((i) => i.sym === 'circuito').length;
    props.numero = String(usados + 1);
  }
  const inst: Instance = { id: newId('s'), sym: symId, x: 0, y: 0, rot: 0, props };
  const { w, h } = instSize(inst);
  inst.x = snap(centro.x - w / 2);
  inst.y = snap(centro.y - h / 2);
  edit((_p, sheet) => {
    sheet.instances.push(inst);
  });
  return inst.id;
}

/** Crea un símbolo de tamaño libre (caja o contorno) con la esquina y medidas dadas. */
export function placeBox(symId: string, x: number, y: number, w: number, h: number): string {
  const def = getSymbol(symId);
  const props = { ...defaultProps(def), ...(def.redim ? def.redim.aplicar(w, h) : {}) };
  const inst: Instance = { id: newId('s'), sym: symId, x, y, rot: 0, props };
  edit((_p, sheet) => {
    sheet.instances.push(inst);
  });
  return inst.id;
}

/** Cambia posición y tamaño de un símbolo redimensionable. */
export function resizeInstance(id: string, x: number, y: number, w: number, h: number) {
  edit((_p, sheet) => {
    const i = sheet.instances.find((q) => q.id === id);
    if (!i) return;
    const def = getSymbol(i.sym);
    if (!def.redim) return;
    const antes = { x: i.x, y: i.y, props: { ...i.props } };
    i.x = x;
    i.y = y;
    Object.assign(i.props, def.redim.aplicar(w, h));
    // No se achica más allá de un borne que tiene un conductor unido.
    const bornes = new Set(def.ports(i.props).map((p) => p.id));
    const cortaConductor = sheet.wires.some((c) =>
      [c.a, c.b].some((e) => isPortEnd(e) && e.inst === id && !bornes.has(e.port)),
    );
    if (cortaConductor) Object.assign(i, antes);
  });
}

export function addWire(a: End, b: End, via: Pt[]): string {
  const w: Wire = { id: newId('c'), a, b, via, label: '' };
  if (state.wireTipo !== 'fase') w.tipo = state.wireTipo;
  edit((_p, sheet) => {
    sheet.wires.push(w);
  });
  return w.id;
}

export function deleteSelection() {
  const ids = new Set(state.selection);
  if (ids.size === 0) return;
  edit((_p, sheet) => {
    sheet.instances = sheet.instances.filter((i) => !ids.has(i.id));
    const vivos = new Set(sheet.instances.map((i) => i.id));
    sheet.wires = sheet.wires.filter(
      (w) => !ids.has(w.id) && [w.a, w.b].every((e) => !isPortEnd(e) || vivos.has(e.inst)),
    );
  });
  set({ selection: [] });
}

export function rotateSelection() {
  const ids = new Set(state.selection);
  if (ids.size === 0) return;
  edit((_p, sheet) => {
    for (const i of sheet.instances) if (ids.has(i.id)) i.rot = ((i.rot + 90) % 360) as Rot;
  });
}

export function duplicateSelection() {
  const ids = new Set(state.selection);
  const nuevos: string[] = [];
  if (ids.size === 0) return;
  edit((p, sheet) => {
    const mapa = new Map<string, string>();
    for (const i of sheet.instances.filter((x) => ids.has(x.id))) {
      const def = getSymbol(i.sym);
      const copia: Instance = { ...structuredClone(i), id: newId('s'), x: i.x + 2 * GRID, y: i.y + 2 * GRID };
      if (def.prefijo) copia.props.tag = nextTag(p.sheets, def.prefijo);
      mapa.set(i.id, copia.id);
      sheet.instances.push(copia);
      nuevos.push(copia.id);
    }
    // Se copian los conductores cuyos dos extremos quedaron dentro de la copia.
    for (const w of [...sheet.wires]) {
      const remap = (e: End): End | null =>
        isPortEnd(e) ? (mapa.has(e.inst) ? { inst: mapa.get(e.inst)!, port: e.port } : null) : null;
      const a = remap(w.a);
      const b = remap(w.b);
      if (a && b) {
        const copia: Wire = {
          id: newId('c'),
          a,
          b,
          via: w.via.map((v) => ({ x: v.x + 2 * GRID, y: v.y + 2 * GRID })),
          label: w.label,
        };
        sheet.wires.push(copia);
      }
    }
  });
  set({ selection: nuevos });
}

/** Desplaza la selección respecto de una foto de la hoja tomada al iniciar el arrastre. */
export function moveSelectionFrom(base: Sheet, ids: string[], dx: number, dy: number) {
  const sel = new Set(ids);
  edit((_p, sheet) => {
    for (const i of sheet.instances) {
      if (!sel.has(i.id)) continue;
      const o = base.instances.find((x) => x.id === i.id);
      if (o) {
        i.x = o.x + dx;
        i.y = o.y + dy;
      }
    }
    for (const w of sheet.wires) {
      const o = base.wires.find((x) => x.id === w.id);
      if (!o) continue;
      const fijo = (e: End) => isPortEnd(e) && sel.has(e.inst);
      const libre = (e: End) => !isPortEnd(e);
      // Un conductor acompaña al movimiento si está seleccionado o si sus dos
      // extremos pertenecen a símbolos que se mueven.
      const acompana = sel.has(w.id) || (fijo(o.a) && fijo(o.b));
      if (!acompana) continue;
      w.via = o.via.map((v) => ({ x: v.x + dx, y: v.y + dy }));
      if (sel.has(w.id)) {
        if (libre(o.a)) w.a = { x: (o.a as Pt).x + dx, y: (o.a as Pt).y + dy };
        if (libre(o.b)) w.b = { x: (o.b as Pt).x + dx, y: (o.b as Pt).y + dy };
      }
    }
  });
}

export function setProp(id: string, key: string, value: string) {
  edit((_p, sheet) => {
    const i = sheet.instances.find((x) => x.id === id);
    if (!i) return;
    // Si el cambio hace desaparecer un borne (por ejemplo, quitar la bobina de disparo),
    // el conductor que llegaba a él queda con el extremo fijo en el mismo punto.
    const extremos = sheet.wires.flatMap((w) =>
      (['a', 'b'] as const)
        .filter((k) => isPortEnd(w[k]) && (w[k] as { inst: string }).inst === id)
        .map((k) => ({ w, k, pt: resolveEnd(sheet, w[k]) })),
    );
    i.props[key] = value;
    for (const e of extremos) if (e.pt && !resolveEnd(sheet, e.w[e.k])) e.w[e.k] = e.pt;
  });
}

export function setWireTipoDe(id: string, tipo: WireTipo) {
  edit((_p, sheet) => {
    const w = sheet.wires.find((x) => x.id === id);
    if (!w) return;
    if (tipo === 'fase') delete w.tipo;
    else w.tipo = tipo;
  });
}

export function setWireLabel(id: string, label: string) {
  edit((_p, sheet) => {
    const w = sheet.wires.find((x) => x.id === id);
    if (w) w.label = label;
  });
}

/** Solo para pruebas. */
export function __reset() {
  transaccion = null;
  state = inicial();
  listeners.forEach((l) => l());
}
