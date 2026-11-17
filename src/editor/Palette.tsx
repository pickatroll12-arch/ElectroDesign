import { useMemo, useState } from 'react';
import { CATEGORIAS, SYMBOLS, defaultProps, type SymbolDef } from '../symbols';
import { setTool, useStore } from '../model/store';

/** Minúsculas y sin tildes, para que "señalizacion" encuentre "Señalización". */
const plano = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Miniatura del símbolo, encuadrada en un recuadro fijo. */
export function Miniatura({ def, lado = 40 }: { def: SymbolDef; lado?: number }) {
  const props = useMemo(() => defaultProps(def), [def]);
  const { w, h } = def.size ? def.size(props) : { w: def.w, h: def.h };
  const m = 3;
  const dim = Math.max(w, h, 10) + 2 * m;
  return (
    <svg width={lado} height={lado} viewBox={`${w / 2 - dim / 2} ${h / 2 - dim / 2} ${dim} ${dim}`} aria-hidden="true">
      <g
        fill="none"
        stroke="#000"
        strokeWidth={Math.max(0.35, dim / 60)}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: def.draw(props, 0) }}
      />
    </svg>
  );
}

export function Palette({ onElegir }: { onElegir?: () => void }) {
  const tool = useStore((s) => s.tool);
  const [filtro, setFiltro] = useState('');
  const f = plano(filtro.trim());
  const visibles = SYMBOLS.filter(
    (s) => !f || plano(s.nombre).includes(f) || plano(s.categoria).includes(f) || (s.alias ?? []).some((a) => plano(a).includes(f)),
  );

  return (
    <div className="paleta">
      <input
        className="buscar"
        type="search"
        placeholder="Buscar símbolo o sigla"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        aria-label="Buscar símbolo"
      />
      <div className="paleta-lista">
        {CATEGORIAS.map((cat) => {
          const items = visibles.filter((s) => s.categoria === cat);
          if (items.length === 0) return null;
          return (
            <section key={cat}>
              <h3>{cat}</h3>
              <div className="paleta-grupo">
                {items.map((s) => (
                  <button
                    key={s.id}
                    className={`simbolo ${tool === `colocar:${s.id}` ? 'activo' : ''}`}
                    title={s.origen ? `${s.nombre}\n${s.origen}` : s.nombre}
                    onClick={() => {
                      setTool(tool === `colocar:${s.id}` ? 'seleccionar' : `colocar:${s.id}`);
                      onElegir?.();
                    }}
                  >
                    <Miniatura def={s} />
                    <span>{s.nombre}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {visibles.length === 0 && <p className="vacio">Ningún símbolo coincide con la búsqueda.</p>}
      </div>
    </div>
  );
}
