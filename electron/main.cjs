// Proceso principal de Electron: crea la ventana y atiende abrir/guardar archivos.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const FILTROS = [{ name: 'Proyecto ElectroDesign', extensions: ['edz'] }];
// Solo se sobrescriben sin preguntar los archivos que el usuario eligió en un diálogo.
const rutasPermitidas = new Set();

function crearVentana() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#12283f',
    title: 'ElectroDesign',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Los enlaces externos se abren en el navegador del sistema, no dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

ipcMain.handle('archivo:abrir', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: FILTROS });
  if (r.canceled || !r.filePaths[0]) return null;
  const ruta = r.filePaths[0];
  rutasPermitidas.add(ruta);
  const datos = await fs.readFile(ruta);
  return { ruta, nombre: path.basename(ruta), datos: new Uint8Array(datos) };
});

ipcMain.handle('archivo:guardar', async (e, { ruta, nombre, datos, filtros }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  let destino = ruta && rutasPermitidas.has(ruta) ? ruta : null;
  if (!destino) {
    const r = await dialog.showSaveDialog(win, { defaultPath: nombre, filters: filtros || FILTROS });
    if (r.canceled || !r.filePath) return null;
    destino = r.filePath;
    rutasPermitidas.add(destino);
  }
  await fs.writeFile(destino, Buffer.from(datos));
  return { ruta: destino, nombre: path.basename(destino) };
});

app.whenReady().then(() => {
  crearVentana();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
