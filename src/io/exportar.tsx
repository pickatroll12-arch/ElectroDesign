// Exportación de hojas a SVG y PDF, en tamaño real (1 unidad = 1 mm).

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Project, Sheet } from '../model/types';
import { sheetGeom } from '../model/formats';
import { SheetContent } from '../editor/SheetContent';
import { guardarExportacion } from './archivos';

const NS = 'http://www.w3.org/2000/svg';

/** Dibuja una hoja fuera de pantalla y devuelve su SVG limpio, sin ayudas del editor. */
function renderSheet(project: Project, sheet: Sheet, host: HTMLElement): SVGSVGElement {
  const g = sheetGeom(sheet.format, sheet.landscape);
  const cont = document.createElement('div');
  host.appendChild(cont);
  const root = createRoot(cont);
  flushSync(() =>
    root.render(
      <svg xmlns={NS} width={`${g.w}mm`} height={`${g.h}mm`} viewBox={`0 0 ${g.w} ${g.h}`}>
        <SheetContent project={project} sheet={sheet} />
      </svg>,
    ),
  );
  const svg = cont.querySelector('svg') as SVGSVGElement;
  svg.querySelectorAll('[data-ui]').forEach((n) => n.remove());
  svg.querySelectorAll('[data-id]').forEach((n) => n.removeAttribute('data-id'));
  return svg;
}

function conHost<T>(fn: (host: HTMLElement) => Promise<T> | T): Promise<T> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden';
  document.body.appendChild(host);
  return Promise.resolve()
    .then(() => fn(host))
    .finally(() => host.remove());
}

const limpio = (s: string) => s.replace(/\.edz$/i, '').replace(/[\\/:*?"<>|]/g, '_');

export function exportarSVG(project: Project, sheet: Sheet, base: string) {
  return conHost(async (host) => {
    const svg = renderSheet(project, sheet, host);
    const texto = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
    const nombre = `${limpio(base)} - ${limpio(sheet.name)}.svg`;
    return guardarExportacion(nombre, new TextEncoder().encode(texto), 'image/svg+xml', 'svg', 'Dibujo SVG');
  });
}

/** PDF con una página por hoja, cada una en su formato. */
export function exportarPDF(project: Project, sheets: Sheet[], base: string) {
  return conHost(async (host) => {
    // Se cargan solo al exportar para que la app abra más rápido.
    const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
    let pdf: InstanceType<typeof jsPDF> | null = null;
    for (const sheet of sheets) {
      const g = sheetGeom(sheet.format, sheet.landscape);
      const orientation = g.w > g.h ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [g.w, g.h], orientation, compress: true });
      else pdf.addPage([g.w, g.h], orientation);
      const svg = renderSheet(project, sheet, host);
      await pdf.svg(svg, { x: 0, y: 0, width: g.w, height: g.h });
    }
    if (!pdf) return false;
    pdf.setProperties({ title: project.info.titulo || limpio(base), creator: 'ElectroDesign' });
    const datos = new Uint8Array(pdf.output('arraybuffer'));
    return guardarExportacion(`${limpio(base)}.pdf`, datos, 'application/pdf', 'pdf', 'Documento PDF');
  });
}
