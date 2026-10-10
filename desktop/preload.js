const { contextBridge, ipcRenderer } = require('electron');

// Exponer API protegida a la ventana del navegador
contextBridge.exposeInMainWorld('electronDesktop', {
  isDesktop: true,
  platform: process.platform,
  
  // Métodos de ventana
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  
  // Configuración y conexión
  openSettings: () => ipcRenderer.send('open-settings'),
  getServerConfig: () => ipcRenderer.invoke('get-server-config'),
  saveServerConfig: (updates) => ipcRenderer.invoke('save-server-config', updates),
  reconnect: (customUrl) => ipcRenderer.send('reload-main-url', customUrl),
  
  // Notificaciones y badges
  setUnreadCount: (count) => ipcRenderer.send('set-unread-count', count),
  notify: (payload) => ipcRenderer.send('show-native-notification', payload),
  
  // Eventos desde el proceso principal
  onNavigate: (callback) => {
    ipcRenderer.on('navigate-to', (_event, target) => callback(target));
  }
});

// Auto-detector de mensajes no leídos inspeccionando el título de la página
window.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.querySelector('title');
  if (titleEl) {
    const observer = new MutationObserver(() => {
      const match = titleEl.textContent.match(/\((\d+)\)/);
      const count = match ? parseInt(match[1], 10) : 0;
      ipcRenderer.send('set-unread-count', count);
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // Interceptar teclas de acceso rápido útiles
  window.addEventListener('keydown', (e) => {
    // F5 o Ctrl+R para recargar
    if ((e.ctrlKey && e.key.toLowerCase() === 'r') || e.key === 'F5') {
      // Dejar que recargue normalmente
      return;
    }
    // Ctrl+, para abrir configuración
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      ipcRenderer.send('open-settings');
    }
  });
});
