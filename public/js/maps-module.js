/**
 * TurboNetwork SaaS - Módulo de Mapas & Cobertura FTTH / Wireless
 * Motor: Mapbox GL JS
 * Funcionalidades:
 *  - Multitenant: Datos aislados por empresa / sede
 *  - Permisos granulares: maps:view, maps:create, maps:edit, maps:delete
 *  - Cards con detalles y estadísticas de lo que lleva el mapa
 *  - Modo expandido ocupando casi toda la pantalla colapsando el sidebar
 *  - Interfaz no invasiva sobre el mapa (HUD flotante moderno)
 *  - Marcadores de puntos personalizables con icono SVG o imagen y color
 *  - Trazado de líneas / conectores de fibra con distancia automática y color
 *  - Áreas de cobertura poligonales con cálculo de km² y opacidad
 *  - Herramienta regla interactiva de medición de distancias
 *  - Selector de capas (Satélite, Calles, Oscuro) y superposición de clientes
 */

(function () {
  // Estado local del módulo de mapas
  const state = {
    map: null,
    isLoaded: false,
    activeMode: 'overview', // 'overview' | 'map'
    activeTool: 'select', // 'select' | 'point' | 'line' | 'area' | 'ruler'
    tenantId: 'turbonetwork',
    activeMapId: null, // ID del mapa activo (ej: 'map_carabayllo')
    projects: [], // Colección de proyectos de mapas independientes
    projectSearchQuery: '',
    data: {
      center: [-77.0368, -12.0970],
      zoom: 14,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      nodes: [],
      lines: [],
      areas: [],
    },
    stats: {
      totalNodes: 0,
      totalLines: 0,
      totalAreas: 0,
      totalDistanceKm: 0,
      totalSurfaceKm2: 0,
      nodesByType: {},
      linesByType: {},
    },
    customers: [],
    markers: [],
    customerMarkers: [],
    tempPoints: [], // Para regla, línea o área en curso
    tempGeoJson: null,
    rulerDistanceMeters: 0,
    selectedFeature: null,
    editingNode: null,
    editingLine: null,
    editingArea: null,
    shareTarget: null,
    shareConversations: [],
    visibleLayers: {
      nodes: true,
      lines: true,
      areas: true,
      customers: false,
    },
    mapboxToken: '',
    mapStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
    newNodePhotos: [], // Fotos agregadas en modal de creación/edición de punto
    activePhotoNodeId: null, // ID del nodo actualmente abierto en modal de fotos
    libraryFilter: 'all', // 'all' | 'nodes' | 'lines' | 'areas'
    librarySearchQuery: '',
    activeLightboxPhoto: null,
  };

  // Iconos predefinidos SVG nítidos y vectoriales
  const NODE_ICONS = {
    tower: {
      name: 'Torre Telecom',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2L4 22h16L12 2zm0 6v14m-5-4h10m-7-6h4m-3-4h2"/></svg>`,
    },
    olt: {
      name: 'OLT Central',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><circle cx="7" cy="7" r="1" fill="currentColor"/><circle cx="11" cy="7" r="1" fill="currentColor"/><circle cx="7" cy="17" r="1" fill="currentColor"/><circle cx="11" cy="17" r="1" fill="currentColor"/></svg>`,
    },
    nap: {
      name: 'Caja NAP / Manga',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h.01M11 15h.01M15 15h.01M19 15h.01"/></svg>`,
    },
    switch: {
      name: 'Switch / Distribución',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="10" cy="12" r="1.5" fill="currentColor"/><circle cx="14" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></svg>`,
    },
    antenna: {
      name: 'Antena AP / Wireless',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v4m0-4a5 5 0 100-10 5 5 0 000 10zm-6-5a8 8 0 0112 0m-14-3a11 11 0 0116 0"/></svg>`,
    },
    server: {
      name: 'Datacenter / Servidor',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7" cy="6" r="1" fill="currentColor"/><circle cx="7" cy="12" r="1" fill="currentColor"/><circle cx="7" cy="18" r="1" fill="currentColor"/></svg>`,
    },
    pole: {
      name: 'Poste / Cruce',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2v20M5 6h14M7 10h10M4 14h16"/></svg>`,
    },
    customer: {
      name: 'Cliente Abonado',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
    },
    custom: {
      name: 'Personalizado',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v8m-4-4h8"/></svg>`,
    },
  };

  // Paleta de colores recomendada para telecomunicaciones / fibra
  const COLOR_PALETTE = [
    { name: 'Azul Eléctrico', hex: '#2563eb' },
    { name: 'Esmeralda', hex: '#059669' },
    { name: 'Púrpura Neón', hex: '#7c3aed' },
    { name: 'Naranja Fibra', hex: '#ea580c' },
    { name: 'Cian Óptico', hex: '#06b6d4' },
    { name: 'Rojo Alerta', hex: '#dc2626' },
    { name: 'Ámbar Sol', hex: '#d97706' },
    { name: 'Rosa Fucsia', hex: '#db2777' },
    { name: 'Gris Carbón', hex: '#475569' },
  ];

  // Helper para verificar permisos granulares
  function can(perm) {
    if (typeof window.hasPermission === 'function') {
      return window.hasPermission(perm);
    }
    return true;
  }

  // Helper para cálculo Haversine
  function getDistanceMeters(coord1, coord2) {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // Formato amigable de metros / km
  function formatDistance(meters) {
    if (meters >= 1000) {
      return (meters / 1000).toFixed(2) + ' km';
    }
    return meters + ' m';
  }

  // Helper para obtener el proyecto de mapa activo
  function getActiveMap() {
    if (!state.projects || state.projects.length === 0) {
      return null;
    }
    const found = state.projects.find(p => p.id === state.activeMapId);
    return found || state.projects[0];
  }

  // 1. CARGA PRINCIPAL DEL MÓDULO DE MAPAS
  async function loadMapsModule() {
    const currentTenant = typeof window.activeTenantId !== 'undefined' ? window.activeTenantId : 'turbonetwork';
    state.tenantId = currentTenant;

    // Actualizar badges e información de sede
    const tenantBadge = document.getElementById('maps-tenant-badge');
    if (tenantBadge) {
      const tObj = (typeof window.tenantsList !== 'undefined' ? window.tenantsList : []).find(t => t.id === currentTenant);
      tenantBadge.textContent = tObj ? tObj.name : currentTenant;
    }

    try {
      // 1. Cargar configuraciones de Mapbox
      await loadMapboxConfig();

      // 2. Cargar datos del mapa para este tenant (incluyendo mapas independientes)
      const mapParam = state.activeMapId ? `&mapId=${encodeURIComponent(state.activeMapId)}` : '';
      const res = await fetch(`/api/maps/data?tenantId=${encodeURIComponent(state.tenantId)}${mapParam}`);
      const json = await res.json();

      if (json.success && json.data) {
        state.data = json.data;
        state.stats = json.stats || state.stats;
        state.customers = json.customers || [];
        state.projects = json.maps || (json.data && json.data.maps) || [];
        if (!state.activeMapId || !state.projects.some(p => p.id === state.activeMapId)) {
          state.activeMapId = json.activeMapId || (json.data && json.data.activeMapId) || (state.projects[0] ? state.projects[0].id : null);
        }
      }
    } catch (err) {
      console.warn('[MAPS] Error al cargar datos del mapa:', err);
    }

    // Renderizar las Cards de Resumen del Módulo y el Grid de Proyectos
    renderOverviewCards();
    renderMapProjectsGrid();
    renderEntitiesTables();
    updateLibraryBadge();

    // Actualizar indicador de permisos en el HUD
    updatePermissionsUI();
  }

  // 2. CARGA DE CONFIGURACIÓN MAPBOX
  async function loadMapboxConfig() {
    try {
      const res = await fetch(`/api/settings/connections?tenantId=${encodeURIComponent(state.tenantId)}`);
      const json = await res.json();
      if (json.success && json.data && json.data.mapbox) {
        const mb = json.data.mapbox;
        state.mapboxToken = mb.accessToken || '';
        state.mapStyle = mb.defaultStyle || 'mapbox://styles/mapbox/satellite-streets-v12';
        if (mb.defaultCenter && Array.isArray(mb.defaultCenter) && mb.defaultCenter.length === 2) {
          state.data.center = mb.defaultCenter;
        }
        if (mb.defaultZoom) {
          state.data.zoom = mb.defaultZoom;
        }
      }
    } catch (e) {
      console.warn('[MAPS] No se pudo obtener token de conexiones:', e);
    }
  }

  // 3. RENDERIZAR CARDS DEL APARTADO DEL MÓDULO (VISTA INICIAL)
  function renderOverviewCards() {
    const s = state.stats;

    // Card 1: Puntos & Nodos
    const elNodesCount = document.getElementById('maps-card-nodes-count');
    if (elNodesCount) elNodesCount.textContent = s.totalNodes || (state.data.nodes || []).length;
    const elNodesBadges = document.getElementById('maps-card-nodes-badges');
    if (elNodesBadges) {
      const types = s.nodesByType || {};
      const badgeList = Object.entries(types)
        .map(([type, cnt]) => {
          const ic = NODE_ICONS[type] || { name: type };
          return `<span class="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-semibold">${cnt} ${ic.name}</span>`;
        })
        .join('');
      elNodesBadges.innerHTML = badgeList || `<span class="text-[11px] text-slate-500">Sin nodos registrados</span>`;
    }

    // Card 2: Conectores & Fibra
    const elLinesCount = document.getElementById('maps-card-lines-count');
    if (elLinesCount) elLinesCount.textContent = `${s.totalDistanceKm || 0} km`;
    const elLinesBadges = document.getElementById('maps-card-lines-badges');
    if (elLinesBadges) {
      const totalLines = s.totalLines || (state.data.lines || []).length;
      elLinesBadges.innerHTML = `
        <span class="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">${totalLines} tramos</span>
        <span class="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-[10px] font-medium">${formatDistance((s.totalDistanceKm || 0) * 1000)} totales</span>
      `;
    }

    // Card 3: Zonas & Cobertura
    const elAreasCount = document.getElementById('maps-card-areas-count');
    if (elAreasCount) elAreasCount.textContent = `${s.totalSurfaceKm2 || 0} km²`;
    const elAreasBadges = document.getElementById('maps-card-areas-badges');
    if (elAreasBadges) {
      const totalAreas = s.totalAreas || (state.data.areas || []).length;
      elAreasBadges.innerHTML = `
        <span class="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-semibold">${totalAreas} polígonos</span>
        <span class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium">FTTH Activo</span>
      `;
    }

    // Card 4: Estado Mapbox & Satélite
    const elTokenStatus = document.getElementById('maps-card-token-status');
    if (elTokenStatus) {
      if (state.mapboxToken) {
        elTokenStatus.innerHTML = `<span class="text-emerald-500 font-bold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Token Oficial Activo</span>`;
      } else {
        elTokenStatus.innerHTML = `<span class="text-amber-500 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Modo Demo / Sin Token</span>`;
      }
    }
  }

  // 4. RENDERIZAR TABLAS / LISTADOS DE NODOS, LÍNEAS Y POLÍGONOS
  function renderEntitiesTables() {
    // Listado de Nodos
    const nodesTbody = document.getElementById('maps-nodes-table-body');
    if (nodesTbody) {
      const nodes = state.data.nodes || [];
      if (nodes.length === 0) {
        nodesTbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-500">No hay puntos registrados aún. Abra el mapa para agregar nodos.</td></tr>`;
      } else {
        nodesTbody.innerHTML = nodes.map(n => {
          const iconDef = NODE_ICONS[n.type] || NODE_ICONS.custom;
          return `
            <tr class="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
              <td class="py-2.5 px-3">
                <div class="flex items-center space-x-2.5">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-xs" style="background-color: ${n.color || '#2563eb'}">
                    <span class="w-4 h-4">${iconDef.svg}</span>
                  </div>
                  <div>
                    <div class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(n.name)}</div>
                    <div class="text-[10px] text-slate-500 font-medium">${iconDef.name}</div>
                  </div>
                </div>
              </td>
              <td class="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400 font-mono text-[11px]">${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}</td>
              <td class="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">${escapeHtml(n.capacity || n.address || '-')}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${n.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'}">
                  ${n.status === 'active' ? 'Activo' : 'Mantenimiento'}
                </span>
              </td>
              <td class="py-2.5 px-3 text-right">
                <div class="flex items-center justify-end space-x-1">
                  <button type="button" onclick="mapsModule.openMapFocused([${n.lng}, ${n.lat}], 16)" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition" title="Ver en Mapa">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  </button>
                  ${can('maps:edit') ? `
                  <button type="button" onclick="mapsModule.openEditNodeModal('${n.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition" title="Editar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  ` : `
                  <button type="button" disabled class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed transition" title="Sin permiso de edición">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  `}
                  ${can('maps:delete') ? `
                  <button type="button" onclick="mapsModule.deleteNode('${n.id}')" class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Eliminar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  ` : `
                  <button type="button" disabled class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed transition" title="Sin permiso de eliminación">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  `}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Listado de Trazados / Líneas
    const linesTbody = document.getElementById('maps-lines-table-body');
    if (linesTbody) {
      const lines = state.data.lines || [];
      if (lines.length === 0) {
        linesTbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-500">No hay trazados registrados.</td></tr>`;
      } else {
        linesTbody.innerHTML = lines.map(l => {
          return `
            <tr class="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
              <td class="py-2.5 px-3">
                <div class="flex items-center space-x-2.5">
                  <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${l.color || '#059669'}; box-shadow: 0 0 8px ${l.color}80"></div>
                  <div>
                    <div class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(l.name)}</div>
                    <div class="text-[10px] text-slate-500 uppercase font-bold">${l.type || 'Fibra'} • ${l.cores ? l.cores + ' FO' : 'Cable'}</div>
                  </div>
                </div>
              </td>
              <td class="py-2.5 px-3 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">${formatDistance(l.distanceMeters || 0)}</td>
              <td class="py-2.5 px-3 text-xs text-slate-500">${l.style || 'solid'} (${l.width || 3}px)</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Operativo</span>
              </td>
              <td class="py-2.5 px-3 text-right">
                <div class="flex items-center justify-end space-x-1">
                  <button type="button" onclick="mapsModule.focusLine('${l.id}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition" title="Ver en Mapa">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  </button>
                  ${can('maps:edit') ? `
                  <button type="button" onclick="mapsModule.openEditLineModal('${l.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition" title="Editar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  ` : `
                  <button type="button" disabled class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed transition" title="Sin permiso de edición">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  `}
                  ${can('maps:delete') ? `
                  <button type="button" onclick="mapsModule.deleteLine('${l.id}')" class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Eliminar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  ` : `
                  <button type="button" disabled class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed transition" title="Sin permiso de eliminación">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  `}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Listado de Áreas
    const areasTbody = document.getElementById('maps-areas-table-body');
    if (areasTbody) {
      const areas = state.data.areas || [];
      if (areas.length === 0) {
        areasTbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-xs text-slate-500">No hay áreas de cobertura registradas.</td></tr>`;
      } else {
        areasTbody.innerHTML = areas.map(a => {
          return `
            <tr class="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
              <td class="py-2.5 px-3">
                <div class="flex items-center space-x-2.5">
                  <div class="w-4 h-4 rounded-md border flex-shrink-0" style="background-color: ${a.fillColor}40; border-color: ${a.strokeColor}"></div>
                  <div>
                    <div class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(a.name)}</div>
                    <div class="text-[10px] text-slate-500">${(a.coordinates || []).length} vértices</div>
                  </div>
                </div>
              </td>
              <td class="py-2.5 px-3 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">${a.surfaceAreaKm2 || 0} km²</td>
              <td class="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-400">${a.targetCustomers ? a.targetCustomers + ' abonados' : 'General'}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === 'active' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/10 text-emerald-600'}">
                  ${a.status === 'active' ? 'En Cobertura' : 'Expansión'}
                </span>
              </td>
              <td class="py-2.5 px-3 text-right">
                <div class="flex items-center justify-end space-x-1">
                  <button type="button" onclick="mapsModule.focusArea('${a.id}')" class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition" title="Ver en Mapa">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  </button>
                  ${can('maps:edit') ? `
                  <button type="button" onclick="mapsModule.openEditAreaModal('${a.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition" title="Editar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  ` : `
                  <button type="button" disabled class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed transition" title="Sin permiso de edición">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  `}
                  ${can('maps:delete') ? `
                  <button type="button" onclick="mapsModule.deleteArea('${a.id}')" class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Eliminar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  ` : `
                  <button type="button" disabled class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed transition" title="Sin permiso de eliminación">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  `}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // 4b. GESTIÓN MULTI-MAPA & ZONAS DE COBERTURA
  function renderMapProjectsGrid() {
    const container = document.getElementById('maps-projects-grid');
    if (!container) return;

    const q = state.projectSearchQuery;
    let list = state.projects || [];
    if (q) {
      list = list.filter(p => {
        const name = (p.name || '').toLowerCase();
        const dist = (p.district || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(q) || dist.includes(q) || desc.includes(q);
      });
    }

    const badge = document.getElementById('maps-projects-count-badge');
    if (badge) {
      badge.textContent = `${list.length} ${list.length === 1 ? 'Mapa' : 'Mapas'}`;
    }

    const cardsHtml = list.map(p => {
      const nodesCount = (p.nodes || []).length;
      const linesCount = (p.lines || []).length;
      const areasCount = (p.areas || []).length;
      const distKm = (p.lines || []).reduce((acc, l) => acc + ((l.distanceMeters || 0) / 1000), 0);
      const color = p.color || '#059669';
      const isActive = p.id === state.activeMapId;

      return `
        <div class="pro-card rounded-2xl border border-slate-200 dark:border-white/10 hover:border-blue-500/40 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden group">
          <!-- Card Header -->
          <div class="p-5 pb-3">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex items-center space-x-2.5 min-w-0">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm" style="background-color: ${color}">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
                </div>
                <div class="min-w-0">
                  <h4 class="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">${escapeHtml(p.name)}</h4>
                  <div class="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color: ${color}"></span>
                    <span class="truncate font-medium">${escapeHtml(p.district || 'Sector GIS')}</span>
                  </div>
                </div>
              </div>

              ${isActive ? `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                  Activo
                </span>
              ` : ''}
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
              ${escapeHtml(p.description || 'Sector de infraestructura y distribución de red.')}
            </p>

            <!-- Métricas del Mapa -->
            <div class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-white/5 text-center">
              <div class="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                <div class="text-[10px] uppercase font-bold text-slate-400">Puntos</div>
                <div class="text-xs font-bold text-slate-900 dark:text-white mt-0.5 flex items-center justify-center gap-1">
                  <span class="text-blue-500">📍</span> ${nodesCount}
                </div>
              </div>
              <div class="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                <div class="text-[10px] uppercase font-bold text-slate-400">Fibra</div>
                <div class="text-xs font-bold text-slate-900 dark:text-white mt-0.5 flex items-center justify-center gap-1">
                  <span class="text-emerald-500">⚡</span> ${distKm >= 1 ? distKm.toFixed(1) + ' km' : Math.round(distKm * 1000) + ' m'}
                </div>
              </div>
              <div class="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                <div class="text-[10px] uppercase font-bold text-slate-400">Zonas</div>
                <div class="text-xs font-bold text-slate-900 dark:text-white mt-0.5 flex items-center justify-center gap-1">
                  <span class="text-purple-500">🌐</span> ${areasCount}
                </div>
              </div>
            </div>
          </div>

          <!-- Card Actions Footer -->
          <div class="p-4 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
            <button type="button" onclick="mapsModule.enterMapMode('${p.id}')" class="flex-1 px-3.5 py-2 rounded-xl btn-brand-primary text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm active:scale-95">
              <span>Entrar al Mapa</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
            <button type="button" onclick="mapsModule.enterMapMode('${p.id}', true)" class="px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition flex items-center justify-center space-x-1" title="Abrir explorador de elementos de este mapa">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              <span>Biblioteca</span>
            </button>
            <div class="flex items-center space-x-1">
              <button type="button" onclick="mapsModule.openCreateMapModal('${p.id}')" class="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition" title="Editar detalles del mapa">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              ${list.length > 1 ? `
              <button type="button" onclick="mapsModule.deleteMapProject('${p.id}')" class="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Eliminar este mapa">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const addCardHtml = `
      <div onclick="mapsModule.openCreateMapModal()" class="rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-blue-500/60 hover:bg-blue-50/40 dark:hover:bg-blue-500/5 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[240px]">
        <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition mb-3 shadow-xs">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </div>
        <h4 class="text-sm font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">Crear Nuevo Mapa</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] mt-1">Añada otro sector independiente (ej: Los Olivos, San Isidro, etc.)</p>
      </div>
    `;

    container.innerHTML = cardsHtml + addCardHtml;
  }

  function handleProjectSearch(query) {
    state.projectSearchQuery = (query || '').toLowerCase().trim();
    renderMapProjectsGrid();
  }

  // ========================================================
  // COMMAND PALETTE DEL MÓDULO MAPAS
  // ========================================================
  let paletteFilter = 'all'; // 'all', 'maps', 'actions', 'tools', 'layers'
  let selectedPaletteIndex = 0;
  let currentPaletteItems = [];

  function openCommandPalette() {
    const modal = document.getElementById('maps-command-palette-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const input = document.getElementById('maps-cmd-palette-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 80);
    }
    const clearBtn = document.getElementById('maps-cmd-palette-clear-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    paletteFilter = 'all';
    updatePaletteChipsUI();
    renderPaletteResults('');
  }

  function closeCommandPalette() {
    const modal = document.getElementById('maps-command-palette-modal');
    if (modal) modal.classList.add('hidden');
  }

  function handlePaletteBackdropClick(e) {
    if (e.target && e.target.id === 'maps-command-palette-modal') {
      closeCommandPalette();
    }
  }

  function clearCommandPaletteInput() {
    const input = document.getElementById('maps-cmd-palette-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    const clearBtn = document.getElementById('maps-cmd-palette-clear-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    renderPaletteResults('');
  }

  function onCommandPaletteInput(val) {
    const clearBtn = document.getElementById('maps-cmd-palette-clear-btn');
    if (clearBtn) {
      if (val && val.length > 0) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }
    renderPaletteResults(val);
  }

  function setPaletteFilter(filter) {
    paletteFilter = filter;
    updatePaletteChipsUI();
    const input = document.getElementById('maps-cmd-palette-input');
    renderPaletteResults(input ? input.value : '');
  }

  function updatePaletteChipsUI() {
    const container = document.getElementById('maps-cmd-chips');
    if (!container) return;
    container.querySelectorAll('.cmd-chip').forEach(btn => {
      const f = btn.getAttribute('data-filter');
      if (f === paletteFilter) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-xs');
        btn.classList.remove('bg-slate-100', 'dark:bg-white/5', 'text-slate-600', 'dark:text-slate-400');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow-xs');
        btn.classList.add('bg-slate-100', 'dark:bg-white/5', 'text-slate-600', 'dark:text-slate-400');
      }
    });
  }

  function getBasePaletteActions() {
    return [
      {
        id: 'create-map',
        type: 'actions',
        icon: `<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>`,
        badge: 'Nuevo Proyecto',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        title: 'Crear Nuevo Mapa de Cobertura',
        subtitle: 'Crea un nuevo proyecto GIS con centro geográfico independiente y sector específico',
        keywords: 'crear mapa nuevo sector proyecto distrito zona cobertura ftth',
        action: () => {
          closeCommandPalette();
          openCreateMapModal();
        }
      },
      {
        id: 'fullscreen-map',
        type: 'actions',
        icon: `<svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>`,
        badge: 'Visor',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        title: 'Abrir Visor Interactivo (Pantalla Completa)',
        subtitle: 'Accede al editor satelital del mapa activo con barra de herramientas completa',
        keywords: 'abrir mapa interactivo visor pantalla completa satelital editor',
        action: () => {
          closeCommandPalette();
          enterMapMode();
        }
      },
      {
        id: 'create-node',
        type: 'actions',
        icon: `<svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
        badge: 'Infraestructura',
        badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
        title: 'Añadir Nuevo Nodo / Poste / Caja NAP',
        subtitle: 'Registrar punto óptico georreferenciado con tipo, capacidad y fotos de estado',
        keywords: 'nodo punto poste caja nap mufa olt switch distribucion splitter agregar crear',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => openCreateNodeModal(), 400);
        }
      },
      {
        id: 'draw-line',
        type: 'tools',
        icon: `<svg class="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
        badge: 'Herramienta GIS',
        badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
        title: 'Trazar Tendido de Fibra Óptica',
        subtitle: 'Iniciar herramienta de trazado punto a punto para cable troncal o distribución',
        keywords: 'trazar linea fibra cable optico tendido troncal distribucion adss dibujar',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => startDrawLine(), 400);
        }
      },
      {
        id: 'draw-area',
        type: 'tools',
        icon: `<svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`,
        badge: 'Cobertura',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
        title: 'Dibujar Polígono de Cobertura',
        subtitle: 'Trazar perímetro de servicio comercial con cálculo automático de superficie km²',
        keywords: 'dibujar area poligono zona cobertura sector superficie ftth',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => startDrawArea(), 400);
        }
      },
      {
        id: 'measure-ruler',
        type: 'tools',
        icon: `<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>`,
        badge: 'Medición',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        title: 'Regla de Medición Óptica',
        subtitle: 'Medir distancias de tendido en metros y kilómetros con precisión milimétrica',
        keywords: 'regla medir distancia metros kilometros precision ruta regla',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => toggleRulerTool(), 400);
        }
      },
      {
        id: 'open-library',
        type: 'tools',
        icon: `<svg class="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/></svg>`,
        badge: 'Inventario GIS',
        badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
        title: 'Biblioteca de Elementos & NAPs',
        subtitle: 'Panel lateral con listado rápido y salto directo con animación flyTo',
        keywords: 'biblioteca drawer elementos nodos nap lista postes buscar inventario',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => toggleLibraryDrawer(true), 400);
        }
      },
      {
        id: 'export-geojson',
        type: 'tools',
        icon: `<svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`,
        badge: 'Exportación',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        title: 'Exportar Infraestructura en GeoJSON',
        subtitle: 'Descarga paquete FeatureCollection compatible con QGIS, ArcGIS y Google Earth',
        keywords: 'exportar geojson descargar archivo qgis kml datos backup capas',
        action: () => {
          closeCommandPalette();
          exportGeoJson();
        }
      },
      {
        id: 'gps-location',
        type: 'tools',
        icon: `<svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
        badge: 'GPS',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
        title: 'Centrar en mi Ubicación Actual (GPS)',
        subtitle: 'Usa la geolocalización del dispositivo para ubicarte en el mapa',
        keywords: 'gps ubicacion actual geolocalizacion centrar posicion',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => centerOnUserLocation(), 500);
        }
      },
      {
        id: 'style-satellite',
        type: 'layers',
        icon: `<svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
        badge: 'Capa Base',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        title: 'Estilo: Satélite Ultra-HD con Calles',
        subtitle: 'Fotografía satelital con nombres de avenidas y manzanas',
        keywords: 'estilo mapa satelite satelital fotogrametria imagen aerea',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => setMapStyle('satellite-streets-v12'), 300);
        }
      },
      {
        id: 'style-dark',
        type: 'layers',
        icon: `<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`,
        badge: 'Capa Base',
        badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
        title: 'Estilo: Mapa Nocturno Vectorial (Dark)',
        subtitle: 'Diseño oscuro de alto contraste ideal para visualizar fibra brillante',
        keywords: 'estilo oscuro dark noche vectorial contraste',
        action: () => {
          closeCommandPalette();
          enterMapMode();
          setTimeout(() => setMapStyle('dark-v11'), 300);
        }
      },
      {
        id: 'config-token',
        type: 'layers',
        icon: `<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
        badge: 'Ajustes',
        badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
        title: 'Configurar Token Oficial de Mapbox GL',
        subtitle: 'Modifica o actualiza la clave API pública para satélite y geocodificación',
        keywords: 'token mapbox api conexiones configuracion satelite clave',
        action: () => {
          closeCommandPalette();
          if (typeof switchTab === 'function') switchTab('config');
          if (typeof switchConfigSubTab === 'function') switchConfigSubTab('connections');
        }
      }
    ];
  }

  function getProjectPaletteItems() {
    return (state.projects || []).map(p => {
      const nodeCount = (p.nodes || []).length;
      const lineCount = (p.lines || []).length;
      const areaCount = (p.areas || []).length;
      const color = p.color || '#2563eb';
      const isActive = p.id === state.activeMapId;
      return {
        id: `project-${p.id}`,
        type: 'maps',
        icon: `<div class="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs" style="background-color: ${color};"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg></div>`,
        badge: isActive ? 'Mapa Activo' : (p.district || 'Proyecto'),
        badgeClass: isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        title: p.name,
        subtitle: `${p.district || 'Sin distrito'} • ${nodeCount} Nodos • ${lineCount} Trazados • ${areaCount} Polígonos`,
        keywords: `${p.name} ${p.district || ''} ${p.description || ''} mapa proyecto sector zona`,
        action: () => {
          closeCommandPalette();
          enterMapMode(p.id);
        }
      };
    });
  }

  function renderPaletteResults(query = '') {
    const q = (query || '').trim().toLowerCase();
    const resultsContainer = document.getElementById('maps-cmd-results');
    const countBadge = document.getElementById('maps-cmd-count');
    if (!resultsContainer) return;

    let items = [...getProjectPaletteItems(), ...getBasePaletteActions()];

    if (paletteFilter !== 'all') {
      items = items.filter(it => it.type === paletteFilter);
    }

    if (q) {
      items = items.filter(it =>
        it.title.toLowerCase().includes(q) ||
        it.subtitle.toLowerCase().includes(q) ||
        (it.keywords && it.keywords.toLowerCase().includes(q))
      );
    }

    currentPaletteItems = items;
    selectedPaletteIndex = 0;

    if (countBadge) {
      countBadge.textContent = `${items.length} ${items.length === 1 ? 'opción' : 'opciones'}`;
    }

    if (items.length === 0) {
      resultsContainer.innerHTML = `
        <div class="py-12 px-4 text-center">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">No se encontraron resultados para "${escapeHtml(q)}"</p>
          <p class="text-xs text-slate-500 mt-1">Prueba con palabras como "Carabayllo", "NAP", "fibra", "exportar" o "satélite".</p>
        </div>
      `;
      return;
    }

    let html = '';
    const maps = items.filter(it => it.type === 'maps');
    const actions = items.filter(it => it.type === 'actions');
    const tools = items.filter(it => it.type === 'tools');
    const layers = items.filter(it => it.type === 'layers');

    let globalIndex = 0;

    const renderGroup = (title, groupItems) => {
      if (groupItems.length === 0) return '';
      let grpHtml = `<div class="px-2 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">${title}</div>`;
      grpHtml += groupItems.map(it => {
        const idx = globalIndex++;
        const isSel = idx === selectedPaletteIndex;
        return `
          <div 
            id="maps-cmd-item-${idx}" 
            data-index="${idx}"
            onclick="mapsModule.executePaletteItem(${idx})"
            class="palette-item ${isSel ? 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/30' : 'hover:bg-slate-100 dark:hover:bg-white/5 border-transparent'} group flex items-center justify-between p-3 rounded-xl border transition cursor-pointer"
          >
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                ${it.icon}
              </div>
              <div class="min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">${escapeHtml(it.title)}</span>
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${it.badgeClass}">${escapeHtml(it.badge)}</span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(it.subtitle)}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2 flex-shrink-0 pl-3">
              <span class="text-[10px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition">Ejecutar</span>
              <kbd class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 shadow-2xs">↵</kbd>
            </div>
          </div>
        `;
      }).join('');
      return grpHtml;
    };

    html += renderGroup('Proyectos de Mapas & Zonas', maps);
    html += renderGroup('Acciones Rápidas & Creación', actions);
    html += renderGroup('Herramientas GIS & Medición', tools);
    html += renderGroup('Capas Base & Ajustes', layers);

    resultsContainer.innerHTML = html;
  }

  function onCommandPaletteKeydown(e) {
    if (e.key === 'Escape') {
      closeCommandPalette();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentPaletteItems.length > 0) {
        selectedPaletteIndex = (selectedPaletteIndex + 1) % currentPaletteItems.length;
        updatePaletteSelectionUI();
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentPaletteItems.length > 0) {
        selectedPaletteIndex = (selectedPaletteIndex - 1 + currentPaletteItems.length) % currentPaletteItems.length;
        updatePaletteSelectionUI();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      executePaletteItem(selectedPaletteIndex);
      return;
    }
  }

  function updatePaletteSelectionUI() {
    const container = document.getElementById('maps-cmd-results');
    if (!container) return;
    container.querySelectorAll('.palette-item').forEach(el => {
      const idx = parseInt(el.getAttribute('data-index'), 10);
      if (idx === selectedPaletteIndex) {
        el.classList.add('bg-blue-500/10', 'dark:bg-blue-500/15', 'border-blue-500/30');
        el.classList.remove('border-transparent');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('bg-blue-500/10', 'dark:bg-blue-500/15', 'border-blue-500/30');
        el.classList.add('border-transparent');
      }
    });
  }

  function executePaletteItem(index) {
    if (currentPaletteItems && currentPaletteItems[index]) {
      const item = currentPaletteItems[index];
      if (typeof item.action === 'function') {
        item.action();
      }
    }
  }

  function openCreateMapModal(editMapId) {
    const modal = document.getElementById('modal-create-map-project');
    if (!modal) return;

    const modalTitle = document.getElementById('modal-create-map-title');
    const inputId = document.getElementById('maps-project-id');
    const inputName = document.getElementById('maps-project-name');
    const inputDistrict = document.getElementById('maps-project-district');
    const inputColor = document.getElementById('maps-project-color');
    const inputColorText = document.getElementById('maps-project-color-text');
    const inputLat = document.getElementById('maps-project-lat');
    const inputLng = document.getElementById('maps-project-lng');
    const inputDesc = document.getElementById('maps-project-desc');

    if (editMapId) {
      const p = (state.projects || []).find(x => x.id === editMapId);
      if (!p) {
        showToast('No se encontró el mapa a editar.', 'error');
        return;
      }
      if (modalTitle) modalTitle.textContent = `Editar: ${p.name}`;
      if (inputId) inputId.value = p.id;
      if (inputName) inputName.value = p.name;
      if (inputDistrict) inputDistrict.value = p.district || '';
      const col = p.color || '#059669';
      if (inputColor) inputColor.value = col;
      if (inputColorText) inputColorText.value = col;
      const lat = p.center && Array.isArray(p.center) ? p.center[1] : -11.8755;
      const lng = p.center && Array.isArray(p.center) ? p.center[0] : -77.0345;
      if (inputLat) inputLat.value = lat;
      if (inputLng) inputLng.value = lng;
      if (inputDesc) inputDesc.value = p.description || '';
    } else {
      if (modalTitle) modalTitle.textContent = 'Crear Nuevo Mapa de Cobertura';
      if (inputId) inputId.value = '';
      if (inputName) inputName.value = '';
      if (inputDistrict) inputDistrict.value = '';
      if (inputColor) inputColor.value = '#059669';
      if (inputColorText) inputColorText.value = '#059669';
      if (inputLat) inputLat.value = -11.8755;
      if (inputLng) inputLng.value = -77.0345;
      if (inputDesc) inputDesc.value = '';
    }

    modal.classList.remove('hidden');
    if (inputName) setTimeout(() => inputName.focus(), 100);
  }

  function closeCreateMapModal() {
    const modal = document.getElementById('modal-create-map-project');
    if (modal) modal.classList.add('hidden');
  }

  function setProjectCoordsPreset(lat, lng, district) {
    const inputLat = document.getElementById('maps-project-lat');
    const inputLng = document.getElementById('maps-project-lng');
    const inputDistrict = document.getElementById('maps-project-district');
    if (inputLat) inputLat.value = lat;
    if (inputLng) inputLng.value = lng;
    if (inputDistrict && (!inputDistrict.value || inputDistrict.value.trim() === '')) {
      inputDistrict.value = district;
    }
  }

  async function submitMapProjectForm() {
    const inputId = document.getElementById('maps-project-id');
    const name = document.getElementById('maps-project-name')?.value?.trim();
    const district = document.getElementById('maps-project-district')?.value?.trim() || '';
    const color = document.getElementById('maps-project-color')?.value || '#059669';
    const lat = parseFloat(document.getElementById('maps-project-lat')?.value) || -11.8755;
    const lng = parseFloat(document.getElementById('maps-project-lng')?.value) || -77.0345;
    const description = document.getElementById('maps-project-desc')?.value?.trim() || '';

    if (!name) {
      showToast('Por favor ingrese el nombre del mapa (ej: Mapa Zona Carabayllo).', 'error');
      return;
    }

    const editId = inputId ? inputId.value : '';
    const payload = {
      name,
      district,
      color,
      center: [lng, lat],
      zoom: 14,
      description,
    };

    try {
      let res;
      if (editId) {
        res = await fetch(`/api/maps/projects/${encodeURIComponent(editId)}?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/maps/projects?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Mapa guardado con éxito.', 'success');
        closeCreateMapModal();
        await loadMapsModule();
        // Si fue una creación nueva, entramos automáticamente al nuevo mapa
        if (!editId && json.project && json.project.id) {
          enterMapMode(json.project.id);
        }
      } else {
        showToast(json.message || 'Error al guardar el mapa.', 'error');
      }
    } catch (e) {
      showToast('Error de conexión al guardar el proyecto de mapa.', 'error');
    }
  }

  async function deleteMapProject(id) {
    const project = (state.projects || []).find(p => p.id === id);
    const mapName = project ? project.name : id;

    if (!confirm(`¿Está seguro de eliminar "${mapName}"?\nSe eliminarán todos sus puntos, líneas y áreas asociadas de forma permanente.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/maps/projects/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(state.tenantId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Mapa eliminado exitosamente.', 'info');
        await loadMapsModule();
      } else {
        showToast(json.message || 'Error al eliminar el mapa.', 'error');
      }
    } catch (e) {
      showToast('Error de red al eliminar el mapa.', 'error');
    }
  }

  // 5. ENTRAR AL MODO MAPA EXPANDIDO (AISLADO POR PROYECTO)
  async function enterMapMode(mapId, openLibrary = false) {
    if (mapId) {
      state.activeMapId = mapId;
      try {
        const res = await fetch(`/api/maps/projects/${encodeURIComponent(mapId)}/activate?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const json = await res.json();
        if (json.success) {
          if (json.data) state.data = json.data;
          if (json.stats) state.stats = json.stats;
          if (json.maps) state.projects = json.maps;
        }
      } catch (e) {
        console.warn('[MAPS] Error activando mapa:', e);
      }
    }

    const activeMap = getActiveMap();
    if (activeMap) {
      state.activeMapId = activeMap.id;
      // Sincronizar datos locales con el mapa seleccionado
      state.data.center = activeMap.center || state.data.center;
      state.data.zoom = activeMap.zoom || 14;
      state.data.nodes = activeMap.nodes || [];
      state.data.lines = activeMap.lines || [];
      state.data.areas = activeMap.areas || [];

      // Actualizar título en el toolbar superior del editor
      const titleEl = document.getElementById('maps-current-project-title');
      if (titleEl) {
        titleEl.textContent = activeMap.name || 'Mapa Activo';
      }

      // Actualizar encabezados de la biblioteca
      const libTitle = document.getElementById('maps-lib-map-title');
      if (libTitle) libTitle.textContent = `Biblioteca: ${activeMap.name}`;
      const libSubtitle = document.getElementById('maps-lib-map-subtitle');
      if (libSubtitle) {
        libSubtitle.textContent = `Elementos en ${activeMap.district || activeMap.name}`;
      }
    }

    state.activeMode = 'map';
    const overviewEl = document.getElementById('maps-overview-view');
    const editorEl = document.getElementById('maps-editor-view');
    if (overviewEl) overviewEl.classList.add('hidden');
    if (editorEl) editorEl.classList.remove('hidden');

    // Colapsar el sidebar automáticamente
    if (typeof window.applySidebarState === 'function') {
      window.applySidebarState(true);
    }

    // Inicializar Mapbox si no está montado
    initMapbox();

    if (state.map) {
      if (activeMap && activeMap.center && Array.isArray(activeMap.center)) {
        state.map.flyTo({
          center: activeMap.center,
          zoom: activeMap.zoom || 14,
          essential: true,
        });
      }
      renderAllMapLayers();
    }

    // Actualizar biblioteca y badges
    updateLibraryBadge();
    renderLibraryList();

    if (openLibrary) {
      setTimeout(() => {
        toggleLibraryDrawer(true);
      }, 350);
    }

    // Redimensionar el mapa tras el cambio de layout para asegurar 100% ancho y alto
    [50, 150, 300, 600, 1000].forEach(ms => {
      setTimeout(() => {
        if (state.map) state.map.resize();
      }, ms);
    });
  }

  // 6. SALIR DEL MODO MAPA EXPANDIDO Y VOLVER A LAS CARDS
  function exitMapMode() {
    state.activeMode = 'overview';
    const overviewEl = document.getElementById('maps-overview-view');
    const editorEl = document.getElementById('maps-editor-view');
    if (editorEl) editorEl.classList.add('hidden');
    if (overviewEl) overviewEl.classList.remove('hidden');

    // Cerrar biblioteca flotante si estaba abierta
    toggleLibraryDrawer(false);

    // Descolapsar sidebar si el usuario lo prefiere
    if (typeof window.applySidebarState === 'function') {
      window.applySidebarState(false);
    }

    // Actualizar cards y listado de proyectos con datos recientes
    renderOverviewCards();
    renderMapProjectsGrid();
    renderEntitiesTables();
  }

  // 7. INICIALIZAR MAPBOX GL JS
  function initMapbox() {
    const container = document.getElementById('mapbox-container');
    if (!container) return;

    if (state.map) {
      state.map.resize();
      renderAllMapLayers();
      return;
    }

    if (typeof mapboxgl === 'undefined') {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
          <svg class="w-12 h-12 text-amber-500 mb-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <h3 class="text-base font-bold text-white mb-1">Cargando Motor Mapbox GL...</h3>
          <p class="text-xs">Espere un instante mientras se inicializan los assets del mapa.</p>
        </div>
      `;
      return;
    }

    // Configurar Token de Mapbox desde Ajustes / Conexiones
    mapboxgl.accessToken = state.mapboxToken || '';

    try {
      const map = new mapboxgl.Map({
        container: 'mapbox-container',
        style: state.mapStyle || 'mapbox://styles/mapbox/satellite-streets-v12',
        center: state.data.center || [-77.0368, -12.0970],
        zoom: state.data.zoom || 14,
        attributionControl: false,
        trackResize: true,
        touchZoomRotate: true,
        touchPitch: true,
        fadeDuration: 0, // Elimina transiciones lentas de tile en GPUs móviles
        preserveDrawingBuffer: false, // Libera memoria RAM y GPU
        maxTileCacheSize: 50, // Límite eficiente para no saturar memoria en móviles
      });

      // Controles nativos no invasivos
      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');
      map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

      // Aceleración por hardware para el canvas del mapa
      const canvasEl = map.getCanvas();
      if (canvasEl) {
        canvasEl.style.transform = 'translate3d(0, 0, 0)';
        canvasEl.style.willChange = 'transform';
      }

      // Observador de cambio de dimensiones para ajustar el canvas automáticamente
      if (window.ResizeObserver && container) {
        const ro = new ResizeObserver(() => {
          if (state.map) state.map.resize();
        });
        ro.observe(container);
      }

      map.on('load', () => {
        state.map = map;
        state.isLoaded = true;

        // Fuentes GeoJSON para líneas y áreas
        initGeoJsonSources();

        // Renderizar marcadores, trazados y áreas
        renderAllMapLayers();

        // Eventos de clic sobre el mapa según herramienta activa
        setupMapEvents();

        // Banner informativo si no tiene token propio
        checkTokenBanner();
      });

      map.on('moveend', () => {
        const c = map.getCenter();
        state.data.center = [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))];
        state.data.zoom = Number(map.getZoom().toFixed(2));
      });
    } catch (err) {
      console.error('[MAPS] Error al inicializar Mapbox:', err);
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
          <p class="text-rose-500 font-bold mb-2">Error al iniciar mapa Mapbox</p>
          <p class="text-xs mb-4">Verifique su conexión o configure su Access Token en Configuración > Conexiones.</p>
          <button onclick="switchTab('config'); switchConfigSubTab('connections');" class="px-4 py-2 rounded-xl btn-brand-primary text-xs font-semibold">Ir a Conexiones & Pasarelas</button>
        </div>
      `;
    }
  }

  // 8. FUENTES GEOJSON PARA LÍNEAS Y POLÍGONOS
  function initGeoJsonSources() {
    const map = state.map;
    if (!map) return;

    // 1. Fuente y Capa de ÁREAS (Polígonos)
    if (!map.getSource('areas-source')) {
      map.addSource('areas-source', {
        type: 'geojson',
        data: getAreasGeoJson(),
      });

      map.addLayer({
        id: 'areas-fill-layer',
        type: 'fill',
        source: 'areas-source',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['get', 'fillOpacity'],
        },
      });

      map.addLayer({
        id: 'areas-stroke-layer',
        type: 'line',
        source: 'areas-source',
        paint: {
          'line-color': ['get', 'strokeColor'],
          'line-width': 2,
          'line-opacity': 0.85,
        },
      });
    }

    // 2. Fuente y Capa de LÍNEAS / CONECTORES (Fibra / Radio)
    if (!map.getSource('lines-source')) {
      map.addSource('lines-source', {
        type: 'geojson',
        data: getLinesGeoJson(),
      });

      map.addLayer({
        id: 'lines-layer',
        type: 'line',
        source: 'lines-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
        },
      });
    }

    // 3. Fuente temporal para dibujo en vivo (Regla / Trazado en progreso)
    if (!map.getSource('temp-draw-source')) {
      map.addSource('temp-draw-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'temp-draw-line',
        type: 'line',
        source: 'temp-draw-source',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 3,
          'line-dasharray': [2, 2],
        },
      });

      map.addLayer({
        id: 'temp-draw-points',
        type: 'circle',
        source: 'temp-draw-source',
        paint: {
          'circle-radius': 6,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }

  function getLinesGeoJson() {
    return {
      type: 'FeatureCollection',
      features: (state.data.lines || []).map(l => ({
        type: 'Feature',
        properties: {
          id: l.id,
          name: l.name,
          color: l.color || '#059669',
          width: l.width || 3,
          distanceMeters: l.distanceMeters,
          type: l.type,
          cores: l.cores,
        },
        geometry: {
          type: 'LineString',
          coordinates: l.coordinates,
        },
      })),
    };
  }

  function getAreasGeoJson() {
    return {
      type: 'FeatureCollection',
      features: (state.data.areas || []).map(a => {
        // Asegurar que el polígono esté cerrado
        let coords = a.coordinates.slice();
        if (coords.length > 0) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push(first);
          }
        }
        return {
          type: 'Feature',
          properties: {
            id: a.id,
            name: a.name,
            fillColor: a.fillColor || '#3b82f6',
            strokeColor: a.strokeColor || '#1d4ed8',
            fillOpacity: typeof a.fillOpacity === 'number' ? a.fillOpacity : 0.2,
            surfaceAreaKm2: a.surfaceAreaKm2,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coords],
          },
        };
      }),
    };
  }

  // 9. RENDERIZAR TODOS LOS MARCADORES Y ELEMENTOS
  function renderAllMapLayers() {
    if (!state.map) return;

    // Actualizar capas GeoJSON
    const linesSrc = state.map.getSource('lines-source');
    if (linesSrc) linesSrc.setData(getLinesGeoJson());

    const areasSrc = state.map.getSource('areas-source');
    if (areasSrc) areasSrc.setData(getAreasGeoJson());

    // Limpiar marcadores DOM existentes
    state.markers.forEach(m => m.remove());
    state.markers = [];

    // Renderizar Nodos / Puntos con icono y color personalizado
    if (state.visibleLayers.nodes) {
      (state.data.nodes || []).forEach(node => {
        const marker = createCustomNodeMarker(node);
        marker.addTo(state.map);
        state.markers.push(marker);
      });
    }

    // Renderizar Clientes con GPS si está activo el toggle
    renderCustomerMarkers();
  }

  // 10. CREAR MARCADOR PERSONALIZADO (COLOR E ICONO / IMAGEN) - 100% ESTABLE SIN DRIFTING
  function createCustomNodeMarker(node) {
    const el = document.createElement('div');
    // Root element for Mapbox: strict fixed size, pointer events, bottom flex alignment
    el.className = 'map-custom-marker-root cursor-pointer select-none';
    el.style.width = '32px';
    el.style.height = '36px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'flex-end';
    el.style.zIndex = '10';

    const iconDef = NODE_ICONS[node.type] || NODE_ICONS.custom;
    const color = node.color || '#2563eb';

    // Si tiene imagen personalizada (customImage) o icono externo
    let innerContent = '';
    const imgSource = node.customImage || (node.icon && (node.icon.startsWith('http') || node.icon.startsWith('data:image')) ? node.icon : null);
    if (imgSource) {
      innerContent = `<img src="${imgSource}" class="w-full h-full object-cover rounded-full" alt="Icon">`;
    } else {
      innerContent = `<div class="w-3.5 h-3.5 text-white">${iconDef.svg}</div>`;
    }

    // El hover scale y transiciones SOLO van en el contenedor interno hijo para no interferir con Mapbox
    el.innerHTML = `
      <div class="relative flex flex-col items-center group transition-transform duration-150 ease-out hover:scale-110" style="margin-bottom: 2px;">
        <!-- Badge con nombre flotante al hover -->
        <div class="absolute -top-7 px-2 py-0.5 rounded-md bg-slate-900/90 text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md border border-white/20">
          ${escapeHtml(node.name)}
        </div>
        <!-- Pin circular con halo de luz -->
        <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white flex-shrink-0" style="background-color: ${color}; box-shadow: 0 0 10px ${color}99;">
          ${innerContent}
        </div>
        <!-- Punta del pin -->
        <div class="w-2.5 h-2.5 transform rotate-45 -mt-1.5 border-r-2 border-b-2 border-white flex-shrink-0" style="background-color: ${color};"></div>
      </div>
    `;

    const photosList = Array.isArray(node.photos) ? node.photos : [];
    const photoCount = photosList.length;

    // Popup detallado interactivo de ALTO CONTRASTE (Modo Claro & Oscuro)
    const popupHtml = `
      <div class="w-72 bg-white dark:bg-[var(--surface-dark,#18181b)] rounded-2xl overflow-hidden shadow-2xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10">
        <!-- Header con gradiente suave del color del nodo -->
        <div class="p-3.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10" style="background: linear-gradient(135deg, ${color}20, transparent);">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 overflow-hidden" style="background-color: ${color}">
              ${imgSource ? `<img src="${imgSource}" class="w-full h-full object-cover">` : `<span class="w-4 h-4">${iconDef.svg}</span>`}
            </div>
            <div class="min-w-0">
              <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">${escapeHtml(node.name)}</h4>
              <span class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">${iconDef.name}</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[9.5px] font-bold flex-shrink-0 ${node.status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-500'}">
            ${node.status === 'active' ? 'Activo' : 'Mantenimiento'}
          </span>
        </div>

        <!-- Body de datos técnicos -->
        <div class="p-3.5 space-y-2 text-xs">
          <!-- Preview de foto o botón de fotos -->
          ${(imgSource || photoCount > 0) ? `
          <div class="flex items-center space-x-2.5 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/5">
            <div class="relative w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 flex-shrink-0 cursor-pointer" onclick="mapsModule.openLightbox('${imgSource || photosList[0].url}', 'Punto: ${escapeHtml(node.name)}')">
              <img src="${imgSource || photosList[0].thumbnail || photosList[0].url}" class="w-full h-full object-cover" alt="Foto">
            </div>
            <div class="flex-1 min-w-0">
              <span class="text-[10px] text-slate-400 font-semibold block">Fotos de Estado</span>
              <button type="button" onclick="mapsModule.openPhotosModal('${node.id}')" class="mt-0.5 px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-bold transition flex items-center space-x-1 shadow-xs">
                <span>📸 Historial (${photoCount})</span>
              </button>
            </div>
          </div>
          ` : `
          <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
            <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Fotos de Estado</span>
            <button type="button" onclick="mapsModule.openPhotosModal('${node.id}')" class="px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10.5px] font-bold transition border border-indigo-500/20">
              <span>+ Tomar Foto</span>
            </button>
          </div>
          `}

          <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
            <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Coordenadas</span>
            <button type="button" onclick="navigator.clipboard.writeText('${node.lat}, ${node.lng}'); showToast('Coordenadas copiadas al portapapeles', 'info');" class="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:text-blue-500 dark:hover:text-blue-400 transition flex items-center gap-1" title="Copiar coordenadas">
              <span>${node.lat.toFixed(5)}, ${node.lng.toFixed(5)}</span>
              <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </button>
          </div>
          ${node.capacity ? `
          <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
            <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Capacidad</span>
            <span class="font-bold text-slate-800 dark:text-slate-200 text-right">${escapeHtml(node.capacity)}</span>
          </div>
          ` : ''}
          ${node.address ? `
          <div class="py-1 border-b border-slate-100 dark:border-white/5">
            <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Dirección / Ref</span>
            <span class="text-[11px] text-slate-700 dark:text-slate-300 font-medium">${escapeHtml(node.address)}</span>
          </div>
          ` : ''}
          ${node.notes ? `
          <div class="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 text-[10.5px] text-slate-600 dark:text-slate-300 italic">
            "${escapeHtml(node.notes)}"
          </div>
          ` : ''}
        </div>

        <!-- Footer con Acciones (Editar, Fotos, Compartir, Eliminar) -->
        <div class="p-2.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-1">
          <div class="flex items-center space-x-1">
            ${can('maps:edit') ? `
            <button type="button" onclick="mapsModule.openEditNodeModal('${node.id}')" class="px-2 py-1.5 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-xs font-semibold flex items-center space-x-1 shadow-2xs transition">
              <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <span>Editar</span>
            </button>
            ` : `
            <button type="button" disabled class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5 text-xs font-semibold flex items-center space-x-1 opacity-40 cursor-not-allowed" title="Sin permiso de edición">
              <svg class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <span>Editar</span>
            </button>
            `}
            <button type="button" onclick="mapsModule.openPhotosModal('${node.id}')" class="px-2 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold flex items-center space-x-1 border border-indigo-500/20 transition" title="Línea de tiempo de fotos">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
              <span>Fotos</span>
            </button>
            <button type="button" onclick="mapsModule.openShareModal('node', '${node.id}')" class="px-2 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center space-x-1 border border-emerald-500/20 transition" title="Compartir por WhatsApp o Chat">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            </button>
          </div>
          ${can('maps:delete') ? `
          <button type="button" onclick="mapsModule.deleteNode('${node.id}')" class="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Eliminar Punto">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
          ` : `
          <button type="button" disabled class="p-1.5 rounded-xl text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed" title="Sin permiso de eliminación">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
          `}
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 25, closeButton: true }).setHTML(popupHtml);
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, 0] })
      .setLngLat([node.lng, node.lat])
      .setPopup(popup);

    // Evento al hacer clic en modo línea para conectar puntos
    el.addEventListener('click', (e) => {
      if (state.activeTool === 'line') {
        e.stopPropagation();
        handleLinePointClick([node.lng, node.lat], node.id);
      }
    });

    return marker;
  }

  // 11. MARCADORES DE CLIENTES DEL TENANT (OPCIONAL) - ESTABLES
  function renderCustomerMarkers() {
    state.customerMarkers.forEach(m => m.remove());
    state.customerMarkers = [];

    if (!state.visibleLayers.customers || !state.map) return;

    (state.customers || []).forEach(cust => {
      const el = document.createElement('div');
      el.className = 'cursor-pointer select-none';
      el.style.width = '24px';
      el.style.height = '24px';
      el.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md transition-transform duration-150 ease-out hover:scale-125">
          <span class="w-3 h-3 text-white">${NODE_ICONS.customer.svg}</span>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 15, closeButton: true }).setHTML(`
        <div class="p-3 text-xs text-slate-900 dark:text-white space-y-1.5 min-w-[200px]">
          <div class="font-bold flex items-center gap-1.5 text-sm text-slate-900 dark:text-white">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            ${escapeHtml(cust.name)}
          </div>
          <div class="text-[11px] text-slate-600 dark:text-slate-400">Plan: <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(cust.plan)}</span></div>
          <div class="text-[11px] text-slate-600 dark:text-slate-400">Dirección: <span class="font-medium text-slate-800 dark:text-slate-200">${escapeHtml(cust.address || '-')}</span></div>
          <div class="pt-2 border-t border-slate-100 dark:border-white/10 flex justify-end">
            <button type="button" onclick="mapsModule.openShareModal('customer', ${JSON.stringify(cust).replace(/"/g, '&quot;')})" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-500 transition">
              Compartir Ubicación
            </button>
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([cust.lng, cust.lat]).setPopup(popup);
      marker.addTo(state.map);
      state.customerMarkers.push(marker);
    });
  }

  // 12. EVENTOS DEL MAPA SEGÚN HERRAMIENTA ACTIVA
  function setupMapEvents() {
    const map = state.map;

    // Clic sobre el lienzo del mapa
    map.on('click', (e) => {
      const coords = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];

      if (state.activeTool === 'point') {
        if (!can('maps:create')) {
          showToast('Tu rol no tiene permiso para crear nuevos puntos.', 'error');
          return;
        }
        openCreateNodeModal(coords);
      } else if (state.activeTool === 'ruler') {
        handleRulerClick(coords);
      } else if (state.activeTool === 'line') {
        if (!can('maps:create')) return;
        handleLinePointClick(coords);
      } else if (state.activeTool === 'area') {
        if (!can('maps:create')) return;
        handleAreaPointClick(coords);
      }
    });

    // Clic derecho para deshacer el último vértice (estándar CAD / GIS)
    map.on('contextmenu', (e) => {
      if (['line', 'area', 'ruler'].includes(state.activeTool) && state.tempPoints.length > 0) {
        e.preventDefault();
        undoLastPoint();
        showToast('Último punto eliminado', 'info');
      }
    });

    // Atajos de teclado para eliminar puntos mientras se dibuja (Backspace, Delete, Ctrl+Z, Escape)
    if (!state.keyboardShortcutsBound) {
      window.addEventListener('keydown', (e) => {
        if (state.activeMode !== 'map') return;
        const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        if (['line', 'area', 'ruler'].includes(state.activeTool)) {
          if (e.key === 'Backspace' || e.key === 'Delete' || (e.ctrlKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            if (state.tempPoints.length > 0) {
              undoLastPoint();
              showToast('Último punto eliminado', 'info');
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setTool('select');
          }
        }
      });
      state.keyboardShortcutsBound = true;
    }

    // Clic en líneas para mostrar popup de alto contraste con Editar y Compartir
    map.on('click', 'lines-layer', (e) => {
      if (state.activeTool !== 'select') return;
      if (!e.features || !e.features[0]) return;
      const f = e.features[0];
      const p = f.properties;
      const line = (state.data.lines || []).find(l => l.id === p.id) || p;
      new mapboxgl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="w-72 bg-white dark:bg-[var(--surface-dark,#18181b)] rounded-2xl overflow-hidden shadow-2xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10">
            <!-- Header con color de fibra -->
            <div class="p-3.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10" style="background: linear-gradient(135deg, ${p.color}22, transparent);">
              <div class="flex items-center space-x-2.5 min-w-0">
                <div class="w-5 h-5 rounded-full flex-shrink-0" style="background-color: ${p.color}; box-shadow: 0 0 10px ${p.color};"></div>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(p.name)}</h4>
                  <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">${p.type || 'Fibra'} • ${p.cores ? p.cores + ' HILOS FO' : 'Cable'}</span>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Activo</span>
            </div>

            <!-- Body -->
            <div class="p-3.5 space-y-2 text-xs">
              <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Longitud</span>
                <span class="font-mono text-xs font-black text-slate-900 dark:text-white">${formatDistance(p.distanceMeters)}</span>
              </div>
              <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Hilos Ópticos</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">${p.cores || 12} Fibras</span>
              </div>
              <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Grosor de Trazo</span>
                <span class="font-medium text-slate-700 dark:text-slate-300">${p.width || 3}px (${p.style || 'solid'})</span>
              </div>
              ${line.notes ? `
              <div class="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 text-[10.5px] text-slate-600 dark:text-slate-300 italic">
                "${escapeHtml(line.notes)}"
              </div>
              ` : ''}
            </div>

            <!-- Footer con Acciones -->
            <div class="p-2.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-1.5">
              <div class="flex items-center space-x-1.5">
                ${can('maps:edit') ? `
                <button type="button" onclick="mapsModule.openEditLineModal('${p.id}')" class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-xs font-semibold flex items-center space-x-1 shadow-2xs transition">
                  <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span>Editar</span>
                </button>
                ` : `
                <button type="button" disabled class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5 text-xs font-semibold flex items-center space-x-1 opacity-40 cursor-not-allowed" title="Sin permiso de edición">
                  <svg class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span>Editar</span>
                </button>
                `}
                <button type="button" onclick="mapsModule.openShareModal('line', '${p.id}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center space-x-1 border border-emerald-500/20 transition" title="Compartir">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                  <span>Compartir</span>
                </button>
              </div>
              ${can('maps:delete') ? `
              <button type="button" onclick="mapsModule.deleteLine('${p.id}')" class="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Eliminar Línea">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              ` : `
              <button type="button" disabled class="p-1.5 rounded-xl text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed" title="Sin permiso de eliminación">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              `}
            </div>
          </div>
        `)
        .addTo(map);
    });

    // Clic en áreas para mostrar popup de alto contraste con Editar y Compartir
    map.on('click', 'areas-fill-layer', (e) => {
      if (state.activeTool !== 'select') return;
      if (!e.features || !e.features[0]) return;
      const f = e.features[0];
      const p = f.properties;
      const area = (state.data.areas || []).find(a => a.id === p.id) || p;
      new mapboxgl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="w-72 bg-white dark:bg-[var(--surface-dark,#18181b)] rounded-2xl overflow-hidden shadow-2xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10">
            <!-- Header con color de área -->
            <div class="p-3.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10" style="background: linear-gradient(135deg, ${p.fillColor}33, transparent);">
              <div class="flex items-center space-x-2.5 min-w-0">
                <div class="w-5 h-5 rounded-md border flex-shrink-0" style="background-color: ${p.fillColor}; border-color: ${p.strokeColor};"></div>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(p.name)}</h4>
                  <span class="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Polígono de Cobertura</span>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400">Servicio</span>
            </div>

            <!-- Body -->
            <div class="p-3.5 space-y-2 text-xs">
              <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Superficie Total</span>
                <span class="font-mono text-xs font-black text-slate-900 dark:text-white">${p.surfaceAreaKm2 || 0} km² <span class="text-[10px] text-slate-400 font-normal">(${((p.surfaceAreaKm2 || 0) * 100).toFixed(1)} ha)</span></span>
              </div>
              <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Abonados Objetivo</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">${area.targetCustomers ? area.targetCustomers + ' abonados' : 'Sector general'}</span>
              </div>
              <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span class="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">Opacidad</span>
                <span class="font-medium text-slate-700 dark:text-slate-300">${Math.round((p.fillOpacity || 0.2) * 100)}%</span>
              </div>
              ${area.notes ? `
              <div class="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 text-[10.5px] text-slate-600 dark:text-slate-300 italic">
                "${escapeHtml(area.notes)}"
              </div>
              ` : ''}
            </div>

            <!-- Footer con Acciones -->
            <div class="p-2.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-1.5">
              <div class="flex items-center space-x-1.5">
                ${can('maps:edit') ? `
                <button type="button" onclick="mapsModule.openEditAreaModal('${p.id}')" class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-xs font-semibold flex items-center space-x-1 shadow-2xs transition">
                  <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span>Editar</span>
                </button>
                ` : `
                <button type="button" disabled class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5 text-xs font-semibold flex items-center space-x-1 opacity-40 cursor-not-allowed" title="Sin permiso de edición">
                  <svg class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span>Editar</span>
                </button>
                `}
                <button type="button" onclick="mapsModule.openShareModal('area', '${p.id}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center space-x-1 border border-emerald-500/20 transition" title="Compartir">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                  <span>Compartir</span>
                </button>
              </div>
              ${can('maps:delete') ? `
              <button type="button" onclick="mapsModule.deleteArea('${p.id}')" class="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Eliminar Área">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              ` : `
              <button type="button" disabled class="p-1.5 rounded-xl text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed" title="Sin permiso de eliminación">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              `}
            </div>
          </div>
        `)
        .addTo(map);
    });

    // Puntero estilo manito al sobrevolar geometrías
    map.on('mouseenter', 'lines-layer', () => { if (state.activeTool === 'select') map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'lines-layer', () => { if (state.activeTool === 'select') map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'areas-fill-layer', () => { if (state.activeTool === 'select') map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'areas-fill-layer', () => { if (state.activeTool === 'select') map.getCanvas().style.cursor = ''; });
  }

  // 13. SELECCIONAR HERRAMIENTA FLOTANTE
  function setTool(tool) {
    if ((tool === 'point' || tool === 'line' || tool === 'area') && !can('maps:create')) {
      showToast('Tu rol solo tiene permiso de lectura. No puedes crear elementos.', 'error');
      return;
    }

    state.activeTool = tool;
    state.tempPoints = [];
    state.rulerDistanceMeters = 0;
    updateTempDraw();

    // Actualizar estilos activos de los botones de la barra flotante
    const tools = ['select', 'point', 'line', 'area', 'ruler'];
    tools.forEach(t => {
      const btn = document.getElementById(`maps-tool-${t}`);
      if (btn) {
        if (t === tool) {
          btn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
          btn.classList.remove('text-slate-600', 'hover:text-slate-900', 'hover:bg-slate-100', 'dark:text-slate-300', 'dark:hover:text-white', 'dark:hover:bg-white/10');
        } else {
          btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
          btn.classList.add('text-slate-600', 'hover:text-slate-900', 'hover:bg-slate-100', 'dark:text-slate-300', 'dark:hover:text-white', 'dark:hover:bg-white/10');
        }
      }
    });

    // Actualizar indicador flotante inferior
    const hudStatus = document.getElementById('maps-floating-status-pill');
    if (hudStatus) {
      if (tool === 'select') {
        hudStatus.classList.add('hidden');
      } else if (tool === 'point') {
        hudStatus.classList.remove('hidden');
        hudStatus.innerHTML = `
          <div class="flex items-center space-x-2 text-xs">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span class="text-slate-800 dark:text-white">Haga clic en el mapa para posicionar el <b>nuevo punto</b></span>
            <button type="button" onclick="mapsModule.setTool('select')" class="ml-2 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white transition">✕</button>
          </div>
        `;
      } else if (tool === 'ruler') {
        hudStatus.classList.remove('hidden');
        updateRulerHud();
      } else if (tool === 'line') {
        hudStatus.classList.remove('hidden');
        updateLineHud();
      } else if (tool === 'area') {
        hudStatus.classList.remove('hidden');
        updateAreaHud();
      }
    }

    if (state.map) {
      state.map.getCanvas().style.cursor = tool === 'select' ? '' : 'crosshair';
    }
  }

  // 14. GESTIÓN UNIVERSAL DE PUNTOS / VÉRTICES (LÍNEA, ÁREA, REGLA)
  function undoLastPoint() {
    if (state.tempPoints.length === 0) return;
    state.tempPoints.pop();
    if (state.activeTool === 'ruler') {
      let dist = 0;
      for (let i = 0; i < state.tempPoints.length - 1; i++) {
        dist += getDistanceMeters(state.tempPoints[i], state.tempPoints[i + 1]);
      }
      state.rulerDistanceMeters = dist;
      updateTempDraw();
      updateRulerHud();
    } else if (state.activeTool === 'line') {
      updateTempDraw();
      updateLineHud();
    } else if (state.activeTool === 'area') {
      updateTempDraw();
      updateAreaHud();
    }
  }

  function clearCurrentDraw() {
    state.tempPoints = [];
    state.rulerDistanceMeters = 0;
    updateTempDraw();
    if (state.activeTool === 'ruler') updateRulerHud();
    else if (state.activeTool === 'line') updateLineHud();
    else if (state.activeTool === 'area') updateAreaHud();
  }

  function undoRulerPoint() {
    undoLastPoint();
  }

  function resetRuler() {
    clearCurrentDraw();
  }

  // 15. HERRAMIENTA REGLA DE MEDICIÓN DE DISTANCIA
  function handleRulerClick(coords) {
    state.tempPoints.push(coords);

    // Calcular distancia acumulada
    let dist = 0;
    for (let i = 0; i < state.tempPoints.length - 1; i++) {
      dist += getDistanceMeters(state.tempPoints[i], state.tempPoints[i + 1]);
    }
    state.rulerDistanceMeters = dist;

    updateTempDraw();
    updateRulerHud();
  }

  function updateRulerHud() {
    const hudStatus = document.getElementById('maps-floating-status-pill');
    if (!hudStatus) return;
    hudStatus.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <div class="flex items-center space-x-1.5">
          <svg class="w-4 h-4 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          <span class="font-bold text-amber-600 dark:text-amber-400">Regla:</span>
        </div>
        <div class="font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm bg-slate-100 dark:bg-black/60 px-2.5 py-0.5 rounded-lg border border-amber-500/40 shadow-xs">
          ${formatDistance(state.rulerDistanceMeters)}
        </div>
        <span class="text-[11px] text-slate-500 dark:text-slate-300">(${state.tempPoints.length} ${state.tempPoints.length === 1 ? 'punto' : 'puntos'})</span>
        
        ${state.tempPoints.length > 0 ? `
        <button type="button" onclick="mapsModule.undoLastPoint()" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-[10.5px] font-semibold border border-slate-300/60 dark:border-white/10 transition active:scale-95" title="Deshacer último punto (o Clic Derecho / Backspace)">↩ Deshacer</button>
        <button type="button" onclick="mapsModule.clearCurrentDraw()" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-rose-600 dark:text-rose-400 text-[10.5px] font-semibold border border-slate-300/60 dark:border-white/10 transition active:scale-95" title="Reiniciar medición">🗑️ Limpiar</button>
        ` : ''}

        ${state.tempPoints.length >= 2 ? `
        ${can('maps:create') ? `
        <button type="button" onclick="mapsModule.openCreateLineModal(mapsModule.state.tempPoints.slice())" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold shadow-xs transition active:scale-95" title="Guardar esta medición como un trazado de fibra">💾 Guardar como Línea</button>
        ` : `
        <button type="button" disabled class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-40 cursor-not-allowed text-[10.5px] font-bold shadow-xs" title="Sin permiso para crear líneas">💾 Guardar como Línea</button>
        `}
        <button type="button" onclick="mapsModule.openShareModal('ruler', { distanceMeters: mapsModule.state.rulerDistanceMeters, coordinates: mapsModule.state.tempPoints.slice() })" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10.5px] font-bold shadow-xs transition active:scale-95" title="Compartir medición por WhatsApp o Chat">📤 Compartir</button>
        ` : ''}

        <button type="button" onclick="mapsModule.setTool('select')" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10.5px] font-bold transition active:scale-95">Finalizar</button>
      </div>
    `;
  }

  // 16. DIBUJO DE LÍNEA / CONECTOR
  function handleLinePointClick(coords, nodeId) {
    state.tempPoints.push(coords);
    updateTempDraw();
    updateLineHud();
  }

  function updateLineHud() {
    const hudStatus = document.getElementById('maps-floating-status-pill');
    if (!hudStatus) return;

    let dist = 0;
    for (let i = 0; i < state.tempPoints.length - 1; i++) {
      dist += getDistanceMeters(state.tempPoints[i], state.tempPoints[i + 1]);
    }

    hudStatus.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <div class="flex items-center space-x-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">Línea FO:</span>
        </div>
        ${state.tempPoints.length >= 2 ? `
        <div class="font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm bg-slate-100 dark:bg-black/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/40 shadow-xs">
          ${formatDistance(dist)}
        </div>
        ` : ''}
        <span class="text-[11px] text-slate-500 dark:text-slate-300">(${state.tempPoints.length} ${state.tempPoints.length === 1 ? 'punto' : 'puntos'})</span>

        ${state.tempPoints.length > 0 ? `
        <button type="button" onclick="mapsModule.undoLastPoint()" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-[10.5px] font-semibold border border-slate-300/60 dark:border-white/10 transition active:scale-95" title="Deshacer último punto (o Clic Derecho / Backspace)">↩ Deshacer</button>
        <button type="button" onclick="mapsModule.clearCurrentDraw()" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-rose-600 dark:text-rose-400 text-[10.5px] font-semibold border border-slate-300/60 dark:border-white/10 transition active:scale-95" title="Eliminar todos los puntos">🗑️ Limpiar</button>
        ` : `
        <span class="text-[11px] text-slate-400 dark:text-slate-400 hidden sm:inline">Haga clic en el mapa para marcar vértices</span>
        `}

        ${state.tempPoints.length >= 2 ? `
        ${can('maps:create') ? `
        <button type="button" onclick="mapsModule.finishLineDraw()" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold shadow-xs transition active:scale-95">💾 Guardar Conector</button>
        ` : `
        <button type="button" disabled class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-40 cursor-not-allowed text-[10.5px] font-bold shadow-xs" title="Sin permiso de creación">💾 Guardar Conector</button>
        `}
        ` : ''}

        <button type="button" onclick="mapsModule.setTool('select')" class="px-1.5 py-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs transition" title="Cancelar trazado">✕</button>
      </div>
    `;
  }

  function finishLineDraw() {
    if (state.tempPoints.length < 2) {
      showToast('Se requieren al menos 2 puntos para crear una línea o conector.', 'error');
      return;
    }
    openCreateLineModal(state.tempPoints.slice());
  }

  // 17. DIBUJO DE ÁREA / POLÍGONO
  function handleAreaPointClick(coords) {
    state.tempPoints.push(coords);
    updateTempDraw();
    updateAreaHud();
  }

  function updateAreaHud() {
    const hudStatus = document.getElementById('maps-floating-status-pill');
    if (!hudStatus) return;

    hudStatus.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <div class="flex items-center space-x-1.5">
          <span class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
          <span class="font-bold text-purple-600 dark:text-purple-400">Área de Cobertura:</span>
        </div>
        <div class="font-mono font-bold text-slate-900 dark:text-white text-xs sm:text-sm bg-slate-100 dark:bg-black/60 px-2.5 py-0.5 rounded-lg border border-purple-500/40 shadow-xs">
          ${state.tempPoints.length} vértices
        </div>

        ${state.tempPoints.length > 0 ? `
        <button type="button" onclick="mapsModule.undoLastPoint()" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-[10.5px] font-semibold border border-slate-300/60 dark:border-white/10 transition active:scale-95" title="Deshacer último vértice (o Clic Derecho / Backspace)">↩ Deshacer</button>
        <button type="button" onclick="mapsModule.clearCurrentDraw()" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-rose-600 dark:text-rose-400 text-[10.5px] font-semibold border border-slate-300/60 dark:border-white/10 transition active:scale-95" title="Eliminar todos los vértices">🗑️ Limpiar</button>
        ` : `
        <span class="text-[11px] text-slate-400 dark:text-slate-400 hidden sm:inline">Marque al menos 3 vértices en el mapa</span>
        `}

        ${state.tempPoints.length >= 3 ? `
        ${can('maps:create') ? `
        <button type="button" onclick="mapsModule.finishAreaDraw()" class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10.5px] font-bold shadow-xs transition active:scale-95">Completar Zona</button>
        ` : `
        <button type="button" disabled class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-40 cursor-not-allowed text-[10.5px] font-bold shadow-xs" title="Sin permiso de creación">Completar Zona</button>
        `}
        ` : (state.tempPoints.length > 0 ? `<span class="text-[10px] text-slate-500 dark:text-slate-400">(mínimo 3)</span>` : '')}

        <button type="button" onclick="mapsModule.setTool('select')" class="px-1.5 py-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs transition" title="Cancelar trazado">✕</button>
      </div>
    `;
  }

  function finishAreaDraw() {
    if (state.tempPoints.length < 3) {
      showToast('Se requieren al menos 3 vértices para formar un polígono de área.', 'error');
      return;
    }
    openCreateAreaModal(state.tempPoints.slice());
  }

  // 17. ACTUALIZAR FUENTE TEMPORAL DE DIBUJO EN VIVO
  function updateTempDraw() {
    if (!state.map) return;
    const src = state.map.getSource('temp-draw-source');
    if (!src) return;

    const features = [];
    if (state.tempPoints.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: state.tempPoints,
        },
      });
    }
    state.tempPoints.forEach(p => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: p,
        },
      });
    });

    src.setData({
      type: 'FeatureCollection',
      features,
    });
  }

  // 18. MODALES DE CREACIÓN Y EDICIÓN
  // Modal Nodo
  function openCreateNodeModal(coords) {
    state.editingNode = null;
    state.newNodePhotos = [];
    const modal = document.getElementById('maps-node-modal');
    if (!modal) return;

    document.getElementById('maps-node-modal-title').textContent = 'Crear Nuevo Punto / Nodo';
    document.getElementById('maps-node-name').value = '';
    document.getElementById('maps-node-type').value = 'nap';
    document.getElementById('maps-node-color').value = '#2563eb';
    document.getElementById('maps-node-icon-preview').innerHTML = NODE_ICONS.nap.svg;
    document.getElementById('maps-node-icon-url').value = '';
    document.getElementById('maps-node-lat').value = coords[1];
    document.getElementById('maps-node-lng').value = coords[0];
    document.getElementById('maps-node-capacity').value = '';
    document.getElementById('maps-node-address').value = '';
    document.getElementById('maps-node-notes').value = '';

    // Reset de imagen personalizada
    const customImgInput = document.getElementById('maps-node-custom-image-data');
    if (customImgInput) customImgInput.value = '';
    const customPreviewBox = document.getElementById('maps-node-custom-preview-box');
    if (customPreviewBox) customPreviewBox.classList.add('hidden');
    const customPreviewImg = document.getElementById('maps-node-custom-preview-img');
    if (customPreviewImg) customPreviewImg.src = '';

    renderColorPickerGrid('maps-node-color', '#2563eb');
    renderIconSelector('maps-node-type', 'nap');
    renderNewNodePhotosGrid();

    modal.classList.remove('hidden');
  }

  function openEditNodeModal(nodeId) {
    const node = (state.data.nodes || []).find(n => n.id === nodeId);
    if (!node) return;
    state.editingNode = node;
    state.newNodePhotos = [];

    const modal = document.getElementById('maps-node-modal');
    if (!modal) return;

    document.getElementById('maps-node-modal-title').textContent = `Editar Nodo: ${node.name}`;
    document.getElementById('maps-node-name').value = node.name;
    document.getElementById('maps-node-type').value = node.type || 'nap';
    document.getElementById('maps-node-color').value = node.color || '#2563eb';
    document.getElementById('maps-node-icon-url').value = (node.icon && node.icon.startsWith('http')) ? node.icon : '';
    document.getElementById('maps-node-lat').value = node.lat;
    document.getElementById('maps-node-lng').value = node.lng;
    document.getElementById('maps-node-capacity').value = node.capacity || '';
    document.getElementById('maps-node-address').value = node.address || '';
    document.getElementById('maps-node-notes').value = node.notes || '';

    // Imagen personalizada existente
    const customImgInput = document.getElementById('maps-node-custom-image-data');
    const customPreviewBox = document.getElementById('maps-node-custom-preview-box');
    const customPreviewImg = document.getElementById('maps-node-custom-preview-img');

    if (node.customImage) {
      if (customImgInput) customImgInput.value = node.customImage;
      if (customPreviewImg) customPreviewImg.src = node.customImage;
      if (customPreviewBox) customPreviewBox.classList.remove('hidden');
    } else {
      if (customImgInput) customImgInput.value = '';
      if (customPreviewImg) customPreviewImg.src = '';
      if (customPreviewBox) customPreviewBox.classList.add('hidden');
    }

    renderColorPickerGrid('maps-node-color', node.color || '#2563eb');
    renderIconSelector('maps-node-type', node.type || 'nap');
    renderNewNodePhotosGrid();

    modal.classList.remove('hidden');
  }

  async function saveNodeForm() {
    const name = document.getElementById('maps-node-name')?.value?.trim();
    const type = document.getElementById('maps-node-type')?.value;
    const color = document.getElementById('maps-node-color')?.value;
    const iconUrl = document.getElementById('maps-node-icon-url')?.value?.trim();
    const customImageData = document.getElementById('maps-node-custom-image-data')?.value?.trim();
    const lat = parseFloat(document.getElementById('maps-node-lat')?.value);
    const lng = parseFloat(document.getElementById('maps-node-lng')?.value);
    const capacity = document.getElementById('maps-node-capacity')?.value?.trim();
    const address = document.getElementById('maps-node-address')?.value?.trim();
    const notes = document.getElementById('maps-node-notes')?.value?.trim();

    if (!name || isNaN(lat) || isNaN(lng)) {
      showToast('Por favor ingrese el nombre y coordenadas válidas.', 'error');
      return;
    }

    const payload = {
      mapId: state.activeMapId,
      name,
      type,
      color,
      icon: iconUrl || type,
      customImage: customImageData || (iconUrl && (iconUrl.startsWith('http') || iconUrl.startsWith('data:image')) ? iconUrl : undefined),
      photos: state.editingNode ? (Array.isArray(state.editingNode.photos) ? state.editingNode.photos.concat(state.newNodePhotos) : state.newNodePhotos) : state.newNodePhotos,
      lat,
      lng,
      capacity,
      address,
      notes,
      status: 'active',
    };

    try {
      let res;
      if (state.editingNode) {
        res = await fetch(`/api/maps/nodes/${state.editingNode.id}?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/maps/nodes?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Punto guardado exitosamente.', 'success');
        closeModal('maps-node-modal');
        setTool('select');
        await loadMapsModule();
        const am = getActiveMap();
        if (am) {
          state.data.nodes = am.nodes || [];
        }
        renderAllMapLayers();
        renderLibraryList();
        updateLibraryBadge();
      } else {
        showToast(json.message || 'Error al guardar nodo', 'error');
      }
    } catch (e) {
      showToast('Error de red al guardar punto.', 'error');
    }
  }

  async function deleteNode(id) {
    if (!can('maps:delete')) {
      showToast('Tu rol no tiene permiso para eliminar puntos.', 'error');
      return;
    }
    if (!confirm('¿Confirma que desea eliminar este nodo del mapa?')) return;

    try {
      const res = await fetch(`/api/maps/nodes/${id}?tenantId=${encodeURIComponent(state.tenantId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast('Punto eliminado exitosamente.', 'info');
        await loadMapsModule();
        const am = getActiveMap();
        if (am) {
          state.data.nodes = am.nodes || [];
        }
        renderAllMapLayers();
        renderLibraryList();
        updateLibraryBadge();
      }
    } catch (e) {
      showToast('Error al eliminar punto.', 'error');
    }
  }

  // Modal Línea / Conector
  function openCreateLineModal(coords) {
    state.editingLine = null;
    const modal = document.getElementById('maps-line-modal');
    if (!modal) return;

    let dist = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      dist += getDistanceMeters(coords[i], coords[i + 1]);
    }

    const title = document.getElementById('maps-line-modal-title');
    if (title) title.textContent = 'Guardar Conector / Trazado de Fibra';

    document.getElementById('maps-line-name').value = `Troncal FO (${formatDistance(dist)})`;
    document.getElementById('maps-line-type').value = 'distribution';
    document.getElementById('maps-line-color').value = '#059669';
    document.getElementById('maps-line-width').value = '3';
    document.getElementById('maps-line-cores').value = '24';
    const notesEl = document.getElementById('maps-line-notes');
    if (notesEl) notesEl.value = '';
    document.getElementById('maps-line-dist-preview').textContent = formatDistance(dist);
    renderColorPickerGrid('maps-line-color', '#059669');

    state.tempPoints = coords;
    modal.classList.remove('hidden');
  }

  function openEditLineModal(lineId) {
    const line = (state.data.lines || []).find(l => l.id === lineId);
    if (!line) {
      showToast('Trazado no encontrado.', 'error');
      return;
    }
    state.editingLine = line;
    const modal = document.getElementById('maps-line-modal');
    if (!modal) return;

    const title = document.getElementById('maps-line-modal-title');
    if (title) title.textContent = `Editar Trazado: ${line.name}`;

    document.getElementById('maps-line-name').value = line.name || '';
    document.getElementById('maps-line-type').value = line.type || 'distribution';
    document.getElementById('maps-line-color').value = line.color || '#059669';
    document.getElementById('maps-line-width').value = line.width || 3;
    document.getElementById('maps-line-cores').value = line.cores || 24;
    const notesEl = document.getElementById('maps-line-notes');
    if (notesEl) notesEl.value = line.notes || '';
    document.getElementById('maps-line-dist-preview').textContent = formatDistance(line.distanceMeters || 0);
    renderColorPickerGrid('maps-line-color', line.color || '#059669');

    state.tempPoints = (line.coordinates || []).slice();
    modal.classList.remove('hidden');
  }

  async function saveLineForm() {
    const name = document.getElementById('maps-line-name')?.value?.trim();
    const type = document.getElementById('maps-line-type')?.value;
    const color = document.getElementById('maps-line-color')?.value;
    const width = parseInt(document.getElementById('maps-line-width')?.value) || 3;
    const cores = parseInt(document.getElementById('maps-line-cores')?.value) || 12;
    const notes = document.getElementById('maps-line-notes')?.value?.trim() || '';

    if (!name) {
      showToast('Ingrese un nombre válido para el conector.', 'error');
      return;
    }

    try {
      if (state.editingLine) {
        if (!can('maps:edit')) {
          showToast('No tienes permiso para editar líneas.', 'error');
          return;
        }
        const payload = {
          mapId: state.activeMapId,
          name,
          type,
          color,
          width,
          cores,
          notes,
          coordinates: state.editingLine.coordinates,
          style: state.editingLine.style || 'solid',
          status: state.editingLine.status || 'active',
        };
        const res = await fetch(`/api/maps/lines/${encodeURIComponent(state.editingLine.id)}?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message || 'Línea actualizada exitosamente.', 'success');
          closeModal('maps-line-modal');
          state.editingLine = null;
          await loadMapsModule();
          const am = getActiveMap();
          if (am) {
            state.data.lines = am.lines || [];
          }
          renderAllMapLayers();
          renderLibraryList();
          updateLibraryBadge();
        } else {
          showToast(json.message || 'Error al actualizar línea.', 'error');
        }
      } else {
        if (!can('maps:create')) {
          showToast('No tienes permiso para crear líneas.', 'error');
          return;
        }
        if (state.tempPoints.length < 2) {
          showToast('Se requieren al menos 2 puntos para crear una línea.', 'error');
          return;
        }
        const payload = {
          mapId: state.activeMapId,
          name,
          type,
          color,
          width,
          cores,
          notes,
          coordinates: state.tempPoints,
          style: 'solid',
          status: 'active',
        };
        const res = await fetch(`/api/maps/lines?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message || 'Línea guardada exitosamente.', 'success');
          closeModal('maps-line-modal');
          setTool('select');
          await loadMapsModule();
          const am = getActiveMap();
          if (am) {
            state.data.lines = am.lines || [];
          }
          renderAllMapLayers();
          renderLibraryList();
          updateLibraryBadge();
        } else {
          showToast(json.message || 'Error al guardar línea.', 'error');
        }
      }
    } catch (e) {
      showToast('Error de red al guardar línea.', 'error');
    }
  }

  async function deleteLine(id) {
    if (!can('maps:delete')) {
      showToast('No tienes permiso para eliminar trazados.', 'error');
      return;
    }
    if (!confirm('¿Confirma que desea eliminar este trazado de cableado?')) return;
    try {
      const res = await fetch(`/api/maps/lines/${id}?tenantId=${encodeURIComponent(state.tenantId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast('Trazado eliminado.', 'info');
        await loadMapsModule();
        const am = getActiveMap();
        if (am) {
          state.data.lines = am.lines || [];
        }
        renderAllMapLayers();
        renderLibraryList();
        updateLibraryBadge();
      }
    } catch (e) {
      showToast('Error al eliminar línea.', 'error');
    }
  }

  // Modal Área / Cobertura
  function openCreateAreaModal(coords) {
    state.editingArea = null;
    const modal = document.getElementById('maps-area-modal');
    if (!modal) return;

    const title = document.getElementById('maps-area-modal-title');
    if (title) title.textContent = 'Guardar Zona de Cobertura';

    document.getElementById('maps-area-name').value = 'Zona de Cobertura FTTH';
    document.getElementById('maps-area-fill').value = '#3b82f6';
    document.getElementById('maps-area-stroke').value = '#1d4ed8';
    document.getElementById('maps-area-opacity').value = '0.2';
    document.getElementById('maps-area-customers').value = '250';
    const notesEl = document.getElementById('maps-area-notes');
    if (notesEl) notesEl.value = '';
    renderColorPickerGrid('maps-area-fill', '#3b82f6');

    state.tempPoints = coords;
    modal.classList.remove('hidden');
  }

  function openEditAreaModal(areaId) {
    const area = (state.data.areas || []).find(a => a.id === areaId);
    if (!area) {
      showToast('Zona de cobertura no encontrada.', 'error');
      return;
    }
    state.editingArea = area;
    const modal = document.getElementById('maps-area-modal');
    if (!modal) return;

    const title = document.getElementById('maps-area-modal-title');
    if (title) title.textContent = `Editar Zona: ${area.name}`;

    document.getElementById('maps-area-name').value = area.name || '';
    document.getElementById('maps-area-fill').value = area.fillColor || '#3b82f6';
    document.getElementById('maps-area-stroke').value = area.strokeColor || '#1d4ed8';
    document.getElementById('maps-area-opacity').value = area.fillOpacity ?? 0.2;
    document.getElementById('maps-area-customers').value = area.targetCustomers || 0;
    const notesEl = document.getElementById('maps-area-notes');
    if (notesEl) notesEl.value = area.notes || '';
    renderColorPickerGrid('maps-area-fill', area.fillColor || '#3b82f6');

    state.tempPoints = (area.coordinates || []).slice();
    modal.classList.remove('hidden');
  }

  async function saveAreaForm() {
    const name = document.getElementById('maps-area-name')?.value?.trim();
    const fillColor = document.getElementById('maps-area-fill')?.value;
    const strokeColor = document.getElementById('maps-area-stroke')?.value || fillColor;
    const fillOpacity = parseFloat(document.getElementById('maps-area-opacity')?.value) || 0.2;
    const targetCustomers = parseInt(document.getElementById('maps-area-customers')?.value) || 0;
    const notes = document.getElementById('maps-area-notes')?.value?.trim() || '';

    if (!name) {
      showToast('Ingrese un nombre válido para la zona.', 'error');
      return;
    }

    try {
      if (state.editingArea) {
        if (!can('maps:edit')) {
          showToast('No tienes permiso para editar áreas.', 'error');
          return;
        }
        const payload = {
          mapId: state.activeMapId,
          name,
          fillColor,
          strokeColor,
          fillOpacity,
          targetCustomers,
          notes,
          coordinates: state.editingArea.coordinates,
          status: state.editingArea.status || 'active',
        };
        const res = await fetch(`/api/maps/areas/${encodeURIComponent(state.editingArea.id)}?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message || 'Zona actualizada exitosamente.', 'success');
          closeModal('maps-area-modal');
          state.editingArea = null;
          await loadMapsModule();
          const am = getActiveMap();
          if (am) {
            state.data.areas = am.areas || [];
          }
          renderAllMapLayers();
          renderLibraryList();
          updateLibraryBadge();
        } else {
          showToast(json.message || 'Error al actualizar zona.', 'error');
        }
      } else {
        if (!can('maps:create')) {
          showToast('No tienes permiso para crear áreas.', 'error');
          return;
        }
        if (state.tempPoints.length < 3) {
          showToast('Se requieren al menos 3 vértices para delimitar una zona.', 'error');
          return;
        }
        const payload = {
          mapId: state.activeMapId,
          name,
          fillColor,
          strokeColor,
          fillOpacity,
          targetCustomers,
          notes,
          coordinates: state.tempPoints,
          status: 'active',
        };
        const res = await fetch(`/api/maps/areas?tenantId=${encodeURIComponent(state.tenantId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message || 'Zona de cobertura guardada.', 'success');
          closeModal('maps-area-modal');
          setTool('select');
          await loadMapsModule();
          const am = getActiveMap();
          if (am) {
            state.data.areas = am.areas || [];
          }
          renderAllMapLayers();
          renderLibraryList();
          updateLibraryBadge();
        } else {
          showToast(json.message || 'Error al guardar área.', 'error');
        }
      }
    } catch (e) {
      showToast('Error de red al guardar área.', 'error');
    }
  }

  async function deleteArea(id) {
    if (!can('maps:delete')) {
      showToast('No tienes permiso para eliminar áreas.', 'error');
      return;
    }
    if (!confirm('¿Confirma que desea eliminar este polígono de cobertura?')) return;
    try {
      const res = await fetch(`/api/maps/areas/${id}?tenantId=${encodeURIComponent(state.tenantId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast('Área eliminada.', 'info');
        await loadMapsModule();
        const am = getActiveMap();
        if (am) {
          state.data.areas = am.areas || [];
        }
        renderAllMapLayers();
        renderLibraryList();
        updateLibraryBadge();
      }
    } catch (e) {
      showToast('Error al eliminar área.', 'error');
    }
  }

  // 19. ESTILOS Y CAPAS (Satelital, Calles, Oscuro)
  function setMapStyle(styleUri) {
    if (!state.map) return;
    state.mapStyle = styleUri;
    state.map.setStyle(styleUri);
    state.map.once('style.load', () => {
      initGeoJsonSources();
      renderAllMapLayers();
    });
    closePopover('maps-layers-popover');
    showToast('Estilo de mapa actualizado.', 'info');
  }

  function toggleLayer(layerKey) {
    state.visibleLayers[layerKey] = !state.visibleLayers[layerKey];
    renderAllMapLayers();

    // Actualizar checkbox
    const chk = document.getElementById(`maps-layer-toggle-${layerKey}`);
    if (chk) chk.checked = state.visibleLayers[layerKey];
  }

  // 20. BÚSQUEDA Y CENTRADO EN NODO O COORDENADAS
  function toggleSearchBar(forceOpen) {
    const wrapper = document.getElementById('maps-search-wrapper');
    const input = document.getElementById('maps-search-input');
    if (!wrapper) return;

    const willOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('is-expanded');
    if (willOpen) {
      wrapper.classList.add('is-expanded');
      setTimeout(() => {
        if (input) {
          input.focus();
          input.select();
        }
      }, 150);
    } else {
      wrapper.classList.remove('is-expanded');
      if (input) input.blur();
    }
  }

  function searchMapQuery(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return;

    // 1. Buscar en nodos
    const matchNode = (state.data.nodes || []).find(n => (n.name && n.name.toLowerCase().includes(q)) || (n.address && n.address.toLowerCase().includes(q)));
    if (matchNode && state.map) {
      state.map.flyTo({ center: [matchNode.lng, matchNode.lat], zoom: 16.5 });
      showToast(`Ubicado nodo: ${matchNode.name}`, 'info');
      return;
    }

    // 2. Buscar en clientes
    const matchCust = (state.customers || []).find(c => (c.name && c.name.toLowerCase().includes(q)) || (c.code && c.code.toLowerCase().includes(q)) || (c.address && c.address.toLowerCase().includes(q)));
    if (matchCust && state.map) {
      state.map.flyTo({ center: [matchCust.lng, matchCust.lat], zoom: 17 });
      showToast(`Ubicado cliente: ${matchCust.name}`, 'info');
      return;
    }

    // 3. Buscar en líneas de fibra
    const matchLine = (state.data.lines || []).find(l => l.name && l.name.toLowerCase().includes(q));
    if (matchLine && matchLine.coordinates && matchLine.coordinates.length > 0 && state.map) {
      const mid = matchLine.coordinates[Math.floor(matchLine.coordinates.length / 2)];
      state.map.flyTo({ center: mid, zoom: 16 });
      showToast(`Ubicado trazado: ${matchLine.name}`, 'info');
      return;
    }

    // 4. Buscar en zonas de cobertura
    const matchArea = (state.data.areas || []).find(a => a.name && a.name.toLowerCase().includes(q));
    if (matchArea && matchArea.coordinates && matchArea.coordinates.length > 0 && state.map) {
      state.map.flyTo({ center: matchArea.coordinates[0], zoom: 15.5 });
      showToast(`Ubicada zona: ${matchArea.name}`, 'info');
      return;
    }

    // 5. Coordenadas directas (lat, lng)
    const coordParts = q.split(/[\s,]+/);
    if (coordParts.length === 2) {
      const lat = parseFloat(coordParts[0]);
      const lng = parseFloat(coordParts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && state.map) {
        state.map.flyTo({ center: [lng, lat], zoom: 17 });
        showToast(`Coordenadas localizadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'info');
        return;
      }
    }

    showToast('No se encontró ningún nodo, cliente, trazado o zona con ese término.', 'warning');
  }

  // 21. COMPARTIR ELEMENTOS DE RED (WHATSAPP & CHAT INTERNO)
  async function openShareModal(type, target) {
    const modal = document.getElementById('maps-share-modal');
    const previewEl = document.getElementById('maps-share-preview-card');
    const waTextEl = document.getElementById('maps-share-wa-text');
    const chatTextEl = document.getElementById('maps-share-chat-text');
    if (!modal) return;
    closeModal('maps-photos-modal');

    let title = '';
    let subtitle = '';
    let typeLabel = '';
    let badgeClass = '';
    let accentColor = '#2563eb';
    let iconHtml = '';
    let lat = 0;
    let lng = 0;
    let gmapsUrl = '';
    let waMsg = '';
    let chatMsg = '';
    let locAttachment = null;

    if (type === 'node') {
      const node = typeof target === 'string' ? (state.data.nodes || []).find(n => n.id === target) : target;
      if (!node) {
        showToast('Elemento no encontrado.', 'error');
        return;
      }
      const iconDef = NODE_ICONS[node.type] || NODE_ICONS.nap;
      title = node.name || 'Nodo FTTH';
      subtitle = `${iconDef.name} • ${node.status === 'active' ? 'Operativo' : 'Mantenimiento'}`;
      typeLabel = 'Punto / Nodo';
      badgeClass = 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
      accentColor = node.color || '#2563eb';
      iconHtml = `<span class="w-5 h-5">${iconDef.svg}</span>`;
      lat = Number(node.lat);
      lng = Number(node.lng);
      gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      locAttachment = { lat, lng, address: node.address || node.name };

      waMsg = `🌐 *TURBONETWORK - REPORTE DE RED FTTH*\n` +
              `📍 *Elemento:* ${node.name} (${iconDef.name})\n` +
              (node.capacity ? `🔌 *Capacidad:* ${node.capacity}\n` : '') +
              (node.address ? `🏠 *Dirección/Ref:* ${node.address}\n` : '') +
              `📌 *Coordenadas:* ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
              (node.notes ? `📝 *Notas:* ${node.notes}\n` : '') +
              `🗺️ *Ver en Google Maps:* ${gmapsUrl}\n` +
              `🏢 *Sede:* ${state.tenantId}`;

      chatMsg = `📍 [NODO] ${node.name} (${iconDef.name})\n` +
                (node.capacity ? `Capacidad: ${node.capacity} | ` : '') +
                `Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
                (node.address ? `Dirección: ${node.address}\n` : '') +
                (node.notes ? `Notas: ${node.notes}` : '');

    } else if (type === 'line') {
      const line = typeof target === 'string' ? (state.data.lines || []).find(l => l.id === target) : target;
      if (!line) {
        showToast('Trazado no encontrado.', 'error');
        return;
      }
      title = line.name || 'Trazado de Fibra';
      subtitle = `${line.type || 'Troncal'} • ${line.cores || 12} Hilos FO • ${formatDistance(line.distanceMeters || 0)}`;
      typeLabel = 'Línea de Fibra';
      badgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
      accentColor = line.color || '#059669';
      iconHtml = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
      
      const coords = line.coordinates || [];
      const midCoord = coords.length > 0 ? coords[Math.floor(coords.length / 2)] : [0, 0];
      lng = Number(midCoord[0]);
      lat = Number(midCoord[1]);
      gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      locAttachment = { lat, lng, address: `Trazado FO: ${line.name} (${formatDistance(line.distanceMeters || 0)})` };

      waMsg = `🌐 *TURBONETWORK - TRAZADO DE FIBRA ÓPTICA*\n` +
              `🔌 *Trazado:* ${line.name}\n` +
              `📏 *Longitud:* ${formatDistance(line.distanceMeters || 0)}\n` +
              `🧵 *Hilos FO:* ${line.cores || 12} hilos\n` +
              `🎨 *Color de trazo:* ${line.color || '#059669'}\n` +
              (line.notes ? `📝 *Notas:* ${line.notes}\n` : '') +
              `📌 *Punto Medio:* ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
              `🗺️ *Ver en Google Maps:* ${gmapsUrl}\n` +
              `🏢 *Sede:* ${state.tenantId}`;

      chatMsg = `🔌 [LÍNEA FIBRA] ${line.name}\n` +
                `Longitud: ${formatDistance(line.distanceMeters || 0)} | ${line.cores || 12} hilos FO\n` +
                `Punto de ref: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
                (line.notes ? `Notas: ${line.notes}` : '');

    } else if (type === 'area') {
      const area = typeof target === 'string' ? (state.data.areas || []).find(a => a.id === target) : target;
      if (!area) {
        showToast('Zona no encontrada.', 'error');
        return;
      }
      title = area.name || 'Zona de Cobertura';
      subtitle = `Superficie: ${area.surfaceAreaKm2 || 0} km² • ${area.targetCustomers || 0} abonados proyectados`;
      typeLabel = 'Área de Cobertura';
      badgeClass = 'bg-purple-500/15 text-purple-600 dark:text-purple-400';
      accentColor = area.fillColor || '#7c3aed';
      iconHtml = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon></svg>`;

      const coords = area.coordinates || [];
      const firstCoord = coords.length > 0 ? coords[0] : [0, 0];
      lng = Number(firstCoord[0]);
      lat = Number(firstCoord[1]);
      gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      locAttachment = { lat, lng, address: `Zona de Cobertura: ${area.name}` };

      waMsg = `🌐 *TURBONETWORK - ÁREA DE COBERTURA*\n` +
              `🗺️ *Zona:* ${area.name}\n` +
              `📐 *Superficie:* ${area.surfaceAreaKm2 || 0} km² (${((area.surfaceAreaKm2 || 0) * 100).toFixed(1)} ha)\n` +
              `👥 *Abonados Proyectados:* ${area.targetCustomers || 0}\n` +
              (area.notes ? `📝 *Notas:* ${area.notes}\n` : '') +
              `📌 *Punto Referencia:* ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
              `🗺️ *Ver en Google Maps:* ${gmapsUrl}\n` +
              `🏢 *Sede:* ${state.tenantId}`;

      chatMsg = `🗺️ [ÁREA COBERTURA] ${area.name}\n` +
                `Superficie: ${area.surfaceAreaKm2 || 0} km² | Proyectados: ${area.targetCustomers || 0} clientes\n` +
                `Referencia: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
                (area.notes ? `Notas: ${area.notes}` : '');

    } else if (type === 'ruler') {
      const rulerData = target || { distanceMeters: state.rulerDistanceMeters, coordinates: state.tempPoints.slice() };
      const distFormatted = formatDistance(rulerData.distanceMeters || 0);
      const coords = rulerData.coordinates || [];
      const ptsCount = coords.length;
      const startCoord = coords.length > 0 ? coords[0] : [0, 0];
      const endCoord = coords.length > 1 ? coords[coords.length - 1] : startCoord;

      title = `Medición: ${distFormatted}`;
      subtitle = `${ptsCount} tramos de medición calculados`;
      typeLabel = 'Regla de Medición';
      badgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      accentColor = '#d97706';
      iconHtml = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`;

      lat = Number(startCoord[1]);
      lng = Number(startCoord[0]);
      gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      locAttachment = { lat, lng, address: `Medición Regla: ${distFormatted}` };

      waMsg = `📏 *TURBONETWORK - MEDICIÓN DE DISTANCIA*\n` +
              `⚡ *Distancia Calculada:* ${distFormatted}\n` +
              `📍 *Vértices medidos:* ${ptsCount} puntos\n` +
              `🟢 *Punto Inicial:* ${startCoord[1]}, ${startCoord[0]}\n` +
              `🔴 *Punto Final:* ${endCoord[1]}, ${endCoord[0]}\n` +
              `🗺️ *Ver en Google Maps:* ${gmapsUrl}\n` +
              `🏢 *Sede:* ${state.tenantId}`;

      chatMsg = `📏 [MEDICIÓN REGLA] Distancia: ${distFormatted} (${ptsCount} puntos)\n` +
                `Inicio: ${startCoord[1]}, ${startCoord[0]}\n` +
                `Fin: ${endCoord[1]}, ${endCoord[0]}`;

    } else if (type === 'customer') {
      const cust = target || {};
      title = cust.name || 'Cliente FTTH';
      subtitle = `Plan: ${cust.plan || 'Internet'} • Estado: Activo`;
      typeLabel = 'Cliente Abonado';
      badgeClass = 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400';
      accentColor = '#06b6d4';
      iconHtml = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`;

      lat = Number(cust.lat);
      lng = Number(cust.lng);
      gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      locAttachment = { lat, lng, address: cust.address || cust.name };

      waMsg = `🌐 *TURBONETWORK - UBICACIÓN DE CLIENTE*\n` +
              `👤 *Cliente:* ${cust.name}\n` +
              `📦 *Plan:* ${cust.plan || 'Internet Fibra'}\n` +
              (cust.address ? `🏠 *Dirección:* ${cust.address}\n` : '') +
              `📌 *Coordenadas:* ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
              `🗺️ *Ver en Google Maps:* ${gmapsUrl}\n` +
              `🏢 *Sede:* ${state.tenantId}`;

      chatMsg = `👤 [CLIENTE] ${cust.name} - Plan: ${cust.plan || 'Internet'}\n` +
                (cust.address ? `Dirección: ${cust.address}\n` : '') +
                `Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    state.shareTarget = {
      type,
      title,
      subtitle,
      location: locAttachment,
      gmapsUrl,
    };

    if (previewEl) {
      previewEl.innerHTML = `
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0" style="background-color: ${accentColor}">
            ${iconHtml}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(title)}</h4>
              <span class="px-2 py-0.5 rounded-full text-[9.5px] font-bold ${badgeClass}">${typeLabel}</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(subtitle)}</p>
          </div>
        </div>
      `;
    }

    if (waTextEl) waTextEl.value = waMsg;
    if (chatTextEl) chatTextEl.value = chatMsg;

    // Resetear a tab de WhatsApp por defecto
    switchShareTab('wa');

    // Cargar conversaciones disponibles para el tab de chat
    loadShareConversations();

    modal.classList.remove('hidden');
  }

  async function loadShareConversations() {
    const select = document.getElementById('maps-share-chat-select');
    if (!select) return;
    select.innerHTML = '<option value="">Cargando conversaciones activas...</option>';

    try {
      const res = await fetch(`/api/messages/conversations?tenantId=${encodeURIComponent(state.tenantId)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        state.shareConversations = json.data;
        select.innerHTML = json.data.map(c => `
          <option value="${c.id}">${escapeHtml(c.name || 'Conversación')} (${escapeHtml(c.phone || c.type || 'Chat')})</option>
        `).join('');
      } else {
        select.innerHTML = '<option value="">No hay conversaciones activas en este Tenant</option>';
      }
    } catch (e) {
      select.innerHTML = '<option value="">Error al cargar conversaciones</option>';
    }
  }

  function switchShareTab(tab) {
    const btnWa = document.getElementById('maps-share-tab-wa');
    const btnChat = document.getElementById('maps-share-tab-chat');
    const panelWa = document.getElementById('maps-share-panel-wa');
    const panelChat = document.getElementById('maps-share-panel-chat');

    if (tab === 'wa') {
      panelWa?.classList.remove('hidden');
      panelChat?.classList.add('hidden');
      btnWa?.classList.add('bg-emerald-600', 'text-white', 'shadow-sm');
      btnWa?.classList.remove('text-slate-600', 'dark:text-slate-400');
      btnChat?.classList.remove('btn-brand-primary', 'bg-blue-600', 'text-white', 'shadow-sm');
      btnChat?.classList.add('text-slate-600', 'dark:text-slate-400');
    } else {
      panelWa?.classList.add('hidden');
      panelChat?.classList.remove('hidden');
      btnChat?.classList.add('btn-brand-primary', 'bg-blue-600', 'text-white', 'shadow-sm');
      btnChat?.classList.remove('text-slate-600', 'dark:text-slate-400');
      btnWa?.classList.remove('bg-emerald-600', 'text-white', 'shadow-sm');
      btnWa?.classList.add('text-slate-600', 'dark:text-slate-400');
    }
  }

  function sendShareWhatsApp() {
    const rawPhone = document.getElementById('maps-share-wa-phone')?.value || '';
    const phone = rawPhone.replace(/\D/g, '');
    const text = document.getElementById('maps-share-wa-text')?.value || '';

    if (!text.trim()) {
      showToast('El mensaje no puede estar vacío.', 'error');
      return;
    }

    let url = '';
    if (phone) {
      url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }

    window.open(url, '_blank');
    closeModal('maps-share-modal');
    showToast('Abriendo WhatsApp...', 'success');
  }

  async function sendShareChat() {
    const convId = document.getElementById('maps-share-chat-select')?.value;
    const text = document.getElementById('maps-share-chat-text')?.value?.trim();
    const attachLoc = document.getElementById('maps-share-chat-attach-loc')?.checked;
    const sendBtn = document.getElementById('maps-share-chat-send-btn');

    if (!convId) {
      showToast('Seleccione una conversación de destino.', 'error');
      return;
    }
    if (!text) {
      showToast('El mensaje no puede estar vacío.', 'error');
      return;
    }

    const payload = {
      text,
    };

    if (attachLoc && state.shareTarget && state.shareTarget.location) {
      payload.attachment = {
        type: 'location',
        lat: state.shareTarget.location.lat,
        lng: state.shareTarget.location.lng,
        address: state.shareTarget.location.address || '',
      };
    }

    try {
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="animate-spin mr-1">⌛</span> Enviando...';
      }

      const res = await fetch(`/api/messages/conversations/${encodeURIComponent(convId)}/messages?tenantId=${encodeURIComponent(state.tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast('Ubicación compartida exitosamente en el chat interno.', 'success');
        closeModal('maps-share-modal');
      } else {
        showToast(json.message || 'Error al enviar mensaje al chat.', 'error');
      }
    } catch (e) {
      showToast('Error de red al enviar al chat.', 'error');
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          <span>Enviar al Chat Interno</span>
        `;
      }
    }
  }

  function saveRulerAsLine() {
    if (state.tempPoints.length < 2) {
      showToast('Se requieren al menos 2 puntos medidos para guardar como línea.', 'error');
      return;
    }
    openCreateLineModal(state.tempPoints.slice());
  }

  function centerOnUserLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocalización no soportada en este navegador.', 'error');
      return;
    }
    showToast('Obteniendo ubicación GPS...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        if (state.map) {
          state.map.flyTo({ center: coords, zoom: 16 });
          showToast('Mapa centrado en su ubicación GPS.', 'success');
        }
      },
      (err) => {
        showToast('No se pudo obtener la ubicación GPS (permiso denegado).', 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function openMapFocused(coords, zoom = 16) {
    enterMapMode();
    setTimeout(() => {
      if (state.map) state.map.flyTo({ center: coords, zoom });
    }, 300);
  }

  function focusLine(lineId) {
    const line = (state.data.lines || []).find(l => l.id === lineId);
    if (!line || !line.coordinates || line.coordinates.length === 0) return;
    openMapFocused(line.coordinates[0], 16);
  }

  function focusArea(areaId) {
    const area = (state.data.areas || []).find(a => a.id === areaId);
    if (!area || !area.coordinates || area.coordinates.length === 0) return;
    openMapFocused(area.coordinates[0], 15.5);
  }

  // 21. EXPORTACIÓN GEOJSON
  function exportGeoJson() {
    const collection = {
      type: 'FeatureCollection',
      features: [
        ...getLinesGeoJson().features,
        ...getAreasGeoJson().features,
        ...(state.data.nodes || []).map(n => ({
          type: 'Feature',
          properties: {
            id: n.id,
            name: n.name,
            type: n.type,
            color: n.color,
            capacity: n.capacity,
          },
          geometry: {
            type: 'Point',
            coordinates: [n.lng, n.lat],
          },
        })),
      ],
    };

    const str = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(collection, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', str);
    dlAnchor.setAttribute('download', `red_ftth_${state.tenantId}_${new Date().toISOString().slice(0, 10)}.geojson`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Capa GeoJSON descargada correctamente.', 'success');
  }

  // 22. UTILERÍAS DE UI
  function updatePermissionsUI() {
    const isEditor = can('maps:create') || can('maps:edit');
    const badge = document.getElementById('maps-permission-badge');
    if (badge) {
      badge.textContent = isEditor ? 'Modo Edición' : 'Solo Lectura';
      badge.className = isEditor
        ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30';
    }

    const hasCreate = can('maps:create');
    const createBtns = document.querySelectorAll('.maps-create-action');
    createBtns.forEach(b => {
      b.style.display = '';
      if (hasCreate) {
        b.removeAttribute('disabled');
        b.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
        if (b.dataset.origTitle) b.title = b.dataset.origTitle;
      } else {
        b.setAttribute('disabled', 'true');
        b.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
        if (!b.dataset.origTitle && b.title) b.dataset.origTitle = b.title;
        b.title = 'Sin permiso para crear elementos en el mapa';
      }
    });

    const hasEdit = can('maps:edit');
    const editBtns = document.querySelectorAll('.maps-edit-action');
    editBtns.forEach(b => {
      b.style.display = '';
      if (hasEdit) {
        b.removeAttribute('disabled');
        b.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
        if (b.dataset.origTitle) b.title = b.dataset.origTitle;
      } else {
        b.setAttribute('disabled', 'true');
        b.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
        if (!b.dataset.origTitle && b.title) b.dataset.origTitle = b.title;
        b.title = 'Sin permiso para editar elementos en el mapa';
      }
    });
  }

  function renderColorPickerGrid(targetInputId, currentHex) {
    const container = document.getElementById(`${targetInputId}-grid`);
    if (!container) return;

    container.innerHTML = COLOR_PALETTE.map(c => `
      <button type="button" onclick="document.getElementById('${targetInputId}').value = '${c.hex}'; mapsModule.renderColorPickerGrid('${targetInputId}', '${c.hex}');" 
        class="w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110 ${c.hex === currentHex ? 'border-white ring-2 ring-blue-500 scale-110' : 'border-transparent'}" 
        style="background-color: ${c.hex};" title="${c.name}">
      </button>
    `).join('');
  }

  function renderIconSelector(targetSelectId, currentType) {
    const container = document.getElementById('maps-node-icon-selector');
    if (!container) return;

    container.innerHTML = Object.entries(NODE_ICONS).map(([key, item]) => `
      <button type="button" onclick="document.getElementById('${targetSelectId}').value = '${key}'; document.getElementById('maps-node-icon-preview').innerHTML = mapsModule.NODE_ICONS['${key}'].svg; mapsModule.renderIconSelector('${targetSelectId}', '${key}');" 
        class="flex flex-col items-center justify-center p-2 rounded-xl border text-xs transition ${key === currentType ? 'border-blue-500 bg-blue-500/15 text-blue-400 font-bold' : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400'}">
        <div class="w-5 h-5 mb-1">${item.svg}</div>
        <span class="text-[9.5px] truncate w-full text-center">${item.name}</span>
      </button>
    `).join('');
  }

  function checkTokenBanner() {
    const banner = document.getElementById('maps-missing-token-banner');
    if (banner) {
      if (!state.mapboxToken) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('hidden');
  }

  function togglePopover(popoverId) {
    const p = document.getElementById(popoverId);
    if (p) p.classList.toggle('hidden');
  }

  function closePopover(popoverId) {
    const p = document.getElementById(popoverId);
    if (p) p.classList.add('hidden');
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ========================================================
  // 21. SISTEMA DE FOTOS, MARCA DE AGUA & BIBLIOTECA GIS
  // ========================================================

  function getActiveTenantName() {
    const tenantBadge = document.getElementById('maps-tenant-badge-map') || document.getElementById('maps-tenant-badge');
    if (tenantBadge && tenantBadge.textContent) return tenantBadge.textContent.trim();
    if (typeof window.activeTenantId !== 'undefined' && typeof window.tenantsList !== 'undefined') {
      const t = window.tenantsList.find(x => x.id === window.activeTenantId);
      if (t && t.name) return t.name;
    }
    return state.tenantId || 'TurboNetwork Perú';
  }

  function getActiveUserName() {
    const userEl = document.getElementById('sidebar-user-name');
    if (userEl && userEl.textContent && userEl.textContent !== '--') return userEl.textContent.trim();
    if (typeof window.currentUser !== 'undefined' && window.currentUser && window.currentUser.name) {
      return window.currentUser.name;
    }
    return 'Operador FTTH';
  }

  /**
   * Genera foto con Marca de Agua indeleble grabada con Canvas HTML5
   * - Tenant / Empresa activa
   * - Coordenadas GPS (Latitud, Longitud)
   * - Fecha y hora local
   * - Usuario / Operador autenticado
   * - Optimización fluida para dispositivos móviles
   */
  async function generateWatermarkedPhoto(fileOrBlob, metadata) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            // Máximo 1600px para calidad nítida sin agotar memoria móvil ni red
            const maxDim = 1600;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Dibujar imagen original
            ctx.drawImage(img, 0, 0, w, h);

            // Metadatos
            const now = new Date();
            const dateFormatted = metadata.dateFormatted || now.toLocaleString('es-PE', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const tenantName = metadata.tenantName || getActiveTenantName();
            const userName = metadata.userName || getActiveUserName();
            const lat = typeof metadata.lat === 'number' ? metadata.lat.toFixed(6) : (metadata.lat || '--');
            const lng = typeof metadata.lng === 'number' ? metadata.lng.toFixed(6) : (metadata.lng || '--');
            const notes = (metadata.notes || '').trim();

            // Altura del banner inferior
            const bannerHeight = Math.max(90, Math.round(h * 0.13));
            const bannerY = h - bannerHeight;

            // Fondo translúcido con gradiente de contraste
            const grad = ctx.createLinearGradient(0, bannerY, 0, h);
            grad.addColorStop(0, 'rgba(15, 23, 42, 0.82)');
            grad.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, bannerY, w, bannerHeight);

            // Borde superior azul brillante
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(0, bannerY, w, Math.max(3, Math.round(h * 0.004)));

            // Sombra para contraste garantizado
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            const baseFontSize = Math.max(13, Math.round(w * 0.016));
            const titleFontSize = Math.max(15, Math.round(w * 0.019));

            // Línea 1: Empresa + Badge
            ctx.font = `bold ${titleFontSize}px "Inter", "Segoe UI", sans-serif`;
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`🏢 ${tenantName.toUpperCase()}`, 24, bannerY + (bannerHeight * 0.32));

            ctx.font = `bold ${Math.round(baseFontSize * 0.9)}px "Inter", "Segoe UI", sans-serif`;
            ctx.fillStyle = '#4ade80';
            const verifiedText = '✓ GPS CERTIFICADO';
            const verifiedWidth = ctx.measureText(verifiedText).width;
            ctx.fillText(verifiedText, w - verifiedWidth - 24, bannerY + (bannerHeight * 0.32));

            // Línea 2: Coords y Fecha
            ctx.font = `600 ${baseFontSize}px "Inter", "Segoe UI", sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`📍 Coords: ${lat}, ${lng}   |   📅 ${dateFormatted}`, 24, bannerY + (bannerHeight * 0.62));

            // Línea 3: Operador y Nota
            ctx.font = `500 ${Math.round(baseFontSize * 0.95)}px "Inter", "Segoe UI", sans-serif`;
            ctx.fillStyle = '#cbd5e1';
            const opText = `👤 Operador: ${userName}${notes ? `   |   📝 ${notes}` : ''}`;
            ctx.fillText(opText, 24, bannerY + (bannerHeight * 0.88));

            // Exportar data URL JPEG
            const fullDataUrl = canvas.toDataURL('image/jpeg', 0.84);

            // Generar miniatura rápida para timeline
            const thumbCanvas = document.createElement('canvas');
            const thumbW = 240;
            const thumbH = Math.round((h * thumbW) / w);
            thumbCanvas.width = thumbW;
            thumbCanvas.height = thumbH;
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
            const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);

            resolve({
              id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              url: fullDataUrl,
              thumbnail: thumbDataUrl,
              timestamp: now.toISOString(),
              dateFormatted,
              user: userName,
              tenantName,
              lat: typeof metadata.lat === 'number' ? metadata.lat : parseFloat(lat) || 0,
              lng: typeof metadata.lng === 'number' ? metadata.lng : parseFloat(lng) || 0,
              notes,
            });
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
  }

  // Manejo de imagen personalizada de punto (PC o Cámara)
  function handleCustomNodeImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionar para icono de pin en mapa (avatar optimizado)
        const maxDim = 350;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);

        const input = document.getElementById('maps-node-custom-image-data');
        const previewBox = document.getElementById('maps-node-custom-preview-box');
        const previewImg = document.getElementById('maps-node-custom-preview-img');

        if (input) input.value = compressed;
        if (previewImg) previewImg.src = compressed;
        if (previewBox) previewBox.classList.remove('hidden');

        showToast('Foto del marcador cargada con éxito', 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeCustomNodeImage() {
    const input = document.getElementById('maps-node-custom-image-data');
    const previewBox = document.getElementById('maps-node-custom-preview-box');
    const previewImg = document.getElementById('maps-node-custom-preview-img');
    if (input) input.value = '';
    if (previewImg) previewImg.src = '';
    if (previewBox) previewBox.classList.add('hidden');
  }

  // Galería de fotos iniciales en creación / edición de punto
  async function handleInitialNodePhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const lat = parseFloat(document.getElementById('maps-node-lat')?.value) || 0;
    const lng = parseFloat(document.getElementById('maps-node-lng')?.value) || 0;

    showToast('Generando foto con marca de agua...', 'info');
    try {
      const photo = await generateWatermarkedPhoto(file, {
        lat,
        lng,
        tenantName: getActiveTenantName(),
        userName: getActiveUserName(),
        notes: 'Foto inicial registrada con el punto'
      });

      state.newNodePhotos.push(photo);
      renderNewNodePhotosGrid();
      showToast('Foto agregada a la galería inicial', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al procesar la foto', 'error');
    } finally {
      event.target.value = '';
    }
  }

  function renderNewNodePhotosGrid() {
    const grid = document.getElementById('maps-node-form-photos-grid');
    const countBadge = document.getElementById('maps-node-form-photos-count');
    if (countBadge) countBadge.textContent = `${state.newNodePhotos.length} fotos`;
    if (!grid) return;

    if (state.newNodePhotos.length === 0) {
      grid.innerHTML = '<span class="text-[11px] text-slate-400 italic">No hay fotos añadidas aún.</span>';
      return;
    }

    grid.innerHTML = state.newNodePhotos.map((p, idx) => `
      <div class="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-xs">
        <img src="${p.thumbnail || p.url}" class="w-full h-full object-cover cursor-pointer" onclick="mapsModule.openLightbox('${p.url}', 'Foto Inicial #${idx + 1}')">
        <button type="button" onclick="mapsModule.removeInitialNodePhoto(${idx})" class="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition shadow-sm">✕</button>
      </div>
    `).join('');
  }

  function removeInitialNodePhoto(index) {
    state.newNodePhotos.splice(index, 1);
    renderNewNodePhotosGrid();
  }

  // Modal de Historial y Línea de Tiempo de Fotos
  function openPhotosModal(nodeId) {
    const node = (state.data.nodes || []).find(n => n.id === nodeId);
    if (!node) {
      showToast('Elemento no encontrado en el mapa.', 'warning');
      return;
    }
    state.activePhotoNodeId = nodeId;

    const modal = document.getElementById('maps-photos-modal');
    if (!modal) return;

    closeModal('maps-share-modal');

    const titleEl = document.getElementById('maps-photos-modal-title');
    const subEl = document.getElementById('maps-photos-modal-subtitle');
    if (titleEl) titleEl.textContent = `Fotos de Estado: ${node.name || 'Nodo'}`;
    const latVal = Number(node.lat || 0).toFixed(5);
    const lngVal = Number(node.lng || 0).toFixed(5);
    const typeVal = (node.type || 'NODO').toUpperCase();
    if (subEl) subEl.textContent = `Tipo: ${typeVal} | Coordenadas: ${latVal}, ${lngVal}`;

    renderPhotosTimeline(node);
    modal.classList.remove('hidden');
  }

  function renderPhotosTimeline(node) {
    const container = document.getElementById('maps-photos-timeline-container');
    const badge = document.getElementById('maps-photos-count-badge');
    const photos = Array.isArray(node.photos) ? node.photos : [];
    if (badge) badge.textContent = `${photos.length} fotos`;
    if (!container) return;

    if (photos.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <svg class="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
          <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">No hay fotos de estado en el historial</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Tome una foto con la cámara del celular o suba un archivo desde su PC.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-white/10">
        ${photos.map((photo) => `
          <div class="relative group">
            <!-- Punto de la línea de tiempo -->
            <div class="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900 shadow-sm"></div>
            
            <!-- Tarjeta de la foto -->
            <div class="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/90 dark:border-white/10 shadow-xs hover:shadow-md transition">
              <div class="flex flex-col sm:flex-row gap-3">
                <!-- Miniatura con botón de zoom -->
                <div class="relative w-full sm:w-36 h-28 sm:h-24 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex-shrink-0 cursor-pointer group/thumb" onclick="mapsModule.openLightbox('${photo.url}', 'Foto del Nodo: ${escapeHtml(node.name)}', ${JSON.stringify(photo).replace(/"/g, '&quot;')})">
                  <img src="${photo.thumbnail || photo.url}" class="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-105" alt="Foto">
                  <div class="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                  </div>
                </div>

                <!-- Datos técnicos de la foto -->
                <div class="flex-1 min-w-0 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        ${photo.dateFormatted}
                      </span>
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 truncate">
                        👤 ${escapeHtml(photo.user)}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>🏢 ${escapeHtml(photo.tenantName || state.tenantId)}</span>
                      <span>•</span>
                      <span class="font-mono">📍 ${photo.lat ? photo.lat.toFixed(5) : '--'}, ${photo.lng ? photo.lng.toFixed(5) : '--'}</span>
                    </div>
                    ${photo.notes ? `
                      <p class="text-[11px] text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-white/[0.02] p-1.5 rounded-lg border border-slate-100 dark:border-white/5 mt-1.5">
                        "${escapeHtml(photo.notes)}"
                      </p>
                    ` : ''}
                  </div>

                  <!-- Acciones -->
                  <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                    <button type="button" onclick="mapsModule.openLightbox('${photo.url}', 'Foto del Nodo: ${escapeHtml(node.name)}', ${JSON.stringify(photo).replace(/"/g, '&quot;')})" class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                      <span>Ver en Visor Completo</span>
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    </button>
                    ${can('maps:delete') ? `
                      <button type="button" onclick="mapsModule.deletePhotoFromNode('${node.id}', '${photo.id}')" class="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-medium transition" title="Eliminar Foto del Historial">
                        🗑️ Eliminar
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !state.activePhotoNodeId) return;

    const node = (state.data.nodes || []).find(n => n.id === state.activePhotoNodeId);
    if (!node) return;

    const notesInput = document.getElementById('maps-photo-notes-input');
    const notes = notesInput ? notesInput.value.trim() : '';

    showToast('Aplicando marca de agua certificada y optimizando foto...', 'info');

    try {
      const watermarked = await generateWatermarkedPhoto(file, {
        lat: node.lat,
        lng: node.lng,
        tenantName: getActiveTenantName(),
        userName: getActiveUserName(),
        notes
      });

      const res = await fetch(`/api/maps/nodes/${node.id}/photos?tenantId=${encodeURIComponent(state.tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(watermarked),
      });

      const json = await res.json();
      if (json.success) {
        showToast('Foto agregada a la línea de tiempo exitosamente', 'success');
        if (!Array.isArray(node.photos)) node.photos = [];
        node.photos.unshift(json.photo || watermarked);
        if (notesInput) notesInput.value = '';
        renderPhotosTimeline(node);
        renderAllMapLayers();
        updateLibraryBadge();
      } else {
        showToast(json.message || 'Error al guardar foto', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error al procesar la foto', 'error');
    } finally {
      event.target.value = '';
    }
  }

  async function deletePhotoFromNode(nodeId, photoId) {
    if (!confirm('¿Confirma que desea eliminar esta foto del historial?')) return;

    try {
      const res = await fetch(`/api/maps/nodes/${nodeId}/photos/${photoId}?tenantId=${encodeURIComponent(state.tenantId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast('Foto eliminada del historial', 'info');
        const node = (state.data.nodes || []).find(n => n.id === nodeId);
        if (node && Array.isArray(node.photos)) {
          node.photos = node.photos.filter(p => p.id !== photoId);
          renderPhotosTimeline(node);
          renderAllMapLayers();
          updateLibraryBadge();
        }
      } else {
        showToast(json.message || 'Error al eliminar foto', 'error');
      }
    } catch (e) {
      showToast('Error de red al eliminar foto', 'error');
    }
  }

  // Visor Lightbox
  function openLightbox(imgUrl, title, meta) {
    state.activeLightboxPhoto = { url: imgUrl, title, meta };
    const modal = document.getElementById('maps-lightbox-modal');
    const img = document.getElementById('maps-lightbox-img');
    const titleEl = document.getElementById('maps-lightbox-title');
    const metaEl = document.getElementById('maps-lightbox-meta');
    const footerEl = document.getElementById('maps-lightbox-footer-info');
    if (!modal || !img) return;

    img.src = imgUrl;
    if (titleEl) titleEl.textContent = title || 'Visor de Foto';
    if (metaEl) {
      if (meta) {
        metaEl.textContent = `${meta.dateFormatted || ''} • Operador: ${meta.user || 'Operador'} • Empresa: ${meta.tenantName || state.tenantId}`;
      } else {
        metaEl.textContent = 'TurboNetwork Sistema GIS';
      }
    }
    if (footerEl) {
      if (meta && (meta.lat || meta.lng)) {
        footerEl.innerHTML = `<span class="font-mono text-emerald-400">📍 Coordenadas Certificadas: ${meta.lat}, ${meta.lng}</span>`;
      } else {
        footerEl.innerHTML = '';
      }
    }

    modal.classList.remove('hidden');
  }

  function closeLightbox() {
    const modal = document.getElementById('maps-lightbox-modal');
    if (modal) modal.classList.add('hidden');
    state.activeLightboxPhoto = null;
  }

  function downloadLightboxImage() {
    if (!state.activeLightboxPhoto || !state.activeLightboxPhoto.url) return;
    const a = document.createElement('a');
    a.href = state.activeLightboxPhoto.url;
    a.download = `GIS_Foto_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Descargando imagen con marca de agua...', 'info');
  }

  // Biblioteca / Explorador de Elementos GIS
  function toggleLibraryDrawer(forceOpen) {
    const drawer = document.getElementById('maps-library-drawer');
    if (!drawer) return;
    const isHidden = drawer.classList.contains('hidden') || drawer.style.display === 'none';
    const willOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;

    if (willOpen) {
      drawer.classList.remove('hidden');
      drawer.style.display = 'flex';
      renderLibraryList();
    } else {
      drawer.classList.add('hidden');
      drawer.style.display = 'none';
    }
  }

  function setLibraryTab(tab) {
    state.libraryFilter = tab;
    ['all', 'nodes', 'lines', 'areas'].forEach(t => {
      const btn = document.getElementById(`maps-lib-tab-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = 'py-1 rounded-lg bg-indigo-600 text-white shadow-xs transition';
        } else {
          btn.className = 'py-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition';
        }
      }
    });
    renderLibraryList();
  }

  function handleLibrarySearch(query) {
    state.librarySearchQuery = (query || '').toLowerCase().trim();
    renderLibraryList();
  }

  function renderLibraryList() {
    try {
      const container = document.getElementById('maps-library-items-list');
      if (!container) return;

      const activeMap = getActiveMap();
      const mapName = activeMap ? activeMap.name : 'Mapa Activo';
      const libTitle = document.getElementById('maps-lib-map-title');
      if (libTitle) libTitle.textContent = `Biblioteca: ${mapName}`;
      const libSubtitle = document.getElementById('maps-lib-map-subtitle');
      if (libSubtitle) {
        libSubtitle.textContent = activeMap ? `Elementos en ${activeMap.district || activeMap.name}` : 'Elementos del mapa actual';
      }

      const q = state.librarySearchQuery;
      const tab = state.libraryFilter;

      // Obtener elementos EXCLUSIVAMENTE del mapa activo
      const sourceNodes = (activeMap ? activeMap.nodes : state.data.nodes) || [];
      const sourceLines = (activeMap ? activeMap.lines : state.data.lines) || [];
      const sourceAreas = (activeMap ? activeMap.areas : state.data.areas) || [];

      const nodes = sourceNodes.map(n => ({ ...n, _category: 'node' }));
      const lines = sourceLines.map(l => ({ ...l, _category: 'line' }));
      const areas = sourceAreas.map(a => ({ ...a, _category: 'area' }));

      // Actualizar contadores
      const cntAll = document.getElementById('maps-lib-cnt-all');
      const cntNodes = document.getElementById('maps-lib-cnt-nodes');
      const cntLines = document.getElementById('maps-lib-cnt-lines');
      const cntAreas = document.getElementById('maps-lib-cnt-areas');
      const badgeCount = document.getElementById('maps-library-badge-count');

      const totalCount = nodes.length + lines.length + areas.length;
      if (cntAll) cntAll.textContent = totalCount;
      if (cntNodes) cntNodes.textContent = nodes.length;
      if (cntLines) cntLines.textContent = lines.length;
      if (cntAreas) cntAreas.textContent = areas.length;
      if (badgeCount) badgeCount.textContent = totalCount;

      let items = [];
      if (tab === 'nodes') items = nodes;
      else if (tab === 'lines') items = lines;
      else if (tab === 'areas') items = areas;
      else items = [...nodes, ...lines, ...areas];

      if (q) {
        items = items.filter(it => {
          const name = (it.name || '').toLowerCase();
          const type = (it.type || '').toLowerCase();
          const addr = (it.address || '').toLowerCase();
          const notes = (it.notes || '').toLowerCase();
          return name.includes(q) || type.includes(q) || addr.includes(q) || notes.includes(q);
        });
      }

      if (items.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center text-slate-400">
            <svg class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">No se encontraron elementos en ${escapeHtml(mapName)}</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Agregue puntos, líneas o zonas a este mapa.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = items.map(it => {
        if (it._category === 'node') {
          const ic = NODE_ICONS[it.type] || NODE_ICONS.custom;
          const photoCount = Array.isArray(it.photos) ? it.photos.length : 0;
          const latStr = (parseFloat(it.lat) || 0).toFixed(4);
          const lngStr = (parseFloat(it.lng) || 0).toFixed(4);
          return `
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 hover:border-blue-500/40 transition space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2 min-w-0">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-xs overflow-hidden" style="background-color: ${it.color || '#2563eb'}">
                    ${it.customImage ? `<img src="${it.customImage}" class="w-full h-full object-cover">` : `<span class="w-3.5 h-3.5">${ic.svg}</span>`}
                  </div>
                  <div class="min-w-0">
                    <h5 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(it.name)}</h5>
                    <span class="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">${ic.name}</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${it.status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-500'}">Punto</span>
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span class="font-mono">📍 ${latStr}, ${lngStr}</span>
                ${photoCount > 0 ? `<span class="text-indigo-600 dark:text-indigo-400 font-bold">📸 ${photoCount} fotos</span>` : ''}
              </div>
              <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                <button type="button" onclick="mapsModule.flyToElement('node', '${it.id}')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition flex items-center space-x-1 shadow-xs active:scale-95">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
                  <span>Volar</span>
                </button>
                <div class="flex items-center space-x-1">
                  <button type="button" onclick="mapsModule.openPhotosModal('${it.id}')" class="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-xs font-semibold" title="Ver / Tomar Fotos">📸</button>
                  <button type="button" onclick="mapsModule.openEditNodeModal('${it.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-blue-500 text-xs font-semibold" title="Editar">✏️</button>
                  <button type="button" onclick="mapsModule.deleteNode('${it.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 text-xs font-semibold" title="Eliminar">🗑️</button>
                </div>
              </div>
            </div>
          `;
        } else if (it._category === 'line') {
          return `
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 transition space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2 min-w-0">
                  <div class="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style="background-color: ${it.color || '#059669'}">
                    <div class="w-3 h-0.5 bg-white rounded-full"></div>
                  </div>
                  <div class="min-w-0">
                    <h5 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(it.name)}</h5>
                    <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">${it.type}</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Línea</span>
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span class="font-mono font-bold">${it.distanceMeters ? formatDistance(it.distanceMeters) : '--'}</span>
                <span>${it.fiberCores || 24} hilos</span>
              </div>
              <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                <button type="button" onclick="mapsModule.flyToElement('line', '${it.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center space-x-1 shadow-xs active:scale-95">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
                  <span>Volar</span>
                </button>
                <div class="flex items-center space-x-1">
                  <button type="button" onclick="mapsModule.openEditLineModal('${it.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-emerald-500 text-xs font-semibold" title="Editar">✏️</button>
                  <button type="button" onclick="mapsModule.deleteLine('${it.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 text-xs font-semibold" title="Eliminar">🗑️</button>
                </div>
              </div>
            </div>
          `;
        } else if (it._category === 'area') {
          const areaKm = typeof it.surfaceAreaKm2 === 'number' ? it.surfaceAreaKm2.toFixed(2) : (parseFloat(it.surfaceAreaKm2) || 0).toFixed(2);
          return `
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 hover:border-purple-500/40 transition space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2 min-w-0">
                  <div class="w-6 h-6 rounded-lg border flex-shrink-0" style="background-color: ${it.fillColor || '#3b82f6'}; border-color: ${it.strokeColor || '#1d4ed8'}"></div>
                  <div class="min-w-0">
                    <h5 class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(it.name)}</h5>
                    <span class="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase">Zona Cobertura</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400">Área</span>
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span class="font-mono font-bold">${areaKm} km²</span>
                <span>${it.targetCustomers ? it.targetCustomers + ' abonados' : ''}</span>
              </div>
              <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                <button type="button" onclick="mapsModule.flyToElement('area', '${it.id}')" class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition flex items-center space-x-1 shadow-xs active:scale-95">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
                  <span>Volar</span>
                </button>
                <div class="flex items-center space-x-1">
                  <button type="button" onclick="mapsModule.openEditAreaModal('${it.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-purple-500 text-xs font-semibold" title="Editar">✏️</button>
                  <button type="button" onclick="mapsModule.deleteArea('${it.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 text-xs font-semibold" title="Eliminar">🗑️</button>
                </div>
              </div>
            </div>
          `;
        }
        return '';
      }).join('');
    } catch (err) {
      console.error('[MAPS] Error renderLibraryList:', err);
    }
  }

  function flyToElement(type, id) {
    if (!state.map) return;
    const activeMap = getActiveMap();
    const sourceNodes = (activeMap ? activeMap.nodes : state.data.nodes) || [];
    const sourceLines = (activeMap ? activeMap.lines : state.data.lines) || [];
    const sourceAreas = (activeMap ? activeMap.areas : state.data.areas) || [];

    if (type === 'node') {
      const node = sourceNodes.find(n => n.id === id);
      if (node) {
        state.map.flyTo({ center: [node.lng, node.lat], zoom: 17, essential: true });
        const marker = state.markers.find(m => {
          const lngLat = m.getLngLat();
          return Math.abs(lngLat.lng - node.lng) < 0.0001 && Math.abs(lngLat.lat - node.lat) < 0.0001;
        });
        if (marker && marker.getPopup()) {
          setTimeout(() => marker.togglePopup(), 600);
        }
      }
    } else if (type === 'line') {
      const line = sourceLines.find(l => l.id === id);
      if (line && line.coordinates && line.coordinates.length > 0) {
        const mid = line.coordinates[Math.floor(line.coordinates.length / 2)];
        state.map.flyTo({ center: mid, zoom: 16, essential: true });
      }
    } else if (type === 'area') {
      const area = sourceAreas.find(a => a.id === id);
      if (area && area.coordinates && area.coordinates.length > 0) {
        const mid = area.coordinates[0];
        state.map.flyTo({ center: mid, zoom: 15, essential: true });
      }
    }
    if (window.innerWidth < 640) {
      toggleLibraryDrawer(false);
    }
  }

  function updateLibraryBadge() {
    const activeMap = getActiveMap();
    const sourceNodes = (activeMap ? activeMap.nodes : state.data.nodes) || [];
    const sourceLines = (activeMap ? activeMap.lines : state.data.lines) || [];
    const sourceAreas = (activeMap ? activeMap.areas : state.data.areas) || [];
    const total = sourceNodes.length + sourceLines.length + sourceAreas.length;
    const badge = document.getElementById('maps-library-badge-count');
    if (badge) badge.textContent = total;
  }

  // Exponer API global
  window.mapsModule = {
    state,
    NODE_ICONS,
    loadMapsModule,
    enterMapMode,
    exitMapMode,
    setTool,
    undoLastPoint,
    clearCurrentDraw,
    updateLineHud,
    updateAreaHud,
    updateRulerHud,
    resetRuler,
    undoRulerPoint,
    saveRulerAsLine,
    finishLineDraw,
    finishAreaDraw,
    openCreateNodeModal,
    openEditNodeModal,
    saveNodeForm,
    deleteNode,
    openCreateLineModal,
    openEditLineModal,
    saveLineForm,
    deleteLine,
    openCreateAreaModal,
    openEditAreaModal,
    saveAreaForm,
    deleteArea,
    setMapStyle,
    toggleLayer,
    toggleSearchBar,
    searchMapQuery,
    centerOnUserLocation,
    openMapFocused,
    focusLine,
    focusArea,
    openShareModal,
    loadShareConversations,
    switchShareTab,
    sendShareWhatsApp,
    sendShareChat,
    exportGeoJson,
    renderColorPickerGrid,
    renderIconSelector,
    closeModal,
    togglePopover,
    closePopover,
    // Nuevas funcionalidades avanzadas
    generateWatermarkedPhoto,
    handleCustomNodeImage,
    removeCustomNodeImage,
    handleInitialNodePhoto,
    renderNewNodePhotosGrid,
    removeInitialNodePhoto,
    openPhotosModal,
    renderPhotosTimeline,
    handlePhotoUpload,
    deletePhotoFromNode,
    openLightbox,
    closeLightbox,
    downloadLightboxImage,
    toggleLibraryDrawer,
    setLibraryTab,
    handleLibrarySearch,
    renderLibraryList,
    flyToElement,
    updateLibraryBadge,
    // Gestión Multi-Mapa
    getActiveMap,
    renderMapProjectsGrid,
    handleProjectSearch,
    openCreateMapModal,
    closeCreateMapModal,
    setProjectCoordsPreset,
    submitMapProjectForm,
    deleteMapProject,
    // Command Palette de Mapas
    openCommandPalette,
    closeCommandPalette,
    handlePaletteBackdropClick,
    clearCommandPaletteInput,
    onCommandPaletteInput,
    onCommandPaletteKeydown,
    setPaletteFilter,
    executePaletteItem,
  };

  // Manejo de tecla Escape y atajos de teclado para el módulo de mapas
  document.addEventListener('keydown', (e) => {
    // Atajo Ctrl+M o Cmd+M para abrir Command Palette de Mapas
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      const tabMaps = document.getElementById('tab-maps');
      if (tabMaps && !tabMaps.classList.contains('hidden')) {
        e.preventDefault();
        openCommandPalette();
        return;
      }
    }

    if (e.key === 'Escape') {
      const cp = document.getElementById('maps-command-palette-modal');
      if (cp && !cp.classList.contains('hidden')) {
        closeCommandPalette();
        return;
      }
      const lb = document.getElementById('maps-lightbox-modal');
      if (lb && !lb.classList.contains('hidden')) {
        closeLightbox();
        return;
      }
      const pm = document.getElementById('maps-photos-modal');
      if (pm && !pm.classList.contains('hidden')) {
        closeModal('maps-photos-modal');
        return;
      }
      const lib = document.getElementById('maps-library-drawer');
      if (lib && !lib.classList.contains('hidden')) {
        toggleLibraryDrawer(false);
        return;
      }
    }
  });

  // Inicialización cuando el documento esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Listener para redimensionar mapa al cambiar tamaño de ventana
      window.addEventListener('resize', () => {
        if (state.map && state.activeMode === 'map') state.map.resize();
      });
    });
  } else {
    window.addEventListener('resize', () => {
      if (state.map && state.activeMode === 'map') state.map.resize();
    });
  }
})();
