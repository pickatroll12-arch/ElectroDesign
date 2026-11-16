import { useEffect, useState } from 'react';
import type { Pt } from '../model/types';
import {
  addSheet,
  currentSheet,
  deleteSelection,
  duplicateSelection,
  getState,
  irA,
  moveSelectionFrom,
  redo,
  removeSheet,
  rotateSelection,
  select,
  setSheet,
  setTool,
  undo,
  useStore,
  avisar,
} from '../model/store';
import { GRID } from '../model/geometry';
import { abrirProyecto, confirmarDescarte, guardarProyecto } from '../io/archivos';
import { exportarPDF, exportarSVG } from '../io/exportar';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { Properties } from './Properties';

const esCampo = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
};

async function exportar(tipo: 'pdf' | 'pdf-hoja' | 'svg') {
  const s = getState();
  try {
    if (tipo === 'svg') await exportarSVG(s.project, currentSheet(s), s.fileName);
    else await exportarPDF(s.project, tipo === 'pdf' ? s.project.sheets : [currentSheet(s)], s.fileName);
  } catch (e) {
    avisar(`No se pudo exportar. ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function Editor() {
  const tool = useStore((s) => s.tool);
  const sheets = useStore((s) => s.project.sheets);
  const sheetId = useStore((s) => s.sheetId);
  const fileName = useStore((s) => s.fileName);
  const dirty = useStore((s) => s.dirty);
  const puedeDeshacer = useStore((s) => s.undo.length > 0);
  const puedeRehacer = useStore((s) => s.redo.length > 0);
  const haySeleccion = useStore((s) => s.selection.length > 0);
  const [cursor, setCursor] = useState<{ p: Pt | null; k: number }>({ p: null, k: 1 });
  const [panel, setPanel] = useState<'paleta' | 'props' | null>(null);
  const [menuExportar, setMenuExportar] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === 's') {
        e.preventDefault();
        void guardarProyecto(e.shiftKey);
        return;
      }
      if (ctrl && k === 'o') {
        e.preventDefault();
        if (confirmarDescarte()) void abrirProyecto();
        return;
      }
      if (esCampo(e.target)) return;
      if (ctrl && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (ctrl && k === 'y') {
        e.preventDefault();
        redo();
      } else if (ctrl && k === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (ctrl && k === 'a') {
        e.preventDefault();
        const h = currentSheet();
        setTool('seleccionar');
        select([...h.instances.map((i) => i.id), ...h.wires.map((w) => w.id)]);
      } else if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        deleteSelection();
      } else if (k === 'r' && !ctrl) {
        rotateSelection();
      } else if (k === 'c' && !ctrl) {
        setTool('conductor');
      } else if (k === 'v' && !ctrl) {
        setTool('seleccionar');
      } else if (k === 'h' && !ctrl) {
        setTool('mover');
      } else if (k.startsWith('arrow')) {
        const sel = getState().selection;
        if (sel.length === 0) return;
        e.preventDefault();
        const d = { arrowleft: [-GRID, 0], arrowright: [GRID, 0], arrowup: [0, -GRID], arrowdown: [0, GRID] }[k];
        if (d) moveSelectionFrom(currentSheet(), sel, d[0], d[1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => {
      if (getState().dirty && !window.electro) e.preventDefault();
    };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, []);

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${fileName} - ElectroDesign`;
  }, [fileName, dirty]);

  const herramienta = (id: 'seleccionar' | 'mover' | 'conductor', texto: string, atajo: string) => (
    <button className={tool === id ? 'activo' : ''} onClick={() => setTool(id)} title={`${texto} (${atajo})`}>
      {texto}
    </button>
  );

  return (
    <div className="editor">
      <header className="barra">
        <button className="marca" onClick={() => confirmarDescarte() && irA('inicio')} title="Volver al inicio">
          ElectroDesign
        </button>
        <div className="grupo">
          <button onClick={() => confirmarDescarte() && void abrirProyecto()} title="Abrir (Ctrl+O)">
            Abrir
          </button>
          <button onClick={() => void guardarProyecto()} title="Guardar (Ctrl+S)">
            Guardar
          </button>
          <div className="desplegable">
            <button onClick={() => setMenuExportar((v) => !v)} aria-expanded={menuExportar}>
              Exportar
            </button>
            {menuExportar && (
              <div className="menu" onClick={() => setMenuExportar(false)}>
                <button onClick={() => void exportar('pdf')}>PDF de todo el proyecto</button>
                <button onClick={() => void exportar('pdf-hoja')}>PDF de esta hoja</button>
                <button onClick={() => void exportar('svg')}>SVG de esta hoja</button>
              </div>
            )}
          </div>
        </div>
        <div className="grupo">
          <button onClick={undo} disabled={!puedeDeshacer} title="Deshacer (Ctrl+Z)">
            Deshacer
          </button>
          <button onClick={redo} disabled={!puedeRehacer} title="Rehacer (Ctrl+Y)">
            Rehacer
          </button>
        </div>
        <div className="grupo">
          {herramienta('seleccionar', 'Seleccionar', 'V')}
          {herramienta('mover', 'Mover vista', 'H')}
          {herramienta('conductor', 'Conductor', 'C')}
        </div>
        <div className="grupo">
          <button onClick={rotateSelection} disabled={!haySeleccion} title="Rotar 90° (R)">
            Rotar
          </button>
          <button onClick={deleteSelection} disabled={!haySeleccion} title="Eliminar (Supr)">
            Eliminar
          </button>
          <button onClick={() => window.dispatchEvent(new Event('ed:ajustar'))} title="Ver la hoja completa">
            Ajustar
          </button>
        </div>
        <span className="archivo" title={fileName}>
          {dirty ? '• ' : ''}
          {fileName}
        </span>
      </header>

      <div className="cuerpo">
        <aside className={`lateral izq ${panel === 'paleta' ? 'abierto' : ''}`}>
          <Palette onElegir={() => setPanel(null)} />
        </aside>
        <main className="area">
          <Canvas onCursor={(p, k) => setCursor({ p, k })} />
          <div className="ayuda-herramienta">
            {tool === 'conductor' && 'Haz clic en un borne para empezar. Clic en el plano agrega un quiebre; doble clic o Enter termina; Esc cancela.'}
            {tool.startsWith('colocar:') && 'Haz clic en el plano para colocar el símbolo. Esc para terminar.'}
          </div>
        </main>
        <aside className={`lateral der ${panel === 'props' ? 'abierto' : ''}`}>
          <Properties />
        </aside>
      </div>

      <footer className="pie">
        <div className="movil-paneles">
          <button className={panel === 'paleta' ? 'activo' : ''} onClick={() => setPanel(panel === 'paleta' ? null : 'paleta')}>
            Símbolos
          </button>
          <button className={panel === 'props' ? 'activo' : ''} onClick={() => setPanel(panel === 'props' ? null : 'props')}>
            Propiedades
          </button>
        </div>
        <div className="hojas">
          {sheets.map((h, i) => (
            <button key={h.id} className={h.id === sheetId ? 'activo' : ''} onClick={() => setSheet(h.id)} title={`Lámina ${i + 1} de ${sheets.length}`}>
              {h.name}
              {h.id === sheetId && sheets.length > 1 && (
                <span
                  className="cerrar"
                  role="button"
                  aria-label={`Eliminar ${h.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`¿Eliminar la hoja "${h.name}"?`)) removeSheet(h.id);
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button className="mas" onClick={() => addSheet('unifilar')} title="Agregar hoja">
            +
          </button>
        </div>
        <span className="estado">
          {cursor.p ? `X ${cursor.p.x.toFixed(0)}  Y ${cursor.p.y.toFixed(0)} mm` : ''}
          {'   '}Grilla {GRID} mm{'   '}SEC / RIC
        </span>
      </footer>
    </div>
  );
}
