import { beforeEach, describe, expect, it } from 'vitest';
import { FORMATS, sheetGeom } from './formats';
import { instBox, instPorts, junctions, routeWire } from './geometry';
import { newProject, parseProject, serializeProject, ArchivoInvalido } from './project';
import {
  __reset,
  addWire,
  currentSheet,
  deleteSelection,
  duplicateSelection,
  getState,
  moveSelectionFrom,
  placeBox,
  placeSymbol,
  redo,
  resizeInstance,
  setProp,
  setWireTipo,
  rotateSelection,
  select,
  undo,
} from './store';
import { SYMBOLS, defaultProps, getSymbol } from '../symbols';
import type { Instance, Sheet } from './types';

const inst = (sym: string, x: number, y: number, rot: Instance['rot'] = 0): Instance => ({
  id: sym + x + y,
  sym,
  x,
  y,
  rot,
  props: defaultProps(getSymbol(sym)),
});

describe('formatos del RIC N°18 (tabla 18.1.1)', () => {
  it('usa los márgenes propios de proyectos eléctricos', () => {
    expect(FORMATS.A0).toMatchObject({ short: 841, long: 1189, marginLeft: 35, marginOther: 10 });
    expect(FORMATS.A4).toMatchObject({ short: 210, long: 297, marginLeft: 30, marginOther: 10 });
    expect(FORMATS['2A0']).toMatchObject({ marginLeft: 35, marginOther: 15 });
  });

  it('calcula la superficie útil de un A3 apaisado', () => {
    const g = sheetGeom('A3', true);
    expect(g).toMatchObject({ w: 420, h: 297 });
    expect(g.frame).toEqual({ x: 30, y: 10, w: 380, h: 277 });
  });
});

describe('biblioteca de símbolos', () => {
  it('no repite identificadores', () => {
    expect(new Set(SYMBOLS.map((s) => s.id)).size).toBe(SYMBOLS.length);
  });

  it('mantiene todos los bornes sobre la grilla de 5 mm en las cuatro rotaciones', () => {
    for (const def of SYMBOLS) {
      for (const rot of [0, 90, 180, 270] as const) {
        const i: Instance = { id: 'x', sym: def.id, x: 100, y: 100, rot, props: defaultProps(def) };
        for (const p of instPorts(i)) {
          expect(p.x % 5, `${def.id} rot ${rot} borne ${p.port} x=${p.x}`).toBe(0);
          expect(p.y % 5, `${def.id} rot ${rot} borne ${p.port} y=${p.y}`).toBe(0);
        }
      }
    }
  });

  it('dibuja cada símbolo sin fallar y declara su origen', () => {
    for (const def of SYMBOLS) {
      expect(def.draw(defaultProps(def), 90)).toContain('<');
      if (def.id !== 'texto') expect(def.origen.length).toBeGreaterThan(3);
    }
  });

  it('abre símbolos desconocidos sin romperse', () => {
    expect(getSymbol('no-existe').nombre).toBe('Símbolo desconocido');
  });
});

describe('geometría', () => {
  it('rota la caja y los bornes alrededor del centro', () => {
    const d = inst('disyuntor', 100, 100, 90); // 10 x 20
    expect(instBox(d)).toEqual({ x: 95, y: 105, w: 20, h: 10 });
    const [a, b] = instPorts(d);
    expect(a).toMatchObject({ x: 115, y: 110 });
    expect(b).toMatchObject({ x: 95, y: 110 });
  });

  it('traza en línea recta, en Z o por los quiebres indicados', () => {
    const sheet: Sheet = { id: 'h', name: '', modo: 'unifilar', format: 'A3', landscape: true, instances: [], wires: [] };
    const w = (a: [number, number], b: [number, number], via: [number, number][] = []) => ({
      id: 'w',
      a: { x: a[0], y: a[1] },
      b: { x: b[0], y: b[1] },
      via: via.map(([x, y]) => ({ x, y })),
      label: '',
    });
    expect(routeWire(sheet, w([10, 10], [10, 50]))).toHaveLength(2);
    expect(routeWire(sheet, w([10, 10], [30, 50]))).toEqual([
      { x: 10, y: 10 },
      { x: 10, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: 50 },
    ]);
    expect(routeWire(sheet, w([10, 10], [30, 50], [[30, 10]]))).toEqual([
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 50 },
    ]);
  });

  it('marca nudos en las barras y en las derivaciones', () => {
    const barra = inst('barra', 100, 100);
    const sheet: Sheet = {
      id: 'h',
      name: '',
      modo: 'unifilar',
      format: 'A3',
      landscape: true,
      instances: [barra],
      wires: [
        { id: 'a', a: { inst: barra.id, port: 'p2' }, b: { x: 110, y: 150 }, via: [], label: '' },
        { id: 'b', a: { x: 110, y: 120 }, b: { x: 140, y: 120 }, via: [], label: '' },
      ],
    };
    const j = junctions(sheet);
    expect(j).toContainEqual({ x: 110, y: 100 });
    expect(j).toContainEqual({ x: 110, y: 120 });
    expect(j).toHaveLength(2);
  });
});

describe('archivo .edz', () => {
  it('guarda y vuelve a abrir un proyecto idéntico', () => {
    const p = newProject();
    p.info.titulo = 'Ñandú: instalación de prueba';
    p.sheets[0].instances.push(inst('transferencia', 50, 50, 180));
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it('rechaza archivos que no son proyectos', () => {
    expect(() => parseProject(new Uint8Array([1, 2, 3]))).toThrow(ArchivoInvalido);
  });
});

describe('edición', () => {
  beforeEach(() => __reset());

  it('numera las designaciones y deshace paso a paso', () => {
    const a = placeSymbol('disyuntor', { x: 100, y: 100 });
    placeSymbol('disyuntor', { x: 150, y: 100 });
    const hoja = currentSheet();
    expect(hoja.instances.map((i) => i.props.tag)).toEqual(['Q1', 'Q2']);
    expect(hoja.instances[0]).toMatchObject({ x: 95, y: 90 });
    select([a]);
    rotateSelection();
    expect(currentSheet().instances[0].rot).toBe(90);
    undo();
    expect(currentSheet().instances[0].rot).toBe(0);
    undo();
    expect(currentSheet().instances).toHaveLength(1);
    redo();
    expect(currentSheet().instances).toHaveLength(2);
  });

  it('elimina los conductores unidos a un símbolo eliminado', () => {
    const a = placeSymbol('disyuntor', { x: 100, y: 100 });
    const b = placeSymbol('diferencial', { x: 100, y: 130 });
    addWire({ inst: a, port: 'b' }, { inst: b, port: 'a' }, []);
    expect(currentSheet().wires).toHaveLength(1);
    select([a]);
    deleteSelection();
    expect(currentSheet().instances).toHaveLength(1);
    expect(currentSheet().wires).toHaveLength(0);
  });

  it('mueve la selección y los conductores siguen unidos a los bornes', () => {
    const a = placeSymbol('disyuntor', { x: 100, y: 100 });
    const b = placeSymbol('diferencial', { x: 100, y: 130 });
    addWire({ inst: a, port: 'b' }, { inst: b, port: 'a' }, []);
    moveSelectionFrom(currentSheet(), [a], 20, 0);
    const hoja = currentSheet();
    const ruta = routeWire(hoja, hoja.wires[0])!;
    expect(ruta[0]).toEqual({ x: 120, y: 110 });
    expect(ruta[ruta.length - 1]).toEqual({ x: 100, y: 120 });
  });

  it('duplica símbolos con sus conductores internos y designaciones nuevas', () => {
    const a = placeSymbol('disyuntor', { x: 100, y: 100 });
    const b = placeSymbol('diferencial', { x: 100, y: 130 });
    addWire({ inst: a, port: 'b' }, { inst: b, port: 'a' }, []);
    select([a, b]);
    duplicateSelection();
    const hoja = currentSheet();
    expect(hoja.instances).toHaveLength(4);
    expect(hoja.wires).toHaveLength(2);
    expect(hoja.instances.map((i) => i.props.tag)).toEqual(['Q1', 'ID1', 'Q2', 'ID2']);
    expect(getState().selection).toHaveLength(2);
  });

  it('traza conductores del tipo elegido y los conserva al guardar', () => {
    const a = placeSymbol('inversor', { x: 100, y: 100 });
    const b = placeSymbol('modulo_fv', { x: 100, y: 140 });
    setWireTipo('cc+');
    addWire({ inst: a, port: 'b' }, { inst: b, port: 'a' }, []);
    setWireTipo('fase');
    addWire({ x: 50, y: 50 }, { x: 50, y: 80 }, []);
    const p = parseProject(serializeProject(getState().project));
    expect(p.sheets[0].wires.map((w) => w.tipo)).toEqual(['cc+', undefined]);
  });

  it('dibuja cajas del tamaño pedido y las redimensiona', () => {
    const id = placeBox('tablero', 50, 40, 95, 65);
    expect(instBox(currentSheet().instances[0])).toEqual({ x: 50, y: 40, w: 95, h: 65 });
    resizeInstance(id, 40, 30, 120, 80);
    expect(instBox(currentSheet().instances[0])).toEqual({ x: 40, y: 30, w: 120, h: 80 });
  });

  it('no achica una barra por debajo de un borne con conductor', () => {
    const barra = placeSymbol('barra', { x: 100, y: 100 }); // 60 mm, bornes p0 a p12
    addWire({ inst: barra, port: 'p10' }, { x: 120, y: 150 }, []);
    const { x, y } = currentSheet().instances[0];
    resizeInstance(barra, x, y, 40, 0);
    expect(currentSheet().instances[0].props.largo).toBe('60');
    resizeInstance(barra, x, y, 100, 0);
    expect(currentSheet().instances[0].props.largo).toBe('100');
    expect(routeWire(currentSheet(), currentSheet().wires[0])).not.toBeNull();
  });

  it('el disyuntor con bobina de disparo gana un borne lateral y lo suelta sin perder el conductor', () => {
    const q = placeSymbol('disyuntor', { x: 100, y: 100 });
    expect(instPorts(currentSheet().instances[0]).map((p) => p.port)).toEqual(['a', 'b']);
    setProp(q, 'disparo', 'Bobina de disparo');
    const lateral = instPorts(currentSheet().instances[0]).find((p) => p.port === 'd');
    expect(lateral).toMatchObject({ x: 95, y: 100 });
    addWire({ inst: q, port: 'd' }, { x: 70, y: 100 }, []);
    setProp(q, 'disparo', 'No');
    expect(currentSheet().wires[0].a).toEqual({ x: 95, y: 100 });
    expect(routeWire(currentSheet(), currentSheet().wires[0])).not.toBeNull();
  });
});
