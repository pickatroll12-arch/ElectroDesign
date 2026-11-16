import { avisar, useStore } from './model/store';
import { Editor } from './editor/Editor';
import { Inicio } from './Inicio';

export function App() {
  const pantalla = useStore((s) => s.pantalla);
  const aviso = useStore((s) => s.aviso);
  return (
    <>
      {pantalla === 'inicio' ? <Inicio /> : <Editor />}
      {aviso && (
        <div className="aviso" role="alert">
          <span>{aviso}</span>
          <button onClick={() => avisar(null)}>Cerrar</button>
        </div>
      )}
    </>
  );
}
