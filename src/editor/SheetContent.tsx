// Dibujo completo de una hoja: marco, rotulado, conductores y símbolos.
// Es un componente puro: lo usan el lienzo y la exportación a PDF/SVG, así que
// lo que se ve en pantalla es exactamente lo que se imprime.
// Todo el estilo va en atributos SVG (no en CSS) para que la exportación lo conserve.

import type { Instance, Project, ProjectInfo, Sheet } from '../model/types';
import { sheetGeom } from '../model/formats';
import { instBox, instSize, junctions, routeWire } from '../model/geometry';
import { FONT, getSymbol } from '../symbols';

const TRAZO = 0.35;

interface Props {
  project: Project;
  sheet: Sheet;
  /** Muestra la grilla (solo en pantalla). */
  grid?: boolean;
}

export function SheetContent({ project, sheet, grid }: Props) {
  const g = sheetGeom(sheet.format, sheet.landscape);
  const indice = project.sheets.findIndex((h) => h.id === sheet.id);
  const fondo = sheet.instances.filter((i) => getSymbol(i.sym).fondo);
  const frente = sheet.instances.filter((i) => !getSymbol(i.sym).fondo);
  return (
    <g id="hoja">
      <rect x={0} y={0} width={g.w} height={g.h} fill="#ffffff" stroke="none" />
      {grid && (
        <rect data-ui="1" x={g.frame.x} y={g.frame.y} width={g.frame.w} height={g.frame.h} fill="url(#grilla)" pointerEvents="none" />
      )}
      <rect x={g.frame.x} y={g.frame.y} width={g.frame.w} height={g.frame.h} fill="none" stroke="#000" strokeWidth={0.5} />
      <Rotulado info={project.info} frame={g.frame} lamina={indice + 1} total={project.sheets.length} />
      {fondo.map((i) => (
        <InstanceView key={i.id} inst={i} />
      ))}
      {sheet.wires.map((w) => {
        const pts = routeWire(sheet, w);
        if (!pts) return null;
        const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
        return (
          <g key={w.id} data-id={w.id}>
            <path data-ui="1" d={d} fill="none" stroke="transparent" strokeWidth={3} />
            <path d={d} fill="none" stroke="#000" strokeWidth={TRAZO} strokeLinejoin="round" />
            {w.label && <WireLabel pts={pts} label={w.label} />}
          </g>
        );
      })}
      {frente.map((i) => (
        <InstanceView key={i.id} inst={i} />
      ))}
      {junctions(sheet).map((p) => (
        <circle key={`${p.x},${p.y}`} cx={p.x} cy={p.y} r={0.8} fill="#000" stroke="none" pointerEvents="none" />
      ))}
    </g>
  );
}

function InstanceView({ inst }: { inst: Instance }) {
  const def = getSymbol(inst.sym);
  const { w, h } = instSize(inst);
  return (
    <g data-id={inst.id}>
      <g
        transform={`translate(${inst.x} ${inst.y}) rotate(${inst.rot} ${w / 2} ${h / 2})`}
        fill="none"
        stroke="#000"
        strokeWidth={TRAZO}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {def.fondo ? (
          <rect data-ui="1" x={0} y={0} width={w} height={h} fill="none" stroke="transparent" strokeWidth={3} pointerEvents="stroke" />
        ) : (
          <rect data-ui="1" x={-1} y={h === 0 ? -2 : -1} width={w + 2} height={h === 0 ? 4 : h + 2} fill="transparent" stroke="none" />
        )}
        <g dangerouslySetInnerHTML={{ __html: def.draw(inst.props, inst.rot) }} />
      </g>
      <Etiqueta inst={inst} />
    </g>
  );
}

function Etiqueta({ inst }: { inst: Instance }) {
  const def = getSymbol(inst.sym);
  const pos = def.etiquetaPos ?? 'derecha';
  if (pos === 'ninguna') return null;
  const tag = inst.props.tag?.trim();
  const lineas = [...(tag ? [tag] : []), ...(def.etiqueta ? def.etiqueta(inst.props) : [])];
  if (lineas.length === 0) return null;
  const b = instBox(inst);
  const alto = 2.4;
  const paso = 3;
  let x = b.x + b.w + 1.5;
  let y = b.y + 2.6;
  let anchor: 'start' | 'middle' = 'start';
  if (pos === 'abajo') {
    x = b.x + b.w / 2;
    y = b.y + b.h + 3;
    anchor = 'middle';
  } else if (pos === 'arriba') {
    x = b.x;
    y = b.y - 1.6 - (lineas.length - 1) * paso;
  }
  return (
    <text fontFamily={FONT} fontSize={alto} fill="#000" stroke="none" textAnchor={anchor}>
      {lineas.map((l, i) => (
        <tspan key={i} x={x} y={y + i * paso} fontWeight={tag && i === 0 ? 'bold' : 'normal'}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function WireLabel({ pts, label }: { pts: { x: number; y: number }[]; label: string }) {
  // El texto va junto al tramo más largo del conductor.
  let mejor = 0;
  let largo = -1;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    if (l > largo) {
      largo = l;
      mejor = i;
    }
  }
  const a = pts[mejor - 1];
  const b = pts[mejor];
  const vertical = a.x === b.x;
  const x = vertical ? a.x + 1.5 : (a.x + b.x) / 2;
  const y = vertical ? (a.y + b.y) / 2 + 0.8 : a.y - 1.2;
  return (
    <text x={x} y={y} fontFamily={FONT} fontSize={2.2} fill="#000" stroke="none" textAnchor={vertical ? 'start' : 'middle'}>
      {label}
    </text>
  );
}

// ---------- Rotulado (RIC N°18, anexo 18.2, figuras 18.2.1 y 18.2.2) ----------

const ROT_W = 110;
const ROT_H = 80;

function Rotulado({
  info,
  frame,
  lamina,
  total,
}: {
  info: ProjectInfo;
  frame: { x: number; y: number; w: number; h: number };
  lamina: number;
  total: number;
}) {
  const x0 = frame.x + frame.w - ROT_W;
  const y0 = frame.y + frame.h - ROT_H;
  const xm = x0 + 55;
  const yA = y0 + 25; // fin del título
  const yB = y0 + 45; // fin de los datos
  const fila = 20 / 3;
  const ln = (x1: number, y1: number, x2: number, y2: number, k: string) => (
    <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={0.25} />
  );
  const chico = { fontFamily: FONT, fontSize: 1.9, fill: '#000', stroke: 'none' } as const;
  const dato = { fontFamily: FONT, fontSize: 2.6, fill: '#000', stroke: 'none' } as const;
  const titulo = info.titulo || '';
  const altoTitulo = Math.max(3, Math.min(5.5, 180 / Math.max(1, titulo.length)));
  // Figura 18.2.1: timbre de inscripción y croquis de ubicación junto al rotulado
  // de la primera lámina. En A3 y A4 ocuparían casi toda la hoja, así que solo se
  // dibujan desde A2 apaisado hacia arriba.
  const cabeTimbre = lamina === 1 && frame.w >= 500;

  return (
    <g>
      {cabeTimbre && (
        <g>
          <rect x={x0 - 110} y={y0} width={110} height={ROT_H} fill="none" stroke="#000" strokeWidth={0.25} />
          <text x={x0 - 55} y={y0 + 4.5} textAnchor="middle" {...chico} fill="#777">
            TIMBRE DE INSCRIPCIÓN
          </text>
          <rect x={x0 - 190} y={y0} width={80} height={ROT_H} fill="none" stroke="#000" strokeWidth={0.25} />
          <text x={x0 - 150} y={y0 + 4.5} textAnchor="middle" {...chico} fill="#777">
            CROQUIS DE UBICACIÓN
          </text>
        </g>
      )}
      <rect x={x0} y={y0} width={ROT_W} height={ROT_H} fill="#fff" stroke="#000" strokeWidth={0.5} />
      {[
        ln(x0, yA, x0 + ROT_W, yA, 'a'),
        ln(x0, yB, x0 + ROT_W, yB, 'b'),
        ln(xm, yA, xm, y0 + ROT_H, 'm'),
        ln(xm, yA + fila, x0 + ROT_W, yA + fila, 'f1'),
        ln(xm, yA + 2 * fila, x0 + ROT_W, yA + 2 * fila, 'f2'),
        ln(xm + 27.5, yA + fila, xm + 27.5, yA + 2 * fila, 'f3'),
      ]}

      {/* Título */}
      {titulo ? (
        <text x={x0 + 55} y={y0 + 12.5 + altoTitulo * 0.35} textAnchor="middle" fontFamily={FONT} fontSize={altoTitulo} fontWeight="bold" fill="#000" stroke="none">
          {titulo}
        </text>
      ) : (
        <text x={x0 + 55} y={y0 + 14} textAnchor="middle" fontFamily={FONT} fontSize={4} fill="#999" stroke="none">
          TÍTULO DEL PROYECTO
        </text>
      )}

      {/* Ubicación */}
      <text x={x0 + 2} y={yA + 5} {...chico}>COMUNA:</text>
      <text x={x0 + 14} y={yA + 5.2} {...dato}>{info.comuna}</text>
      <text x={x0 + 2} y={yA + 12} {...chico}>CALLE:</text>
      <text x={x0 + 14} y={yA + 12.2} {...dato}>{info.calle}</text>

      {/* Lámina, escala, fecha, otros datos */}
      <text x={xm + 2} y={yA + 4.4} {...chico}>LÁMINA</text>
      <text x={xm + 14} y={yA + 4.6} {...dato}>{`${lamina} DE ${total}`}</text>
      <text x={xm + 2} y={yA + fila + 4.4} {...chico}>ESCALA:</text>
      <text x={xm + 13} y={yA + fila + 4.6} {...dato} fontSize={2.3}>{info.escala}</text>
      <text x={xm + 29} y={yA + fila + 4.4} {...chico}>FECHA:</text>
      <text x={xm + 38.5} y={yA + fila + 4.6} {...dato} fontSize={2.3}>{info.fecha}</text>
      {info.otros ? (
        <text x={xm + 2} y={yA + 2 * fila + 4.6} {...dato} fontSize={2.3}>{info.otros}</text>
      ) : (
        <text x={xm + 27.5} y={yA + 2 * fila + 4.4} textAnchor="middle" {...chico} fill="#999">OTROS DATOS</text>
      )}

      {/* Propietario */}
      <text x={x0 + 27.5} y={yB + 4.5} textAnchor="middle" {...chico}>ACEPTACIÓN PROPIETARIO</text>
      <text x={x0 + 27.5} y={yB + 10} textAnchor="middle" {...dato} fontSize={2.3}>{info.propietario}</text>
      {ln(x0 + 10, yB + 24, x0 + 45, yB + 24, 'fp')}
      <text x={x0 + 27.5} y={yB + 27} textAnchor="middle" {...chico}>FIRMA</text>
      <text x={x0 + 2} y={yB + 32.5} {...chico}>RUT.</text>
      <text x={x0 + 9} y={yB + 32.7} {...dato} fontSize={2.3}>{info.rutPropietario}</text>

      {/* Instalador */}
      <text x={xm + 27.5} y={yB + 4.5} textAnchor="middle" {...chico}>INSTALADOR</text>
      <text x={xm + 27.5} y={yB + 10} textAnchor="middle" {...dato} fontSize={2.3}>{info.instalador}</text>
      {ln(xm + 10, yB + 21, xm + 45, yB + 21, 'fi')}
      <text x={xm + 27.5} y={yB + 23.8} textAnchor="middle" {...chico}>FIRMA</text>
      <text x={xm + 27.5} y={yB + 27} textAnchor="middle" {...chico}>{info.licencia || 'LICENCIA O TÍTULO'}</text>
      <text x={xm + 27.5} y={yB + 30} textAnchor="middle" {...chico}>{info.domicilio || 'DOMICILIO COMERCIAL'}</text>
      <text x={xm + 27.5} y={yB + 33} textAnchor="middle" {...chico}>{info.telefono || 'TELÉFONO'}</text>
    </g>
  );
}
