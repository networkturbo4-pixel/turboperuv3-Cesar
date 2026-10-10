const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const PRODUCTION_DEFAULT_URL = 'https://sistemasisp.tech';

const DEFAULT_CONFIG = {
  serverUrl: PRODUCTION_DEFAULT_URL,
  tenantSlug: '',
  minimizeToTray: true,
  startAtLogin: false,
  enableSound: true,
  enableNativeNotifications: true,
  hardwareAcceleration: true,
  windowBounds: {
    width: 1200,
    height: 800,
  }
};

function getConfigPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'turbochat-config.json');
}

function loadConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(data);
      // Si el archivo tenía guardado localhost de pruebas anteriores, actualizamos al dominio oficial
      if (parsed.serverUrl === 'http://localhost:3000') {
        parsed.serverUrl = PRODUCTION_DEFAULT_URL;
      }
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.error('[Config] Error leyendo configuración:', err);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(updates) {
  try {
    const current = loadConfig();
    const updated = { ...current, ...updates };
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('[Config] Error guardando configuración:', err);
    return null;
  }
}

function getResolvedTargetUrl() {
  const cfg = loadConfig();
  let base = (cfg.serverUrl || PRODUCTION_DEFAULT_URL).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  
  if (cfg.tenantSlug && cfg.tenantSlug.trim() !== '') {
    return `${base}/t/${encodeURIComponent(cfg.tenantSlug.trim().toLowerCase())}/chat?source=desktop`;
  }
  return `${base}/chat?source=desktop`;
}

module.exports = {
  PRODUCTION_DEFAULT_URL,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  getResolvedTargetUrl,
  getConfigPath
};
