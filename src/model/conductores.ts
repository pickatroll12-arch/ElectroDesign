// Tipos de conductor y cómo se dibuja cada uno.
// En los diagramas tipo de la SEC la tierra de protección y el neutro van con
// línea de trazos, y los polos de corriente continua en rojo y azul.

export type WireTipo = 'fase' | 'neutro' | 'tierra' | 'cc+' | 'cc-';

export interface TipoConductor {
  id: WireTipo;
  nombre: string;
  color: string;
  /** Patrón de trazos en mm; vacío es línea continua. */
  trazos: string;
}

export const TIPOS_CONDUCTOR: TipoConductor[] = [
  { id: 'fase', nombre: 'Fase', color: '#000000', trazos: '' },
  { id: 'neutro', nombre: 'Neutro', color: '#000000', trazos: '3 1.5' },
  { id: 'tierra', nombre: 'Tierra de protección', color: '#0a7d32', trazos: '5 1.2 0.8 1.2' },
  { id: 'cc+', nombre: 'Corriente continua (+)', color: '#d01919', trazos: '' },
  { id: 'cc-', nombre: 'Corriente continua (-)', color: '#1a56c4', trazos: '' },
];

const POR_ID = new Map(TIPOS_CONDUCTOR.map((t) => [t.id, t]));

export function tipoConductor(id: string | undefined): TipoConductor {
  return POR_ID.get(id as WireTipo) ?? TIPOS_CONDUCTOR[0];
}

export const esWireTipo = (v: unknown): v is WireTipo => typeof v === 'string' && POR_ID.has(v as WireTipo);
