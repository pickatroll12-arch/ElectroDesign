// Puente seguro entre la interfaz y el sistema de archivos.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electro', {
  abrir: () => ipcRenderer.invoke('archivo:abrir'),
  guardar: (args) => ipcRenderer.invoke('archivo:guardar', args),
});
