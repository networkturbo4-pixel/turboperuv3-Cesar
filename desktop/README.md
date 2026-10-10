# TurboChat Desktop 🚀 (Windows .EXE)

Aplicación nativa de escritorio para Windows del módulo de **Mensajería & Comunidades ISP** de TurboNetwork.

---

## ✨ Características Principales

1. **Notificaciones Nativas de Windows (Toast)**:
   - Al recibir mensajes nuevos de clientes o WhatsApp, emite el sonido configurado y muestra la notificación flotante en la esquina inferior derecha de Windows.
   - Al hacer clic en la notificación, se enfoca la ventana y se abre la conversación.

2. **Bandeja del Sistema (System Tray)**:
   - Icono activo junto al reloj de Windows.
   - Minimización automática a la bandeja al presionar la `X` (para que los operadores no cierren la aplicación por accidente y continúen recibiendo mensajes).
   - Menú contextual rápido: ver URL del servidor, abrir configuración, iniciar con Windows y salir.

3. **Contador en Barra de Tareas & Flash Frame**:
   - Muestra el número de mensajes sin leer en el título de la ventana y en el tooltip del Tray.
   - Parpadea el icono de la barra de tareas cuando hay mensajes pendientes.

4. **Conexión Multientorno (Local o Cloud)**:
   - Selector visual de URL del servidor (`http://localhost:3000`, `http://192.168.1.X:3000` o `https://panel.tu-isp.com`).
   - Pantalla moderna de diagnóstico y reconexión si el servidor está temporalmente fuera de línea.
   - Soporte para multi-empresa (`tenantSlug`, ej: `/t/celeris/chat`).

5. **Arranque Automático**:
   - Opción para iniciar con Windows al encender el equipo del operador.

---

## 🛠️ Comandos Disponibles

Desde la raíz del proyecto (`TURBONETWORKV3`):

### 1. Iniciar en Modo Desarrollo (Prueba rápida)
```bash
npm run desktop:start
```

### 2. Generar el Ejecutable e Instalador (.EXE)
```bash
npm run desktop:build
```
> Genera los archivos en la carpeta `dist-desktop/`:
> * `TurboChat Setup 1.0.0.exe` (Instalador con acceso directo en Escritorio y Menú Inicio).
> * `TurboChat-Portable-1.0.0.exe` (Ejecutable portable directo sin instalación).

### 3. Generar solo versión Portable (.EXE único sin instalar)
```bash
npm run desktop:portable
```

---

## ⚙️ Estructura del Módulo Desktop

```
desktop/
  ├── assets/
  │   ├── icon.ico              # Icono oficial para Windows
  │   ├── icon.png              # Icono en alta resolución 512x512
  │   └── icon-192.png          # Icono 192x192
  ├── views/
  │   ├── offline.html          # Pantalla cuando no hay conexión al servidor
  │   └── settings.html         # Modal de ajustes de servidor y preferencias
  ├── config.js                 # Gestor de persistencia en %APPDATA%
  ├── main.js                   # Proceso principal de Electron (Ventana, Tray, IPC)
  ├── preload.js                # Puente seguro con chat.html
  ├── package.json              # Dependencias de Electron y electron-builder
  └── README.md                 # Esta documentación
```
