import { irA, proyectoNuevo, useStore } from './model/store';
import { abrirConPregunta, confirmarDescarte } from './io/archivos';
// Incrustado en el código para que también salga en la versión de un solo archivo.
import icono from '../public/icon.svg?inline';
import { VERSION } from './version';

const MODOS = [
  {
    id: 'unifilar' as const,
    titulo: 'Unifilar',
    texto: 'Diagrama unilineal desde la acometida hasta la última protección, con rotulado y formatos del RIC N°18.',
    disponible: true,
    dibujo: (
      <g>
        <path d="M20 4v10M20 26v8M6 34h28M10 34v8M20 34v8M30 34v8" />
        <circle cx="20" cy="16" r="2" />
        <circle cx="20" cy="24" r="2" />
        <path d="M21.5 17.5q6 2.5 0 5" />
      </g>
    ),
  },
  {
    id: 'multifilar' as const,
    titulo: 'Multifilar',
    texto: 'Esquemas de fuerza y control con cada conductor, bornes y referencias cruzadas.',
    disponible: false,
    version: '0.5',
    dibujo: (
      <g>
        <path d="M6 8h28M6 14h28M6 20h28M12 8v26M20 14v20M28 20v14" />
        <rect x="9" y="34" width="22" height="8" />
      </g>
    ),
  },
  {
    id: 'tablero3d' as const,
    titulo: 'Simulador 3D',
    texto: 'Armado del interior del tablero: placa, rieles, canaletas, barras y equipos, con avisos del RIC N°02.',
    disponible: false,
    version: '0.6',
    dibujo: (
      <g>
        <path d="M8 12l12-6 12 6v22l-12 6-12-6zM8 12l12 6 12-6M20 18v22" />
        <path d="M11 20l6 3M11 26l6 3" />
      </g>
    ),
  },
];

export function Inicio() {
  const tieneProyecto = useStore((s) => s.dirty || s.undo.length > 0 || s.filePath !== null);
  const fileName = useStore((s) => s.fileName);
  return (
    <div className="inicio">
      <div className="inicio-caja">
        <header>
          <img src={icono} alt="" width={56} height={56} />
          <div>
            <h1>ElectroDesign</h1>
            <p>Diseño eléctrico según SEC / RIC</p>
          </div>
        </header>

        <h2>Nuevo proyecto</h2>
        <div className="modos">
          {MODOS.map((m) => (
            <button
              key={m.id}
              className="modo"
              disabled={!m.disponible}
              onClick={() => void confirmarDescarte().then((ok) => ok && proyectoNuevo(m.id))}
            >
              <svg viewBox="0 0 40 46" width="64" height="74" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {m.dibujo}
              </svg>
              <strong>{m.titulo}</strong>
              <span>{m.texto}</span>
              {!m.disponible && <em>Llega en la versión {m.version}</em>}
            </button>
          ))}
        </div>

        <div className="inicio-acciones">
          <button onClick={() => void abrirConPregunta()}>Abrir proyecto (.edz)</button>
          {tieneProyecto && <button onClick={() => irA('editor')}>Volver a {fileName}</button>}
        </div>

        <footer>
          Versión {VERSION} · Software libre con licencia GPL-3.0 · Funciona sin conexión y no envía tus datos a ningún servidor
        </footer>
      </div>
    </div>
  );
}
