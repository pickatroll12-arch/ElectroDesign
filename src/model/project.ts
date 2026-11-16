import { strToU8, strFromU8, zipSync, unzipSync } from 'fflate';
import type { Modo, Project, ProjectInfo, Sheet } from './types';

let contador = 0;
/** Identificador corto y único dentro del proyecto. */
export function newId(prefijo: string): string {
  contador++;
  return `${prefijo}${Date.now().toString(36)}${contador.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export const INFO_VACIA: ProjectInfo = {
  titulo: '',
  comuna: '',
  calle: '',
  escala: 'S/E',
  fecha: '',
  otros: '',
  propietario: '',
  rutPropietario: '',
  instalador: '',
  licencia: '',
  domicilio: '',
  telefono: '',
};

export const NOMBRE_MODO: Record<Modo, string> = {
  unifilar: 'Unifilar',
  multifilar: 'Multifilar',
  tablero3d: 'Tablero 3D',
};

export function newSheet(modo: Modo, numero: number): Sheet {
  return {
    id: newId('h'),
    name: `${NOMBRE_MODO[modo]} ${numero}`,
    modo,
    format: 'A3',
    landscape: true,
    instances: [],
    wires: [],
  };
}

export function newProject(modo: Modo = 'unifilar'): Project {
  return {
    app: 'ElectroDesign',
    formato: 1,
    norma: 'SEC-RIC',
    info: { ...INFO_VACIA, fecha: hoy() },
    sheets: [newSheet(modo, 1)],
  };
}

function hoy(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// ---------- archivo .edz ----------
// Un .edz es un zip con "proyecto.json". Más adelante llevará también imágenes
// y modelos 3D, sin cambiar la extensión.

const ENTRADA = 'proyecto.json';

export function serializeProject(p: Project): Uint8Array {
  return zipSync({ [ENTRADA]: strToU8(JSON.stringify(p)) }, { level: 6 });
}

export class ArchivoInvalido extends Error {}

export function parseProject(bytes: Uint8Array): Project {
  let json: string;
  try {
    const files = unzipSync(bytes);
    if (!files[ENTRADA]) throw new Error('sin proyecto.json');
    json = strFromU8(files[ENTRADA]);
  } catch {
    throw new ArchivoInvalido('El archivo no es un proyecto de ElectroDesign.');
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ArchivoInvalido('El proyecto está dañado y no se puede leer.');
  }
  return normalizar(data);
}

/** Valida y completa un proyecto leído, para que un archivo incompleto no rompa la app. */
function normalizar(data: unknown): Project {
  const d = data as Partial<Project> | null;
  if (!d || d.app !== 'ElectroDesign' || !Array.isArray(d.sheets)) {
    throw new ArchivoInvalido('El archivo no es un proyecto de ElectroDesign.');
  }
  if (typeof d.formato === 'number' && d.formato > 1) {
    throw new ArchivoInvalido('El proyecto fue creado con una versión más nueva de ElectroDesign.');
  }
  const sheets: Sheet[] = d.sheets.map((s, i) => ({
    id: typeof s.id === 'string' ? s.id : newId('h'),
    name: typeof s.name === 'string' ? s.name : `Hoja ${i + 1}`,
    modo: s.modo === 'multifilar' || s.modo === 'tablero3d' ? s.modo : 'unifilar',
    format: s.format ?? 'A3',
    landscape: s.landscape !== false,
    instances: Array.isArray(s.instances)
      ? s.instances
          .filter((x) => x && typeof x.id === 'string' && typeof x.sym === 'string')
          .map((x) => ({
            id: x.id,
            sym: x.sym,
            x: Number(x.x) || 0,
            y: Number(x.y) || 0,
            rot: ([0, 90, 180, 270] as const).includes(x.rot) ? x.rot : 0,
            props: x.props && typeof x.props === 'object' ? { ...x.props } : {},
          }))
      : [],
    wires: Array.isArray(s.wires)
      ? s.wires
          .filter((w) => w && typeof w.id === 'string' && w.a && w.b)
          .map((w) => ({ id: w.id, a: w.a, b: w.b, via: Array.isArray(w.via) ? w.via : [], label: w.label ?? '' }))
      : [],
  }));
  if (sheets.length === 0) sheets.push(newSheet('unifilar', 1));
  return {
    app: 'ElectroDesign',
    formato: 1,
    norma: d.norma === 'NFPA' ? 'NFPA' : 'SEC-RIC',
    info: { ...INFO_VACIA, ...(d.info ?? {}) },
    sheets,
  };
}
