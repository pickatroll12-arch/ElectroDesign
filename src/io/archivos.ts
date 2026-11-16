// Abrir y guardar archivos. En la app de escritorio usa los diálogos del sistema;
// en la WebApp y en Android usa descarga y selector de archivos del navegador.

import { parseProject, serializeProject } from '../model/project';
import { avisar, cargarProyecto, getState, marcarGuardado } from '../model/store';

interface Puente {
  abrir: () => Promise<{ ruta: string; nombre: string; datos: Uint8Array } | null>;
  guardar: (a: {
    ruta: string | null;
    nombre: string;
    datos: Uint8Array;
    filtros?: { name: string; extensions: string[] }[];
  }) => Promise<{ ruta: string; nombre: string } | null>;
}

declare global {
  interface Window {
    electro?: Puente;
  }
}

export const esEscritorio = () => typeof window !== 'undefined' && !!window.electro;

export function descargar(nombre: string, datos: Uint8Array | string, mime: string) {
  const blob = new Blob([datos as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Guarda un archivo generado (PDF, SVG). Devuelve false si el usuario canceló. */
export async function guardarExportacion(nombre: string, datos: Uint8Array, mime: string, ext: string, desc: string) {
  if (window.electro) {
    const r = await window.electro.guardar({ ruta: null, nombre, datos, filtros: [{ name: desc, extensions: [ext] }] });
    return !!r;
  }
  descargar(nombre, datos, mime);
  return true;
}

export async function guardarProyecto(comoNuevo = false): Promise<boolean> {
  const s = getState();
  const datos = serializeProject(s.project);
  try {
    if (window.electro) {
      const r = await window.electro.guardar({ ruta: comoNuevo ? null : s.filePath, nombre: s.fileName, datos });
      if (!r) return false;
      marcarGuardado(r.nombre, r.ruta);
    } else {
      descargar(s.fileName, datos, 'application/zip');
      marcarGuardado(s.fileName, null);
    }
    return true;
  } catch (e) {
    avisar(`No se pudo guardar el proyecto. ${mensaje(e)}`);
    return false;
  }
}

function elegirArchivo(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.edz';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function abrirProyecto(): Promise<boolean> {
  try {
    if (window.electro) {
      const r = await window.electro.abrir();
      if (!r) return false;
      cargarProyecto(parseProject(new Uint8Array(r.datos)), r.nombre, r.ruta);
      return true;
    }
    const f = await elegirArchivo();
    if (!f) return false;
    cargarProyecto(parseProject(new Uint8Array(await f.arrayBuffer())), f.name, null);
    return true;
  } catch (e) {
    avisar(mensaje(e));
    return false;
  }
}

/** Pregunta antes de perder cambios sin guardar. */
export function confirmarDescarte(): boolean {
  return !getState().dirty || window.confirm('Hay cambios sin guardar. ¿Continuar y perderlos?');
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));
