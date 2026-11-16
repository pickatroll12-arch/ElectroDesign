// Biblioteca de símbolos del modo unifilar.
//
// Origen de cada símbolo, en este orden de preferencia:
//   1. Ejemplo de diagrama unilineal del anexo 18.5 del RIC N°18.
//   2. Tabla de simbología del anexo 18.3 del RIC N°18.
//   3. ANSI/IEEE 315 para lo que el RIC no trae (punto 6.3.10 del RIC N°18).
//
// Todos los dibujos son propios. Cada símbolo se dibuja en milímetros, con el
// origen en su esquina superior izquierda y los bornes sobre la grilla de 5 mm.
// El ancho y el alto son múltiplos de 10 para que los bornes sigan en la grilla
// al rotar.

import type { Pt, Rot } from '../model/types';

export interface PropDef {
  key: string;
  label: string;
  def: string;
  unidad?: string;
  opciones?: string[];
  /** Campo de varias líneas. */
  largo?: boolean;
}

export interface PortDef extends Pt {
  id: string;
}

export type Props = Record<string, string>;

export interface SymbolDef {
  id: string;
  nombre: string;
  categoria: string;
  /** Norma o figura de donde sale el dibujo. Alimenta el cuadro de simbología. */
  origen: string;
  w: number;
  h: number;
  /** Tamaño variable según las propiedades (barras, contornos, textos). */
  size?: (p: Props) => { w: number; h: number };
  ports: (p: Props) => PortDef[];
  /** Devuelve el dibujo como SVG. `rot` permite mantener los textos derechos. */
  draw: (p: Props, rot: Rot) => string;
  props: PropDef[];
  /** Líneas de texto que acompañan al símbolo. */
  etiqueta?: (p: Props) => string[];
  etiquetaPos?: 'derecha' | 'abajo' | 'arriba' | 'ninguna';
  /** Prefijo para numerar automáticamente (Q1, Q2, ...). */
  prefijo?: string;
  /** Dibuja un nudo cuando un conductor llega a este símbolo (barras). */
  junctionOnConnect?: boolean;
  /** Se dibuja detrás del resto y solo se selecciona por su borde. */
  fondo?: boolean;
}

// ---------- utilidades de dibujo ----------

const n = (v: number) => +v.toFixed(3);

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const L = (x1: number, y1: number, x2: number, y2: number, extra = '') =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${extra}/>`;
const C = (cx: number, cy: number, r: number, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${extra}/>`;
const R = (x: number, y: number, w: number, h: number, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${extra}/>`;
const P = (d: string, extra = '') => `<path d="${d}" ${extra}/>`;

export const FONT = 'Helvetica, Arial, sans-serif';

/** Texto centrado en (x, y) que se mantiene derecho aunque el símbolo rote. */
const T = (x: number, y: number, s: string, size: number, rot: Rot, extra = '') =>
  `<text transform="translate(${n(x)} ${n(y)}) rotate(${-rot})" x="0" y="${n(size * 0.35)}" font-size="${size}" ` +
  `font-family="${FONT}" text-anchor="middle" stroke="none" fill="#000" ${extra}>${esc(s)}</text>`;

const FILL = 'fill="#000"';
const DASH = 'stroke-dasharray="1.5 1"';

const tb = (w: number, h: number): PortDef[] => [
  { id: 'a', x: w / 2, y: 0 },
  { id: 'b', x: w / 2, y: h },
];
const top = (w: number): PortDef[] => [{ id: 'a', x: w / 2, y: 0 }];
const bottom = (w: number, h: number): PortDef[] => [{ id: 'b', x: w / 2, y: h }];

const TAG: PropDef = { key: 'tag', label: 'Designación', def: '' };
const MARCA: PropDef = { key: 'marca', label: 'Marca y modelo', def: '' };

const juntar = (...partes: (string | false | undefined)[]) => partes.filter(Boolean) as string[];
const con = (v: string | undefined, unidad: string) => (v ? `${v} ${unidad}` : '');
const polosX = (p: Props, v: string) => (p.polos ? `${p.polos}x${v}` : v);

/** Contacto del disyuntor tal como aparece en el anexo 18.5. */
const contactoRic = (cx: number, y0: number) =>
  C(cx, y0, 0.9) +
  C(cx, y0 + 8, 0.9) +
  P(`M${n(cx + 0.7)} ${n(y0 + 0.6)} Q${n(cx + 4)} ${n(y0 + 4)} ${n(cx + 0.7)} ${n(y0 + 7.4)}`) +
  L(cx + 1.4, y0 + 4, cx + 4, y0 + 4) +
  L(cx + 3.2, y0 + 3, cx + 3.2, y0 + 5);

const tierra = (cx: number, y: number) =>
  L(cx - 3, y, cx + 3, y) + L(cx - 2, y + 1.3, cx + 2, y + 1.3) + L(cx - 1, y + 2.6, cx + 1, y + 2.6);

const PROPS_PROTECCION: PropDef[] = [
  TAG,
  { key: 'polos', label: 'Polos', def: '1', opciones: ['1', '2', '3', '4'] },
  { key: 'in', label: 'Corriente nominal', def: '16', unidad: 'A' },
  { key: 'icu', label: 'Corriente de ruptura', def: '6', unidad: 'kA' },
  { key: 'curva', label: 'Curva de operación', def: 'C', opciones: ['B', 'C', 'D', 'K', 'Z', ''] },
  MARCA,
];

const etiquetaProteccion = (p: Props) =>
  juntar(p.in && `${polosX(p, p.in)} A`, con(p.icu, 'kA'), p.curva && `Curva ${p.curva}`, p.marca);

// ---------- símbolos ----------

const LISTA: SymbolDef[] = [
  // ===== Acometida y medida =====
  {
    id: 'empalme',
    nombre: 'Empalme',
    categoria: 'Acometida y medida',
    origen: 'RIC N°18, anexo 18.5',
    w: 20,
    h: 40,
    ports: () => tb(20, 40),
    draw: (_p, rot) =>
      R(1, 3, 18, 34) +
      L(10, 0, 10, 8) +
      R(7, 8, 6, 7) +
      R(8.5, 8, 3, 1.4) +
      T(10, 12.3, 'M', 2.6, rot) +
      L(10, 15, 10, 19.1) +
      contactoRic(10, 20) +
      L(10, 28.9, 10, 40),
    props: [
      { key: 'tag', label: 'Designación', def: 'EMPALME' },
      { key: 'tipo', label: 'Tipo de empalme', def: '' },
      { key: 'potencia', label: 'Potencia', def: '', unidad: 'kW' },
      { key: 'tension', label: 'Tensión', def: '380', unidad: 'V' },
      { key: 'acometida', label: 'Acometida: tipo, sección y longitud', def: '' },
      { key: 'interruptor', label: 'Interruptor: capacidad y curva', def: '' },
    ],
    etiqueta: (p) =>
      juntar(p.tipo && `Tipo ${p.tipo}`, juntar(con(p.potencia, 'kW'), con(p.tension, 'V')).join(', '), p.acometida, p.interruptor),
  },
  {
    id: 'medidor',
    nombre: 'Medidor',
    categoria: 'Acometida y medida',
    origen: 'RIC N°18, anexo 18.3 (3.34)',
    w: 10,
    h: 10,
    ports: () => tb(10, 10),
    draw: (_p, rot) => L(5, 0, 5, 1.5) + R(1.5, 1.5, 7, 7) + T(5, 5, 'M', 3.4, rot) + L(5, 8.5, 5, 10),
    props: [TAG, { key: 'tipo', label: 'Tipo', def: '' }, MARCA],
    etiqueta: (p) => juntar(p.tipo, p.marca),
    prefijo: 'ME',
  },

  // ===== Protección =====
  {
    id: 'disyuntor',
    nombre: 'Disyuntor termomagnético',
    categoria: 'Protección',
    origen: 'RIC N°18, anexo 18.5',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: () => L(5, 0, 5, 5.1) + contactoRic(5, 6) + L(5, 14.9, 5, 20),
    props: PROPS_PROTECCION,
    etiqueta: etiquetaProteccion,
    prefijo: 'Q',
  },
  {
    id: 'diferencial',
    nombre: 'Protector diferencial',
    categoria: 'Protección',
    origen: 'RIC N°18, anexo 18.5',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: (_p, rot) =>
      L(5, 0, 5, 6) +
      R(1, 6, 8, 8) +
      L(1, 14, 9, 6) +
      T(3, 8.2, 'P', 2.2, rot) +
      T(7, 11.9, 'D', 2.2, rot) +
      L(5, 14, 5, 20),
    props: [
      TAG,
      { key: 'polos', label: 'Polos', def: '2', opciones: ['2', '4'] },
      { key: 'in', label: 'Capacidad nominal', def: '25', unidad: 'A' },
      { key: 'sens', label: 'Corriente diferencial', def: '30', unidad: 'mA' },
      { key: 'tipo', label: 'Tipo de diferencial', def: 'A', opciones: ['AC', 'A', 'F', 'B', 'S'] },
      MARCA,
    ],
    etiqueta: (p) => juntar(p.in && `${polosX(p, p.in)} A`, con(p.sens, 'mA'), p.tipo && `Tipo ${p.tipo}`, p.marca),
    prefijo: 'ID',
  },
  {
    id: 'caja_moldeada',
    nombre: 'Interruptor de caja moldeada',
    categoria: 'Protección',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: () => L(5, 0, 5, 6) + P('M5 6 A4.6 4.6 0 0 1 5 14') + L(5, 14, 5, 20),
    props: [
      TAG,
      { key: 'polos', label: 'Polos', def: '3', opciones: ['2', '3', '4'] },
      { key: 'in', label: 'Corriente nominal', def: '100', unidad: 'A' },
      { key: 'icu', label: 'Corriente de ruptura', def: '25', unidad: 'kA' },
      { key: 'regulacion', label: 'Regulación', def: '' },
      MARCA,
    ],
    etiqueta: (p) => juntar(p.in && `${polosX(p, p.in)} A`, con(p.icu, 'kA'), p.regulacion && `Reg. ${p.regulacion}`, p.marca),
    prefijo: 'Q',
  },
  {
    id: 'interruptor_potencia',
    nombre: 'Interruptor de potencia (52)',
    categoria: 'Protección',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: (_p, rot) => L(5, 0, 5, 6) + R(1, 6, 8, 8) + T(5, 10, '52', 3.2, rot) + L(5, 14, 5, 20),
    props: [
      TAG,
      { key: 'un', label: 'Tensión nominal', def: '15', unidad: 'kV' },
      { key: 'in', label: 'Corriente nominal', def: '630', unidad: 'A' },
      { key: 'icu', label: 'Corriente de ruptura', def: '25', unidad: 'kA' },
      { key: 'medio', label: 'Medio de corte', def: 'Vacío', opciones: ['Vacío', 'SF6', 'Aire'] },
      MARCA,
    ],
    etiqueta: (p) => juntar(con(p.un, 'kV'), con(p.in, 'A'), con(p.icu, 'kA'), p.medio, p.marca),
    prefijo: 'Q',
  },
  {
    id: 'fusible',
    nombre: 'Fusible',
    categoria: 'Protección',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: () => L(5, 0, 5, 20) + R(3.4, 5.5, 3.2, 9),
    props: [
      TAG,
      { key: 'in', label: 'Corriente nominal', def: '32', unidad: 'A' },
      { key: 'tipo', label: 'Tipo', def: 'gG', opciones: ['gG', 'aM', 'gPV', 'gR', 'aR', 'K', 'T', ''] },
      { key: 'tamano', label: 'Tamaño', def: '' },
      MARCA,
    ],
    etiqueta: (p) => juntar(juntar(con(p.in, 'A'), p.tipo).join(' '), p.tamano, p.marca),
    prefijo: 'F',
  },
  {
    id: 'rele_termico',
    nombre: 'Relé térmico de sobrecarga',
    categoria: 'Protección',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: () => P('M5 0 V6 a2 2 0 0 1 0 4 a2 2 0 0 0 0 4 V20'),
    props: [TAG, { key: 'rango', label: 'Rango de ajuste', def: '', unidad: 'A' }, MARCA],
    etiqueta: (p) => juntar(con(p.rango, 'A'), p.marca),
    prefijo: 'OL',
  },
  {
    id: 'sobretension',
    nombre: 'Protector de sobretensión',
    categoria: 'Protección',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 20,
    ports: () => top(10),
    draw: () =>
      L(5, 0, 5, 4) +
      R(2.5, 4, 5, 9) +
      L(5, 4, 5, 8.2) +
      P('M3.6 7.2 L5 10 L6.4 7.2 Z', FILL) +
      L(5, 13, 5, 15.5) +
      tierra(5, 15.5),
    props: [
      TAG,
      { key: 'clase', label: 'Tipo', def: '2', opciones: ['1', '1+2', '2', '3'] },
      { key: 'uc', label: 'Tensión máxima', def: '275', unidad: 'V' },
      { key: 'imax', label: 'Corriente de descarga', def: '40', unidad: 'kA' },
      MARCA,
    ],
    etiqueta: (p) => juntar(p.clase && `Tipo ${p.clase}`, con(p.uc, 'V'), con(p.imax, 'kA'), p.marca),
    prefijo: 'SPD',
  },

  // ===== Maniobra y control =====
  {
    id: 'seccionador',
    nombre: 'Seccionador',
    categoria: 'Maniobra y control',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: () => L(5, 0, 5, 6) + L(3.6, 6, 6.4, 6) + L(5, 14, 8.6, 6.6) + L(5, 14, 5, 20),
    props: [
      TAG,
      { key: 'polos', label: 'Polos', def: '3', opciones: ['1', '2', '3', '4'] },
      { key: 'in', label: 'Corriente nominal', def: '100', unidad: 'A' },
      { key: 'carga', label: 'Corte bajo carga', def: 'Sí', opciones: ['Sí', 'No'] },
      MARCA,
    ],
    etiqueta: (p) => juntar(p.in && `${polosX(p, p.in)} A`, p.carga === 'Sí' && 'Bajo carga', p.marca),
    prefijo: 'S',
  },
  {
    id: 'seccionador_fusible',
    nombre: 'Seccionador fusible',
    categoria: 'Maniobra y control',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 30,
    ports: () => tb(10, 30),
    draw: () =>
      L(5, 0, 5, 5) + L(3.6, 5, 6.4, 5) + L(5, 13, 8.6, 5.6) + L(5, 13, 5, 30) + R(3.4, 16, 3.2, 9),
    props: [
      TAG,
      { key: 'un', label: 'Tensión nominal', def: '', unidad: 'kV' },
      { key: 'in', label: 'Corriente de la base', def: '100', unidad: 'A' },
      { key: 'fusible', label: 'Fusible', def: '', unidad: 'A' },
      MARCA,
    ],
    etiqueta: (p) => juntar(con(p.un, 'kV'), con(p.in, 'A'), p.fusible && `Fusible ${p.fusible} A`, p.marca),
    prefijo: 'F',
  },
  {
    id: 'contactor',
    nombre: 'Contactor',
    categoria: 'Maniobra y control',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 20,
    ports: () => tb(10, 20),
    draw: () => L(5, 0, 5, 8.5) + L(2, 8.5, 8, 8.5) + L(2, 11.5, 8, 11.5) + L(5, 11.5, 5, 20),
    props: [
      TAG,
      { key: 'in', label: 'Corriente (AC-3)', def: '18', unidad: 'A' },
      { key: 'bobina', label: 'Tensión de bobina', def: '220', unidad: 'V' },
      MARCA,
    ],
    etiqueta: (p) => juntar(p.in && `${p.in} A AC-3`, p.bobina && `Bobina ${p.bobina} V`, p.marca),
    prefijo: 'KM',
  },
  {
    id: 'transferencia',
    nombre: 'Transferencia automática (ATS)',
    categoria: 'Maniobra y control',
    origen: 'ANSI/IEEE 315',
    w: 20,
    h: 20,
    ports: () => [
      { id: 'n', x: 5, y: 0 },
      { id: 'r', x: 15, y: 0 },
      { id: 'c', x: 10, y: 20 },
    ],
    draw: (_p, rot) =>
      R(1, 2.5, 18, 15, DASH) +
      L(5, 0, 5, 5.6) +
      L(15, 0, 15, 5.6) +
      C(5, 6.5, 0.9) +
      C(15, 6.5, 0.9) +
      C(10, 14, 0.9, FILL) +
      L(10, 14, 5.6, 7.3) +
      L(10, 14, 10, 20) +
      T(2.8, 5, 'N', 2, rot) +
      T(17.2, 5, 'R', 2, rot),
    props: [
      { key: 'tag', label: 'Designación', def: 'ATS' },
      { key: 'polos', label: 'Polos', def: '4', opciones: ['2', '3', '4'] },
      { key: 'in', label: 'Corriente nominal', def: '63', unidad: 'A' },
      { key: 'clase', label: 'Clase', def: 'PC', opciones: ['PC', 'CB'] },
      { key: 'transicion', label: 'Transición', def: 'Abierta', opciones: ['Abierta', 'Cerrada'] },
      MARCA,
    ],
    etiqueta: (p) =>
      juntar(p.in && `${polosX(p, p.in)} A`, p.clase && `Clase ${p.clase}`, p.transicion && `Transición ${p.transicion.toLowerCase()}`, p.marca),
  },

  // ===== Distribución =====
  {
    id: 'barra',
    nombre: 'Barra de distribución',
    categoria: 'Distribución',
    origen: 'RIC N°18, anexo 18.5',
    w: 60,
    h: 0,
    size: (p) => ({ w: largoBarra(p), h: 0 }),
    ports: (p) => {
      const largo = largoBarra(p);
      const out: PortDef[] = [];
      for (let x = 0; x <= largo; x += 5) out.push({ id: `p${x / 5}`, x, y: 0 });
      return out;
    },
    draw: (p) => L(0, 0, largoBarra(p), 0, 'stroke-width="1.2" stroke-linecap="butt"'),
    props: [
      { key: 'tag', label: 'Designación', def: '' },
      { key: 'largo', label: 'Largo en el plano', def: '60', unidad: 'mm' },
      { key: 'seccion', label: 'Sección de la barra', def: '' },
      { key: 'capacidad', label: 'Capacidad de transporte', def: '', unidad: 'A' },
    ],
    etiqueta: (p) => juntar(juntar(p.seccion, con(p.capacidad, 'A')).join(' - ')),
    etiquetaPos: 'arriba',
    junctionOnConnect: true,
  },
  {
    id: 'tablero',
    nombre: 'Contorno de tablero',
    categoria: 'Distribución',
    origen: 'RIC N°18, anexo 18.5',
    w: 80,
    h: 60,
    size: (p) => ({ w: medida(p.ancho, 80), h: medida(p.alto, 60) }),
    ports: () => [],
    draw: (p) => {
      const w = medida(p.ancho, 80);
      const h = medida(p.alto, 60);
      const lineas = juntar(p.tag, p.descripcion, p.envolvente);
      return (
        R(0, 0, w, h, 'stroke-dasharray="6 1.5 1 1.5" stroke-width="0.25"') +
        lineas
          .map(
            (s, i) =>
              `<text x="2" y="${n(4.2 + i * 3.2)}" font-size="${i === 0 ? 2.8 : 2.2}" font-family="${FONT}" ` +
              `${i === 0 ? 'font-weight="bold"' : ''} stroke="none" fill="#000">${esc(s)}</text>`,
          )
          .join('')
      );
    },
    props: [
      { key: 'tag', label: 'Designación', def: 'T.D.A.' },
      { key: 'descripcion', label: 'Descripción', def: 'Tablero de distribución de alumbrado' },
      { key: 'envolvente', label: 'Material, IP y dimensiones', def: '' },
      { key: 'ancho', label: 'Ancho en el plano', def: '80', unidad: 'mm' },
      { key: 'alto', label: 'Alto en el plano', def: '60', unidad: 'mm' },
    ],
    etiquetaPos: 'ninguna',
    fondo: true,
  },
  {
    id: 'circuito',
    nombre: 'Circuito',
    categoria: 'Distribución',
    origen: 'RIC N°18, anexo 18.5',
    w: 10,
    h: 10,
    ports: () => top(10),
    draw: (p, rot) => L(5, 0, 5, 1.5) + C(5, 5.5, 4) + T(5, 5.5, p.numero ?? '', 3.4, rot),
    props: [
      { key: 'numero', label: 'Número de circuito', def: '1' },
      { key: 'destino', label: 'Destino', def: '' },
      { key: 'potencia', label: 'Potencia', def: '', unidad: 'W' },
    ],
    etiqueta: (p) => juntar(p.destino, con(p.potencia, 'W')),
    etiquetaPos: 'abajo',
  },
  {
    id: 'carga',
    nombre: 'Carga o salida',
    categoria: 'Distribución',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 10,
    ports: () => top(10),
    draw: () => L(5, 0, 5, 6.5) + P('M3.2 6 L6.8 6 L5 9.8 Z', FILL),
    props: [TAG, { key: 'destino', label: 'Destino', def: '' }, { key: 'potencia', label: 'Potencia', def: '', unidad: 'kW' }],
    etiqueta: (p) => juntar(p.destino, con(p.potencia, 'kW')),
    etiquetaPos: 'abajo',
  },
  {
    id: 'tierra_proteccion',
    nombre: 'Tierra de protección',
    categoria: 'Distribución',
    origen: 'RIC N°18, anexo 18.3 (1.3)',
    w: 10,
    h: 10,
    ports: () => top(10),
    draw: () => L(5, 0, 5, 4.4) + tierra(5, 4.4) + C(5, 5.6, 3.9),
    props: [
      { key: 'tag', label: 'Designación', def: 'T.P.' },
      { key: 'resistencia', label: 'Resistencia medida', def: '', unidad: 'Ω' },
      { key: 'conductor', label: 'Conductor', def: '' },
      { key: 'metodo', label: 'Método e instrumento de medición', def: '' },
    ],
    etiqueta: (p) => juntar(con(p.resistencia, 'ohm'), p.conductor, p.metodo),
    etiquetaPos: 'abajo',
  },
  {
    id: 'tierra_servicio',
    nombre: 'Tierra de servicio',
    categoria: 'Distribución',
    origen: 'RIC N°18, anexo 18.3 (1.4)',
    w: 10,
    h: 10,
    ports: () => top(10),
    draw: () => L(5, 0, 5, 4.4) + tierra(5, 4.4),
    props: [
      { key: 'tag', label: 'Designación', def: 'T.S.' },
      { key: 'resistencia', label: 'Resistencia medida', def: '', unidad: 'Ω' },
      { key: 'conductor', label: 'Conductor', def: '' },
      { key: 'metodo', label: 'Método e instrumento de medición', def: '' },
    ],
    etiqueta: (p) => juntar(con(p.resistencia, 'ohm'), p.conductor, p.metodo),
    etiquetaPos: 'abajo',
  },

  // ===== Máquinas y equipos =====
  {
    id: 'transformador',
    nombre: 'Transformador',
    categoria: 'Máquinas y equipos',
    origen: 'ANSI/IEEE 315',
    w: 20,
    h: 20,
    ports: () => tb(20, 20),
    draw: () =>
      L(10, 0, 10, 6.5) +
      P('M4 8.5 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0') +
      P('M4 11.5 a2 2 0 0 0 4 0 a2 2 0 0 0 4 0 a2 2 0 0 0 4 0') +
      L(10, 13.5, 10, 20),
    props: [
      TAG,
      { key: 'potencia', label: 'Potencia', def: '500', unidad: 'kVA' },
      { key: 'primario', label: 'Tensión primaria', def: '13,2', unidad: 'kV' },
      { key: 'secundario', label: 'Tensión secundaria', def: '0,4', unidad: 'kV' },
      { key: 'conexion', label: 'Grupo de conexión', def: 'Dyn1' },
      { key: 'impedancia', label: 'Impedancia', def: '4', unidad: '%' },
      { key: 'aislacion', label: 'Aislación', def: 'Aceite', opciones: ['Aceite', 'Seco'] },
      MARCA,
    ],
    etiqueta: (p) =>
      juntar(
        con(p.potencia, 'kVA'),
        p.primario && p.secundario && `${p.primario}/${p.secundario} kV`,
        juntar(p.conexion, p.impedancia && `Z=${p.impedancia} %`).join(', '),
        p.aislacion,
        p.marca,
      ),
    prefijo: 'T',
  },
  {
    id: 'motor',
    nombre: 'Motor de inducción',
    categoria: 'Máquinas y equipos',
    origen: 'RIC N°18, anexo 18.3 (3.36)',
    w: 10,
    h: 10,
    ports: () => top(10),
    draw: (_p, rot) =>
      L(5, 0, 5, 1.2) + C(5, 5.6, 4.4) + T(5, 4.7, 'M', 3.2, rot) + T(5, 7.6, '~', 3, rot),
    props: [
      TAG,
      { key: 'potencia', label: 'Potencia', def: '5,5', unidad: 'kW' },
      { key: 'tension', label: 'Tensión', def: '380', unidad: 'V' },
      { key: 'in', label: 'Corriente nominal', def: '', unidad: 'A' },
      { key: 'partida', label: 'Partida', def: 'Directa', opciones: ['Directa', 'Estrella-triángulo', 'Partidor suave', 'Variador'] },
    ],
    etiqueta: (p) => juntar(con(p.potencia, 'kW'), juntar(con(p.tension, 'V'), con(p.in, 'A')).join(', '), p.partida),
    etiquetaPos: 'abajo',
    prefijo: 'M',
  },
  {
    id: 'generador',
    nombre: 'Generador',
    categoria: 'Máquinas y equipos',
    origen: 'RIC N°18, anexo 18.3 (3.21)',
    w: 10,
    h: 10,
    ports: () => bottom(10, 10),
    draw: (_p, rot) => C(5, 4.4, 4.4) + T(5, 4.4, 'G', 3.6, rot) + L(5, 8.8, 5, 10),
    props: [
      TAG,
      { key: 'potencia', label: 'Potencia', def: '100', unidad: 'kVA' },
      { key: 'tension', label: 'Tensión', def: '380', unidad: 'V' },
      { key: 'servicio', label: 'Servicio', def: 'Emergencia', opciones: ['Emergencia', 'Prime', 'Continuo'] },
      MARCA,
    ],
    etiqueta: (p) => juntar(con(p.potencia, 'kVA'), con(p.tension, 'V'), p.servicio, p.marca),
    prefijo: 'G',
  },
  {
    id: 'variador',
    nombre: 'Variador de frecuencia',
    categoria: 'Máquinas y equipos',
    origen: 'ANSI/IEEE 315',
    w: 20,
    h: 20,
    ports: () => tb(20, 20),
    draw: (_p, rot) =>
      L(10, 0, 10, 4) + R(3, 4, 14, 12) + L(3, 16, 17, 4) + T(6.2, 7.2, '~', 3, rot) + T(13.6, 13, 'f', 3, rot) + L(10, 16, 10, 20),
    props: [
      TAG,
      { key: 'potencia', label: 'Potencia', def: '7,5', unidad: 'kW' },
      { key: 'tension', label: 'Tensión', def: '380', unidad: 'V' },
      MARCA,
    ],
    etiqueta: (p) => juntar('VDF', con(p.potencia, 'kW'), con(p.tension, 'V'), p.marca),
    prefijo: 'VDF',
  },
  {
    id: 'condensador',
    nombre: 'Banco de condensadores',
    categoria: 'Máquinas y equipos',
    origen: 'ANSI/IEEE 315',
    w: 10,
    h: 10,
    ports: () => top(10),
    draw: () => L(5, 0, 5, 4) + L(2, 4, 8, 4) + P('M2 7.4 Q5 4.6 8 7.4') + L(5, 6, 5, 10),
    props: [
      TAG,
      { key: 'potencia', label: 'Potencia reactiva', def: '25', unidad: 'kVAr' },
      { key: 'tension', label: 'Tensión', def: '400', unidad: 'V' },
      { key: 'pasos', label: 'Pasos', def: '' },
    ],
    etiqueta: (p) => juntar(con(p.potencia, 'kVAr'), con(p.tension, 'V'), p.pasos && `${p.pasos} pasos`),
    etiquetaPos: 'abajo',
    prefijo: 'C',
  },

  // ===== Fotovoltaica y respaldo =====
  {
    id: 'modulo_fv',
    nombre: 'Generador fotovoltaico',
    categoria: 'Fotovoltaica y respaldo',
    origen: 'IEC 60617 (el RIC no lo define)',
    w: 20,
    h: 10,
    ports: () => bottom(20, 10),
    draw: () => R(3, 0.5, 14, 8) + L(3, 0.5, 7.5, 4.5) + L(3, 8.5, 7.5, 4.5) + L(10, 8.5, 10, 10),
    props: [
      TAG,
      { key: 'modulos', label: 'Módulos por string', def: '10' },
      { key: 'strings', label: 'Strings en paralelo', def: '1' },
      { key: 'wp', label: 'Potencia por módulo', def: '550', unidad: 'Wp' },
      { key: 'voc', label: 'Voc del string', def: '', unidad: 'V' },
      { key: 'isc', label: 'Isc del string', def: '', unidad: 'A' },
      MARCA,
    ],
    etiqueta: (p) =>
      juntar(
        p.modulos && p.wp && `${p.strings && p.strings !== '1' ? `${p.strings}x` : ''}${p.modulos}x${p.wp} Wp`,
        juntar(p.voc && `Voc ${p.voc} V`, p.isc && `Isc ${p.isc} A`).join(', '),
        p.marca,
      ),
    prefijo: 'FV',
  },
  {
    id: 'inversor',
    nombre: 'Inversor',
    categoria: 'Fotovoltaica y respaldo',
    origen: 'IEC 60617 (el RIC no lo define)',
    w: 20,
    h: 20,
    ports: () => tb(20, 20),
    draw: (_p, rot) =>
      L(10, 0, 10, 4) +
      R(3, 4, 14, 12) +
      L(3, 16, 17, 4) +
      L(4.6, 6.6, 8, 6.6) +
      L(4.6, 7.8, 8, 7.8, 'stroke-dasharray="0.8 0.5"') +
      T(13.6, 12.8, '~', 3.4, rot) +
      L(10, 16, 10, 20),
    props: [
      TAG,
      { key: 'potencia', label: 'Potencia nominal', def: '5', unidad: 'kW' },
      { key: 'tipo', label: 'Tipo', def: 'Conectado a red', opciones: ['Conectado a red', 'Híbrido', 'Aislado'] },
      { key: 'vdc', label: 'Tensión máxima CC', def: '', unidad: 'V' },
      { key: 'vac', label: 'Tensión de salida', def: '220', unidad: 'V' },
      MARCA,
    ],
    etiqueta: (p) => juntar(con(p.potencia, 'kW'), p.tipo, juntar(p.vdc && `${p.vdc} Vcc`, p.vac && `${p.vac} Vca`).join(' / '), p.marca),
    prefijo: 'INV',
  },
  {
    id: 'bateria',
    nombre: 'Batería',
    categoria: 'Fotovoltaica y respaldo',
    origen: 'RIC N°18, anexo 18.3 (3.4)',
    w: 10,
    h: 10,
    ports: () => tb(10, 10),
    draw: () =>
      L(5, 0, 5, 3.2) +
      L(1.5, 3.2, 8.5, 3.2) +
      L(3.4, 4.4, 6.6, 4.4, 'stroke-width="0.8"') +
      L(1.5, 5.6, 8.5, 5.6) +
      L(3.4, 6.8, 6.6, 6.8, 'stroke-width="0.8"') +
      L(5, 6.8, 5, 10),
    props: [
      TAG,
      { key: 'tension', label: 'Tensión', def: '48', unidad: 'V' },
      { key: 'capacidad', label: 'Capacidad', def: '100', unidad: 'Ah' },
      { key: 'quimica', label: 'Tecnología', def: 'LiFePO4', opciones: ['LiFePO4', 'Plomo ácido', 'AGM', 'Gel', 'Ni-Cd'] },
      MARCA,
    ],
    etiqueta: (p) => juntar(juntar(con(p.tension, 'V'), con(p.capacidad, 'Ah')).join(' '), p.quimica, p.marca),
    prefijo: 'BAT',
  },
  {
    id: 'ups',
    nombre: 'UPS',
    categoria: 'Fotovoltaica y respaldo',
    origen: 'ANSI/IEEE 315',
    w: 20,
    h: 20,
    ports: () => tb(20, 20),
    draw: (_p, rot) => L(10, 0, 10, 4) + R(3, 4, 14, 12) + T(10, 10, 'UPS', 3.6, rot) + L(10, 16, 10, 20),
    props: [
      TAG,
      { key: 'potencia', label: 'Potencia', def: '10', unidad: 'kVA' },
      { key: 'topologia', label: 'Topología', def: 'Doble conversión', opciones: ['Doble conversión', 'Línea interactiva', 'Standby'] },
      { key: 'autonomia', label: 'Autonomía', def: '', unidad: 'min' },
      MARCA,
    ],
    etiqueta: (p) => juntar(con(p.potencia, 'kVA'), p.topologia, p.autonomia && `Autonomía ${p.autonomia} min`, p.marca),
    prefijo: 'UPS',
  },

  // ===== Anotación =====
  {
    id: 'texto',
    nombre: 'Texto',
    categoria: 'Anotación',
    origen: '',
    w: 30,
    h: 5,
    size: (p) => {
      const alto = medida(p.alto, 3);
      const lineas = (p.texto || ' ').split('\n');
      const ancho = Math.max(...lineas.map((l) => l.length)) * alto * 0.56;
      return { w: Math.max(5, ancho), h: Math.max(alto * 1.3 * lineas.length, alto) };
    },
    ports: () => [],
    draw: (p) => {
      const alto = medida(p.alto, 3);
      return (p.texto || '')
        .split('\n')
        .map(
          (l, i) =>
            `<text x="0" y="${n(alto * (i * 1.3 + 0.95))}" font-size="${alto}" font-family="${FONT}" stroke="none" fill="#000">${esc(l)}</text>`,
        )
        .join('');
    },
    props: [
      { key: 'texto', label: 'Texto', def: 'Texto', largo: true },
      { key: 'alto', label: 'Alto de letra', def: '3', unidad: 'mm' },
    ],
    etiquetaPos: 'ninguna',
  },
];

function medida(v: string | undefined, def: number): number {
  const x = parseFloat((v ?? '').replace(',', '.'));
  return Number.isFinite(x) && x > 0 ? x : def;
}

/** El largo de una barra se ajusta a múltiplos de 10 mm para que rote sobre la grilla. */
function largoBarra(p: Props): number {
  return Math.min(1000, Math.max(10, Math.round(medida(p.largo, 60) / 10) * 10));
}

const POR_ID = new Map(LISTA.map((s) => [s.id, s]));

const DESCONOCIDO: SymbolDef = {
  id: '?',
  nombre: 'Símbolo desconocido',
  categoria: '',
  origen: '',
  w: 10,
  h: 10,
  ports: () => [],
  draw: (_p, rot) => R(0.5, 0.5, 9, 9, DASH) + T(5, 5, '?', 5, rot),
  props: [],
  etiquetaPos: 'ninguna',
};

/** Nunca falla: un archivo con un símbolo de una versión más nueva se abre igual. */
export function getSymbol(id: string): SymbolDef {
  return POR_ID.get(id) ?? DESCONOCIDO;
}

export const SYMBOLS: readonly SymbolDef[] = LISTA;

export const CATEGORIAS: string[] = [...new Set(LISTA.map((s) => s.categoria))];

export function defaultProps(def: SymbolDef): Props {
  return Object.fromEntries(def.props.map((p) => [p.key, p.def]));
}
