import type { FormatId } from './types';

/**
 * Formatos y márgenes de la tabla N°18.1.1 del RIC N°18.
 * Los márgenes son propios de proyectos eléctricos, no los de la NCh 13.Of 93.
 */
export interface FormatDef {
  id: FormatId;
  /** Lado corto y lado largo en mm. */
  short: number;
  long: number;
  marginLeft: number;
  marginOther: number;
}

export const FORMATS: Record<FormatId, FormatDef> = {
  '4A0': { id: '4A0', short: 1682, long: 2378, marginLeft: 35, marginOther: 15 },
  '2A0': { id: '2A0', short: 1189, long: 1682, marginLeft: 35, marginOther: 15 },
  A0: { id: 'A0', short: 841, long: 1189, marginLeft: 35, marginOther: 10 },
  A1: { id: 'A1', short: 594, long: 841, marginLeft: 30, marginOther: 10 },
  A2: { id: 'A2', short: 420, long: 594, marginLeft: 30, marginOther: 10 },
  A3: { id: 'A3', short: 297, long: 420, marginLeft: 30, marginOther: 10 },
  A4: { id: 'A4', short: 210, long: 297, marginLeft: 30, marginOther: 10 },
};

export const FORMAT_ORDER: FormatId[] = ['A4', 'A3', 'A2', 'A1', 'A0', '2A0', '4A0'];

export interface SheetGeom {
  w: number;
  h: number;
  /** Rectángulo útil de dibujo, dentro de los márgenes. */
  frame: { x: number; y: number; w: number; h: number };
}

export function sheetGeom(format: FormatId, landscape: boolean): SheetGeom {
  const f = FORMATS[format];
  const w = landscape ? f.long : f.short;
  const h = landscape ? f.short : f.long;
  return {
    w,
    h,
    frame: {
      x: f.marginLeft,
      y: f.marginOther,
      w: w - f.marginLeft - f.marginOther,
      h: h - 2 * f.marginOther,
    },
  };
}
