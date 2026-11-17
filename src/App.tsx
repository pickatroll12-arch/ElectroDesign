import { useEffect } from 'react';
import { avisar, responderPregunta, useStore } from './model/store';
import { Editor } from './editor/Editor';
import { Inicio } from './Inicio';

export function App() {
  const pantalla = useStore((s) => s.pantalla);
  const aviso = useStore((s) => s.aviso);
  const pregunta = useStore((s) => s.pregunta);
  useEffect(() => {
    if (!pregunta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') responderPregunta(false);
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [pregunta]);
  return (
    <>
      {pantalla === 'inicio' ? <Inicio /> : <Editor />}
      {aviso && (
        <div className="aviso" role="alert">
          <span>{aviso}</span>
          <button onClick={() => avisar(null)}>Cerrar</button>
        </div>
      )}
      {pregunta && (
        <div className="velo" onPointerDown={(e) => e.target === e.currentTarget && responderPregunta(false)}>
          <div className="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="pregunta-texto">
            <p id="pregunta-texto">{pregunta.texto}</p>
            <div className="botones">
              <button onClick={() => responderPregunta(false)}>Cancelar</button>
              <button className="principal" autoFocus onClick={() => responderPregunta(true)}>
                {pregunta.aceptar}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
