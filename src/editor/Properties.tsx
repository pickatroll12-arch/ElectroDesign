import type { ProjectInfo, Sheet } from '../model/types';
import { FORMAT_ORDER, FORMATS } from '../model/formats';
import {
  beginTransaction,
  deleteSelection,
  duplicateSelection,
  edit,
  endTransaction,
  rotateSelection,
  setProp,
  setWireLabel,
  setWireTipoDe,
  useStore,
} from '../model/store';
import { getSymbol, type PropDef } from '../symbols';
import { TIPOS_CONDUCTOR, tipoConductor, type WireTipo } from '../model/conductores';

/** Campo de texto que agrupa todo lo escrito en un solo paso de deshacer. */
function Campo({
  label,
  value,
  onChange,
  unidad,
  opciones,
  sugerencias,
  largo,
  ayuda,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unidad?: string;
  opciones?: string[];
  /** Valores propuestos; se puede escribir cualquier otro. */
  sugerencias?: string[];
  largo?: boolean;
  ayuda?: string;
}) {
  const comunes = { onFocus: beginTransaction, onBlur: endTransaction };
  return (
    <label className="campo">
      <span>
        {label}
        {unidad && <em> ({unidad})</em>}
      </span>
      {opciones ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {!opciones.includes(value) && <option value={value}>{value}</option>}
          {opciones.map((o) => (
            <option key={o} value={o}>
              {o || '(sin indicar)'}
            </option>
          ))}
        </select>
      ) : largo ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...comunes} />
      ) : (
        <>
          <input
            type="text"
            value={value}
            placeholder={ayuda}
            list={sugerencias ? `sug-${label}` : undefined}
            onChange={(e) => onChange(e.target.value)}
            {...comunes}
          />
          {sugerencias && (
            <datalist id={`sug-${label}`}>
              {sugerencias.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          )}
        </>
      )}
    </label>
  );
}

const INFO: { key: keyof ProjectInfo; label: string }[] = [
  { key: 'titulo', label: 'Título del proyecto' },
  { key: 'comuna', label: 'Comuna' },
  { key: 'calle', label: 'Calle y número' },
  { key: 'escala', label: 'Escala' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'otros', label: 'Otros datos' },
  { key: 'propietario', label: 'Propietario' },
  { key: 'rutPropietario', label: 'RUT del propietario' },
  { key: 'instalador', label: 'Instalador' },
  { key: 'licencia', label: 'Licencia o título' },
  { key: 'domicilio', label: 'Domicilio comercial' },
  { key: 'telefono', label: 'Teléfono' },
];

function PanelHoja({ sheet }: { sheet: Sheet }) {
  const info = useStore((s) => s.project.info);
  return (
    <>
      <h3>Hoja</h3>
      <Campo label="Nombre" value={sheet.name} onChange={(v) => edit((_p, h) => void (h.name = v))} />
      <label className="campo">
        <span>Formato</span>
        <select value={sheet.format} onChange={(e) => edit((_p, h) => void (h.format = e.target.value as Sheet['format']))}>
          {FORMAT_ORDER.map((f) => (
            <option key={f} value={f}>
              {f} ({FORMATS[f].short} x {FORMATS[f].long} mm)
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>Orientación</span>
        <select value={sheet.landscape ? 'h' : 'v'} onChange={(e) => edit((_p, h) => void (h.landscape = e.target.value === 'h'))}>
          <option value="h">Apaisada</option>
          <option value="v">Vertical</option>
        </select>
      </label>
      <h3>Rotulado</h3>
      <p className="nota">Estos datos se repiten en todas las hojas (RIC N°18, anexo 18.2).</p>
      {INFO.map((c) => (
        <Campo key={c.key} label={c.label} value={info[c.key]} onChange={(v) => edit((p) => void (p.info[c.key] = v))} />
      ))}
    </>
  );
}

export function Properties() {
  const selection = useStore((s) => s.selection);
  const sheet = useStore((s) => s.project.sheets.find((h) => h.id === s.sheetId) ?? s.project.sheets[0]);

  const acciones = (
    <div className="acciones">
      <button onClick={rotateSelection} title="Rotar 90° (R)">
        Rotar
      </button>
      <button onClick={duplicateSelection} title="Duplicar (Ctrl+D)">
        Duplicar
      </button>
      <button className="peligro" onClick={deleteSelection} title="Eliminar (Supr)">
        Eliminar
      </button>
    </div>
  );

  if (selection.length === 0) {
    return (
      <div className="propiedades">
        <PanelHoja sheet={sheet} />
      </div>
    );
  }

  if (selection.length > 1) {
    return (
      <div className="propiedades">
        <h3>{selection.length} elementos seleccionados</h3>
        {acciones}
      </div>
    );
  }

  const id = selection[0];
  const inst = sheet.instances.find((i) => i.id === id);
  if (inst) {
    const def = getSymbol(inst.sym);
    return (
      <div className="propiedades">
        <h3>{def.nombre}</h3>
        {def.origen && <p className="nota">Símbolo según {def.origen}.</p>}
        {def.props.map((p: PropDef) => (
          <Campo
            key={p.key}
            label={p.label}
            unidad={p.unidad}
            opciones={p.libre ? undefined : p.opciones}
            sugerencias={p.libre ? p.opciones : undefined}
            largo={p.largo}
            value={inst.props[p.key] ?? ''}
            onChange={(v) => setProp(inst.id, p.key, v)}
          />
        ))}
        {acciones}
      </div>
    );
  }

  const wire = sheet.wires.find((w) => w.id === id);
  if (wire) {
    return (
      <div className="propiedades">
        <h3>Conductor</h3>
        <label className="campo">
          <span>Tipo de conductor</span>
          <select value={tipoConductor(wire.tipo).id} onChange={(e) => setWireTipoDe(wire.id, e.target.value as WireTipo)}>
            {TIPOS_CONDUCTOR.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <p className="nota">Indica cantidad, sección, tipo y canalización (RIC N°18, 6.3.15.2).</p>
        <Campo
          label="Descripción del tramo"
          value={wire.label}
          ayuda="3x4 mm² + T, EVA, t.p.r. 20 mm"
          onChange={(v) => setWireLabel(wire.id, v)}
        />
        <div className="acciones">
          <button className="peligro" onClick={deleteSelection}>
            Eliminar
          </button>
        </div>
      </div>
    );
  }
  return <div className="propiedades" />;
}
