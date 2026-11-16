// Modelo de datos del proyecto. Todas las medidas están en milímetros de papel.

export interface Pt {
  x: number;
  y: number;
}

export type Rot = 0 | 90 | 180 | 270;

/** Un símbolo colocado en una hoja. (x, y) es la esquina superior izquierda sin rotar. */
export interface Instance {
  id: string;
  sym: string;
  x: number;
  y: number;
  rot: Rot;
  props: Record<string, string>;
}

/** Extremo de un conductor: unido a un borne de un símbolo, o libre en un punto. */
export type End = { inst: string; port: string } | Pt;

export interface Wire {
  id: string;
  a: End;
  b: End;
  /** Puntos intermedios fijados por el usuario. */
  via: Pt[];
  /** Texto del tramo: sección, cantidad, canalización (RIC N°18, 6.3.15.2). */
  label: string;
}

export type FormatId = '4A0' | '2A0' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type Modo = 'unifilar' | 'multifilar' | 'tablero3d';

export interface Sheet {
  id: string;
  name: string;
  modo: Modo;
  format: FormatId;
  landscape: boolean;
  instances: Instance[];
  wires: Wire[];
}

/** Datos del rotulado, figura 18.2.2 del RIC N°18. */
export interface ProjectInfo {
  titulo: string;
  comuna: string;
  calle: string;
  escala: string;
  fecha: string;
  otros: string;
  propietario: string;
  rutPropietario: string;
  instalador: string;
  licencia: string;
  domicilio: string;
  telefono: string;
}

export type Norma = 'SEC-RIC' | 'NFPA';

export interface Project {
  app: 'ElectroDesign';
  /** Versión del formato de archivo. */
  formato: 1;
  norma: Norma;
  info: ProjectInfo;
  sheets: Sheet[];
}

export const isPortEnd = (e: End): e is { inst: string; port: string } => 'inst' in e;
