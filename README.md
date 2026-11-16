# ElectroDesign

Plataforma de diseño eléctrico para Chile. Dibuja diagramas unilineales y, más adelante,
multifilares y tableros en 3D, siguiendo los pliegos técnicos RIC de la SEC
(Decreto Supremo N°8/2019). Es solo de diseño: no simula circuitos ni hace cálculos.

Software libre con licencia GPL-3.0. Funciona sin conexión y no envía datos a ningún servidor.

## Estado: versión 0.1

| Modo | Estado |
| --- | --- |
| Unifilar | Disponible |
| Multifilar | Previsto para la versión 0.5 |
| Simulador 3D (interior del tablero) | Previsto para la versión 0.6 |

Lo que trae la versión 0.1:

- Pantalla de inicio con los tres modos.
- Lienzo unifilar con grilla de 5 mm, zoom, desplazamiento, selección, mover, rotar, duplicar,
  deshacer y rehacer. Funciona con ratón, lápiz y dedos.
- 28 símbolos de baja y media tensión, fotovoltaica y respaldo, cada uno con su ficha de datos, más texto libre.
- Conductores ortogonales que siguen unidos a los bornes al mover los símbolos.
- Formatos de lámina A4 a 4A0 con los márgenes de la tabla N°18.1.1 del RIC N°18.
- Rotulado según la figura 18.2.2 del RIC N°18.
- Proyectos en un solo archivo `.edz`.
- Exportación a PDF (tamaño real) y SVG.

## Origen de los símbolos

1. Ejemplo de diagrama unilineal del anexo 18.5 del RIC N°18: empalme, disyuntor, diferencial, barra.
2. Tabla de simbología del anexo 18.3 del RIC N°18: medidor, motor, generador, batería, tierras.
3. ANSI/IEEE 315 para lo que el RIC no trae, como permite el punto 6.3.10 del RIC N°18.
4. IEC 60617 para los equipos fotovoltaicos.

Todos los dibujos son propios de este proyecto.

## Descargas

Cada versión publica sus paquetes en la página de
[Releases](https://github.com/pickatroll12-arch/ElectroDesign/releases).

En Linux:

```sh
chmod +x ElectroDesign-*.AppImage
./ElectroDesign-*.AppImage
```

## Desarrollo

Requiere Node.js 22 o superior.

```sh
npm install
npm run dev          # WebApp en modo desarrollo
npm test             # pruebas
npm run typecheck    # revisión de tipos
npm run electron     # compila y abre la app de escritorio
npm run dist:linux   # genera AppImage y tar.gz en release/
npm run dist:win     # genera .exe portable y .zip en release/
```

### Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/model` | Modelo del proyecto, formatos de lámina, geometría, historial y archivo `.edz` |
| `src/symbols` | Biblioteca de símbolos |
| `src/editor` | Lienzo, paleta, propiedades y dibujo de la hoja |
| `src/io` | Abrir, guardar y exportar |
| `electron` | Ventana de escritorio y acceso a archivos |

### Atajos

| Tecla | Acción |
| --- | --- |
| V, H, C | Seleccionar, mover vista, conductor |
| R | Rotar 90° |
| Supr | Eliminar |
| Ctrl+Z, Ctrl+Y | Deshacer, rehacer |
| Ctrl+D | Duplicar |
| Ctrl+S, Ctrl+O | Guardar, abrir |
| Flechas | Mover la selección 5 mm |
| Rueda, botón central | Zoom, desplazar |
| Esc | Cancelar |
