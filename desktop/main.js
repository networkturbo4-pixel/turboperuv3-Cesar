const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { loadConfig, saveConfig, getResolvedTargetUrl } = require('./config');

// Identificador único para notificaciones nativas de Windows
app.setAppUserModelId('com.turbonetwork.turbochat');

// Registrar protocolo personalizado turbochat:// para enlaces de 1 clic desde el navegador
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('turbochat', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('turbochat');
}

// Bloqueo de instancia única: solo una ventana de TurboChat abierta
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;
let hasShownTrayTip = false;
let currentUnreadCount = 0;

function getIconPath() {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const pngPath = path.join(__dirname, 'assets', 'icon.png');
  return process.platform === 'win32' ? icoPath : pngPath;
}

function handleDeepLink(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return;
  try {
    const raw = urlStr.trim();
    if (!raw.startsWith('turbochat://')) return;
    const u = new URL(raw);
    const tenant = u.searchParams.get('tenant') || (u.hostname && u.hostname !== 'connect' ? u.hostname : '');
    const server = u.searchParams.get('server');
    
    const updates = {};
    if (tenant !== undefined) updates.tenantSlug = tenant;
    if (server) updates.serverUrl = server;
    
    saveConfig(updates);
    setupAppMenu();
    loadAppUrl();
    
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (err) {
    console.error('[DeepLink] Error procesando enlace:', err);
  }
}

function switchTenant(tenantSlug) {
  saveConfig({ tenantSlug: tenantSlug || '' });
  setupAppMenu();
  loadAppUrl();
}

function createMainWindow() {
  const cfg = loadConfig();
  const bounds = cfg.windowBounds || { width: 1200, height: 800 };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    title: 'TurboChat • Mensajería & Comunidades ISP',
    icon: getIconPath(),
    backgroundColor: '#0b101b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true,
    }
  });

  // Guardar dimensiones de ventana al cambiar
  mainWindow.on('resize', () => saveWindowBounds());
  mainWindow.on('move', () => saveWindowBounds());

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Interceptar cierre para minimizar a la bandeja si está configurado
  mainWindow.on('close', (e) => {
    const config = loadConfig();
    if (!isQuitting && config.minimizeToTray !== false) {
      e.preventDefault();
      mainWindow.hide();

      if (!hasShownTrayTip && tray) {
        hasShownTrayTip = true;
        tray.displayBalloon({
          iconType: 'info',
          title: 'TurboChat activo',
          content: 'La aplicación sigue ejecutándose en segundo plano para recibir mensajes.'
        });
      }
    }
  });

  // Manejo de errores de carga (servidor temporalmente inaccesible)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode !== -3) { // -3 es ABORTED (por redirecciones normales)
      console.warn(`[Electron] No se pudo conectar (${errorCode}: ${errorDescription}). Cargando pantalla de inicio/offline.`);
      mainWindow.loadFile(path.join(__dirname, 'views', 'offline.html'));
    }
  });

  // Abrir enlaces externos en el navegador predeterminado
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const currentHost = new URL(getResolvedTargetUrl()).host;
      try {
        const targetHost = new URL(url).host;
        if (currentHost !== targetHost) {
          shell.openExternal(url);
          return { action: 'deny' };
        }
      } catch (_) {}
    }
    return { action: 'allow' };
  });

  loadAppUrl();

  // Revisar si se inició con argumento de deep link
  const deepLinkArg = process.argv.find(arg => arg.startsWith('turbochat://'));
  if (deepLinkArg) {
    handleDeepLink(deepLinkArg);
  }
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  saveConfig({ windowBounds: bounds });
}

function loadAppUrl() {
  if (!mainWindow) return;
  const targetUrl = getResolvedTargetUrl();
  console.log('[Electron] Cargando interfaz de mensajes en:', targetUrl);
  mainWindow.loadURL(targetUrl).catch((err) => {
    console.warn('[Electron] Fallo inicial al cargar URL:', err.message);
    mainWindow.loadFile(path.join(__dirname, 'views', 'offline.html'));
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('TurboChat • Mensajería ISP');

  const updateTrayMenu = () => {
    const cfg = loadConfig();
    const currentTenant = cfg.tenantSlug ? `Empresa: ${cfg.tenantSlug.toUpperCase()}` : 'Empresa: Principal';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir TurboChat (Mensajes)',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            // Asegurar que esté en la interfaz de mensajes
            if (mainWindow.webContents.getURL().includes('offline.html')) {
              loadAppUrl();
            }
          }
        }
      },
      { type: 'separator' },
      {
        label: `Servidor: ${cfg.serverUrl.replace(/^https?:\/\//, '')}`,
        enabled: false
      },
      {
        label: currentTenant,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Ajustes de Conexión...',
        click: () => openSettingsWindow()
      },
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: !!cfg.startAtLogin,
        click: (menuItem) => {
          saveConfig({ startAtLogin: menuItem.checked });
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        }
      },
      { type: 'separator' },
      {
        label: 'Salir de TurboChat',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
      if (mainWindow.webContents.getURL().includes('offline.html')) {
        loadAppUrl();
      }
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      if (mainWindow.webContents.getURL().includes('offline.html')) {
        loadAppUrl();
      }
    }
  });
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 520,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: true,
    title: 'Ajustes de TurboChat',
    icon: getIconPath(),
    backgroundColor: '#0b101b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(__dirname, 'views', 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
    setupAppMenu();
  });
}

function setupAppMenu() {
  const cfg = loadConfig();
  const currentSlug = (cfg.tenantSlug || '').toLowerCase();

  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Configuración...',
          accelerator: 'CmdOrCtrl+,',
          click: () => openSettingsWindow()
        },
        { type: 'separator' },
        {
          label: 'Minimizar a la Bandeja',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow) mainWindow.hide();
          }
        },
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Empresa (Tenant)',
      submenu: [
        {
          label: '🏢 TurboNetwork (Principal)',
          type: 'checkbox',
          checked: currentSlug === '' || currentSlug === 'turbonetwork',
          click: () => switchTenant('')
        },
        {
          label: '🏢 Celeris Telecom',
          type: 'checkbox',
          checked: currentSlug === 'celeris',
          click: () => switchTenant('celeris')
        },
        {
          label: '🏢 LoaNetwork',
          type: 'checkbox',
          checked: currentSlug === 'loanetwork',
          click: () => switchTenant('loanetwork')
        },
        { type: 'separator' },
        {
          label: '➕ Cambiar o ingresar otra empresa...',
          click: () => openSettingsWindow()
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Recargar Mensajes', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
        { label: 'Forzar Recarga', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño Normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla Completa' },
        {
          label: 'Herramientas de Desarrollador',
          accelerator: 'Ctrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Reconectar Servidor',
          click: () => loadAppUrl()
        },
        {
          label: 'Sitio Web Oficial',
          click: () => shell.openExternal('https://sistemasisp.tech')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.on('set-unread-count', (_event, count) => {
  currentUnreadCount = Math.max(0, count || 0);

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (currentUnreadCount > 0) {
      mainWindow.setTitle(`(${currentUnreadCount}) TurboChat • Mensajes Nuevos`);
      if (!mainWindow.isFocused()) {
        mainWindow.flashFrame(true);
      }
    } else {
      mainWindow.setTitle('TurboChat • Mensajería & Comunidades ISP');
      mainWindow.flashFrame(false);
    }
  }

  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(
      currentUnreadCount > 0
        ? `TurboChat: ${currentUnreadCount} mensajes sin leer`
        : 'TurboChat • Mensajería ISP'
    );
  }
});

ipcMain.on('show-native-notification', (_event, payload) => {
  const cfg = loadConfig();
  if (cfg.enableNativeNotifications === false) return;

  const notif = new Notification({
    title: payload.title || 'TurboChat',
    body: payload.body || 'Nuevo mensaje recibido',
    icon: getIconPath(),
    silent: !cfg.enableSound
  });

  notif.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notif.show();
});

ipcMain.on('open-settings', () => openSettingsWindow());

ipcMain.handle('get-server-config', () => {
  return loadConfig();
});

ipcMain.handle('save-server-config', (_event, updates) => {
  const updated = saveConfig(updates);
  if (updates.startAtLogin !== undefined) {
    app.setLoginItemSettings({ openAtLogin: updates.startAtLogin });
  }
  setupAppMenu();
  return updated;
});

ipcMain.on('reload-main-url', () => {
  loadAppUrl();
});

// Al iniciar una segunda instancia (por ejemplo haciendo clic en turbochat:// o en el acceso directo de nuevo)
app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    
    // Si estaba en pantalla offline, recarga la interfaz
    if (mainWindow.webContents.getURL().includes('offline.html')) {
      loadAppUrl();
    }
  }

  // Detectar enlaces de protocolo turbochat://
  const deepLinkArg = commandLine.find(arg => arg.startsWith('turbochat://'));
  if (deepLinkArg) {
    handleDeepLink(deepLinkArg);
  }
});

app.whenReady().then(() => {
  const cfg = loadConfig();
  if (cfg.startAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  setupAppMenu();
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  const cfg = loadConfig();
  if (process.platform !== 'darwin' && (!cfg.minimizeToTray || isQuitting)) {
    app.quit();
  }
});
