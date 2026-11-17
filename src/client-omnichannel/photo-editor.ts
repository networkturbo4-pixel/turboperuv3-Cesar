import { svgIcon } from './icons';

export interface PhotoEditorResult {
  dataUrl: string;
  filename: string;
  caption: string;
}

interface CanvasObject {
  id: string;
  type: 'arrow' | 'rect' | 'circle' | 'text' | 'emoji' | 'location' | 'clock';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians
  color: string;
  cardStyle?: 'white' | 'dark' | 'color';
  text?: string;
  fontSize?: number;
  strokeWidth?: number;
}

interface FreeDrawStroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

function drawSmoothStroke(ctx: CanvasRenderingContext2D, stroke: FreeDrawStroke): void {
  if (!stroke.points || stroke.points.length === 0) return;

  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'transparent'; // Únicamente trazo de línea, sin relleno

  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke.points[0].x, stroke.points[0].y, Math.max(0.5, stroke.width / 2), 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  if (stroke.points.length === 2) {
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Curvas cuadráticas suaves por los puntos medios (estrictamente trazo)
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length - 1; i++) {
    const p1 = stroke.points[i];
    const p2 = stroke.points[i + 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
  }
  const last = stroke.points[stroke.points.length - 1];
  const secondLast = stroke.points[stroke.points.length - 2];
  ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
  ctx.stroke(); // Únicamente trazo
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
    return;
  }
  const minDim = Math.min(Math.abs(w), Math.abs(h));
  const radius = Math.min(r, minDim / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function openWhatsAppPhotoEditor(options: {
  imageFile: File;
  onSend: (result: PhotoEditorResult) => void;
  onCancel?: () => void;
}): void {
  const { imageFile, onSend, onCancel } = options;

  const overlay = document.createElement('div');
  overlay.className = 'wa-photo-editor-overlay';
  document.body.appendChild(overlay);

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      initEditor(img);
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(imageFile);

  function initEditor(sourceImg: HTMLImageElement) {
    let rotationAngle = 0; // 0, 90, 180, 270
    let currentColor = '#10b981';
    let currentStrokeWidth = 7; // default medium stroke
    let currentTool: 'none' | 'pencil' | 'arrow' | 'rect' | 'circle' | 'text' | 'emoji' = 'none';
    const objects: CanvasObject[] = [];
    const strokes: FreeDrawStroke[] = [];
    const historyStack: Array<{ objects: CanvasObject[]; strokes: FreeDrawStroke[] }> = [];

    let selectedObjectId: string | null = null;
    let isDragging = false;
    let isTransforming = false;
    let transformMode: 'scale' | 'rotate' | null = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let objStartX = 0;
    let objStartY = 0;
    let objStartW = 0;
    let objStartH = 0;
    let objStartFontSize = 36;
    let objStartRotation = 0;

    let currentFreeStroke: FreeDrawStroke | null = null;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;

    overlay.innerHTML = `
      <div class="wa-photo-editor-container">
        <!-- Barra Superior WhatsApp Tools (Diseño Responsivo en 2 filas compactas) -->
        <header class="wa-editor-topbar">
          <div class="wa-editor-topbar-row1">
            <div class="wa-editor-actions-left">
              <button type="button" class="wa-editor-btn" id="wa-btn-cancel" title="Cancelar">
                ${svgIcon('close', 18)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-rotate" title="Girar 90°">
                ${svgIcon('rotateCw', 16)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-undo" title="Deshacer acción">
                ${svgIcon('undo', 16)}
              </button>
              <button type="button" class="wa-editor-btn" id="wa-btn-delete-selected" title="Eliminar elemento seleccionado" style="color:#ef4444;display:none;">
                ${svgIcon('trash', 16)}
              </button>
            </div>

            <div class="wa-editor-styling-right">
              <!-- Selector de Grosor de Trazos -->
              <div class="wa-stroke-palette" id="wa-stroke-palette" title="Grosor de trazo">
                <button type="button" class="wa-stroke-btn" data-width="3" title="Trazo fino (3px)">
                  <span style="width:4px;height:4px;"></span>
                </button>
                <button type="button" class="wa-stroke-btn active" data-width="7" title="Trazo medio (7px)">
                  <span style="width:7px;height:7px;"></span>
                </button>
                <button type="button" class="wa-stroke-btn" data-width="14" title="Trazo grueso (14px)">
                  <span style="width:11px;height:11px;"></span>
                </button>
                <button type="button" class="wa-stroke-btn" data-width="24" title="Trazo extra grueso (24px)">
                  <span style="width:15px;height:15px;"></span>
                </button>
              </div>

              <!-- Paleta de Color Rápida -->
              <div class="wa-color-palette" id="wa-color-palette">
                ${['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ffffff', '#000000']
                  .map(
                    (c, i) => `
                    <button type="button" class="wa-color-swatch ${i === 0 ? 'active' : ''}" style="background-color:${c};" data-color="${c}"></button>
                  `
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <!-- Selector de Herramientas Desplazable Horizontalmente para Móvil y PC -->
          <div class="wa-editor-tools-scroller">
            <button type="button" class="wa-tool-pill" data-tool="pencil" title="Dibujar trazo libre">
              ${svgIcon('edit', 16)}
              <span class="wa-tool-name">Lápiz</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="arrow" title="Insertar Flecha">
              ${svgIcon('arrowRight', 16)}
              <span class="wa-tool-name">Flecha</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="rect" title="Insertar Rectángulo / Cuadrado">
              ${svgIcon('square', 16)}
              <span class="wa-tool-name">Cuadrado</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="circle" title="Insertar Círculo">
              ${svgIcon('circle', 16)}
              <span class="wa-tool-name">Círculo</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="text" title="Escribir Texto">
              ${svgIcon('type', 16)}
              <span class="wa-tool-name">Texto</span>
            </button>
            <button type="button" class="wa-tool-pill" data-tool="emoji" title="Stickers y Emoticones">
              ${svgIcon('smile', 16)}
              <span class="wa-tool-name">Sticker</span>
            </button>
            <button type="button" class="wa-tool-pill" id="wa-tool-location" title="Añadir Sticker de Ubicación">
              ${svgIcon('mapPin', 16)}
              <span class="wa-tool-name">Ubicación</span>
            </button>
            <button type="button" class="wa-tool-pill" id="wa-tool-clock" title="Añadir Sticker de Hora / Reloj">
              ${svgIcon('clock', 16)}
              <span class="wa-tool-name">Reloj</span>
            </button>
          </div>
        </header>

        <!-- Submenú Popover de Emojis / Stickers -->
        <div class="wa-stickers-popover" id="wa-stickers-popover" style="display:none;">
          <div class="wa-stickers-grid">
            ${['🔥', '⭐', '❤️', '✅', '📍', '🕒', '🎯', '🚀', '💯', '👍', '💼', '📦', '⚠️', '💡', '🎉', '👏', '🤝', '⚡', '🌟', '📌']
              .map(
                (em) => `
                <button type="button" class="wa-emoji-item" data-emoji="${em}">${em}</button>
              `
              )
              .join('')}
          </div>
        </div>

        <!-- Modal overlay para Texto y Ubicación (Reemplazo sin window.prompt) -->
        <div class="wa-editor-modal" id="wa-input-modal" style="display:none;">
          <div class="wa-editor-modal-card">
            <h3 id="wa-input-modal-title">Escribir Texto</h3>
            <input type="text" id="wa-input-modal-text" class="form-control" placeholder="Escriba aquí..." autocomplete="off" />
            <div class="wa-editor-modal-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="wa-input-modal-cancel">Cancelar</button>
              <button type="button" class="btn btn-primary btn-sm" id="wa-input-modal-confirm">Aceptar</button>
            </div>
          </div>
        </div>

        <!-- Área Central de Lienzo / Canvas -->
        <div class="wa-editor-viewport" id="wa-editor-viewport">
          <canvas id="wa-photo-canvas"></canvas>
        </div>

        <!-- Barra Inferior WhatsApp: Pie de Foto Moderno Glassmorphism + Botón Enviar Circular -->
        <footer class="wa-editor-bottombar">
          <div class="wa-editor-caption-card">
            <span class="wa-editor-caption-prefix">
              ${svgIcon('smile', 18)}
            </span>
            <input
              type="text"
              id="wa-caption-input"
              class="wa-caption-input"
              placeholder="Añadir un pie de foto..."
              autocomplete="off"
            />
          </div>
          <button type="button" class="wa-btn-send-photo" id="wa-btn-send" title="Enviar Foto a WhatsApp">
            ${svgIcon('send', 19)}
          </button>
        </footer>
      </div>
    `;

    const canvas = overlay.querySelector('#wa-photo-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const viewport = overlay.querySelector('#wa-editor-viewport') as HTMLElement;
    const stickersPopover = overlay.querySelector('#wa-stickers-popover') as HTMLElement;
    const captionInput = overlay.querySelector('#wa-caption-input') as HTMLInputElement;
    const deleteBtn = overlay.querySelector('#wa-btn-delete-selected') as HTMLButtonElement;

    const inputModal = overlay.querySelector('#wa-input-modal') as HTMLElement;
    const inputModalTitle = overlay.querySelector('#wa-input-modal-title') as HTMLElement;
    const inputModalText = overlay.querySelector('#wa-input-modal-text') as HTMLInputElement;
    const inputModalCancel = overlay.querySelector('#wa-input-modal-cancel') as HTMLButtonElement;
    const inputModalConfirm = overlay.querySelector('#wa-input-modal-confirm') as HTMLButtonElement;
    let pendingModalCallback: ((val: string | null) => void) | null = null;

    function promptModal(title: string, defaultValue: string): Promise<string | null> {
      return new Promise((resolve) => {
        inputModalTitle.textContent = title;
        inputModalText.value = defaultValue;
        inputModal.style.display = 'flex';
        inputModalText.focus();
        inputModalText.select();
        pendingModalCallback = resolve;
      });
    }

    const closeModal = (result: string | null) => {
      inputModal.style.display = 'none';
      if (pendingModalCallback) {
        pendingModalCallback(result);
        pendingModalCallback = null;
      }
    };

    inputModalCancel.addEventListener('click', () => closeModal(null));
    inputModalConfirm.addEventListener('click', () => closeModal(inputModalText.value.trim() || null));
    inputModalText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        closeModal(inputModalText.value.trim() || null);
      } else if (e.key === 'Escape') {
        closeModal(null);
      }
    });

    function saveHistory() {
      historyStack.push({
        objects: JSON.parse(JSON.stringify(objects)),
        strokes: JSON.parse(JSON.stringify(strokes)),
      });
      if (historyStack.length > 25) historyStack.shift();
    }

    function setupCanvasSize() {
      const isRotated = rotationAngle === 90 || rotationAngle === 270;
      const naturalW = isRotated ? sourceImg.naturalHeight : sourceImg.naturalWidth;
      const naturalH = isRotated ? sourceImg.naturalWidth : sourceImg.naturalHeight;

      const maxDisplayW = Math.min(viewport.clientWidth - 20, 960);
      const maxDisplayH = Math.min(viewport.clientHeight - 20, 680);
      const scale = Math.min(maxDisplayW / naturalW, maxDisplayH / naturalH, 1);

      canvas.width = naturalW;
      canvas.height = naturalH;
      canvas.style.width = `${Math.round(naturalW * scale)}px`;
      canvas.style.height = `${Math.round(naturalH * scale)}px`;

      renderAll();
    }

    function renderAll() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Draw rotated source background image
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotationAngle * Math.PI) / 180);
      const isRotated = rotationAngle === 90 || rotationAngle === 270;
      const drawW = isRotated ? canvas.height : canvas.width;
      const drawH = isRotated ? canvas.width : canvas.height;
      ctx.drawImage(sourceImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Draw freehand strokes with smooth quadratic curves (estrictamente trazo)
      for (const stroke of strokes) {
        drawSmoothStroke(ctx, stroke);
      }

      // Draw interactive objects
      for (const obj of objects) {
        ctx.save();
        ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
        ctx.rotate(obj.rotation);

        const hw = obj.width / 2;
        const hh = obj.height / 2;

        if (obj.type === 'rect') {
          ctx.lineWidth = obj.strokeWidth || 6;
          ctx.strokeStyle = obj.color;
          ctx.strokeRect(-hw, -hh, obj.width, obj.height);
        } else if (obj.type === 'circle') {
          ctx.beginPath();
          ctx.lineWidth = obj.strokeWidth || 6;
          ctx.strokeStyle = obj.color;
          ctx.ellipse(0, 0, Math.abs(hw), Math.abs(hh), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (obj.type === 'arrow') {
          const sw = obj.strokeWidth || 7;
          ctx.beginPath();
          ctx.lineWidth = sw;
          ctx.strokeStyle = obj.color;
          ctx.fillStyle = obj.color;
          ctx.moveTo(-hw, 0);
          ctx.lineTo(hw - sw * 2.5, 0);
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.moveTo(hw, 0);
          ctx.lineTo(hw - sw * 3.5, -sw * 2);
          ctx.lineTo(hw - sw * 3.5, sw * 2);
          ctx.closePath();
          ctx.fill();
        } else if (obj.type === 'text') {
          ctx.font = `bold ${obj.fontSize || 36}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = obj.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = Math.round((obj.fontSize || 36) * 0.2);
          ctx.fillText(obj.text || '', 0, 0);
        } else if (obj.type === 'emoji') {
          ctx.font = `${obj.fontSize || 64}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(obj.text || '⭐', 0, 0);
        } else if (obj.type === 'location') {
          // Card de Ubicación estilo WhatsApp / Instagram Stories (Pill moderna)
          const badgeW = obj.width;
          const badgeH = obj.height;
          const radius = badgeH / 2;
          const locScale = badgeH / 50;

          // Sombra suave para destacar sobre cualquier foto
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
          ctx.shadowBlur = Math.round(14 * locScale);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(4 * locScale);

          const isDark = obj.cardStyle === 'dark';
          if (isDark) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          } else {
            ctx.fillStyle = '#ffffff';
          }
          drawRoundedRect(ctx, -hw, -hh, badgeW, badgeH, radius);
          ctx.fill();
          ctx.restore();

          // Borde sutil
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = isDark ? 1.5 : 1;
          drawRoundedRect(ctx, -hw, -hh, badgeW, badgeH, radius);
          ctx.stroke();

          // Ícono Vectorial Map Pin de alta definición
          const pinScale = locScale;
          const pinX = -hw + 20 * pinScale + 6 * pinScale;
          const pinY = -2 * pinScale;

          ctx.save();
          ctx.translate(pinX, pinY);
          ctx.scale(pinScale, pinScale);

          // Sombra del pin
          ctx.beginPath();
          ctx.ellipse(0, 11, 4.5, 2, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.fill();

          // Cabeza y punta del pin
          ctx.beginPath();
          ctx.arc(0, -3, 7.8, Math.PI * 0.8, Math.PI * 0.2, true);
          ctx.lineTo(0, 9.5);
          ctx.closePath();
          ctx.fillStyle = obj.color && obj.color !== '#ffffff' && obj.color !== '#000000' ? obj.color : '#ef4444';
          ctx.fill();

          // Círculo blanco interno
          ctx.beginPath();
          ctx.arc(0, -3, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();

          // Texto de ubicación en tipografía moderna de alto contraste
          const textX = pinX + 17 * pinScale;
          ctx.font = `bold ${obj.fontSize || Math.round(20 * pinScale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
          ctx.fillText(obj.text || 'Lima, Perú', textX, 0);
        } else if (obj.type === 'clock') {
          // Card de Reloj estilo WhatsApp / Instagram Stories (Pill moderna de alto contraste)
          const badgeW = obj.width;
          const badgeH = obj.height;
          const radius = badgeH / 2;
          const clockScale = badgeH / 50;

          // Sombra suave
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = Math.round(14 * clockScale);
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(4 * clockScale);

          const isDark = obj.cardStyle !== 'white';
          if (isDark) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          } else {
            ctx.fillStyle = '#ffffff';
          }
          drawRoundedRect(ctx, -hw, -hh, badgeW, badgeH, radius);
          ctx.fill();
          ctx.restore();

          // Borde
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = isDark ? 1.5 : 1;
          drawRoundedRect(ctx, -hw, -hh, badgeW, badgeH, radius);
          ctx.stroke();

          // Ícono Vectorial de Reloj con agujas dinámicas
          const clockX = -hw + 20 * clockScale + 6 * clockScale;
          const clockY = 0;
          const clockR = 9.8 * clockScale;

          // Fondo de la esfera
          ctx.beginPath();
          ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(37, 99, 235, 0.12)';
          ctx.fill();
          ctx.strokeStyle = obj.color && obj.color !== '#ffffff' && obj.color !== '#000000' ? obj.color : isDark ? '#38bdf8' : '#2563eb';
          ctx.lineWidth = 2 * clockScale;
          ctx.stroke();

          // Punto central
          ctx.beginPath();
          ctx.arc(clockX, clockY, 1.8 * clockScale, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? '#38bdf8' : '#2563eb';
          ctx.fill();

          // Agujas del reloj según la hora del texto
          const parts = (obj.text || '12:00').split(':');
          const hours = parseInt(parts[0], 10) || 12;
          const mins = parseInt(parts[1], 10) || 0;
          const hourAngle = ((hours % 12) + mins / 60) * (Math.PI / 6) - Math.PI / 2;
          const minAngle = mins * (Math.PI / 30) - Math.PI / 2;

          // Aguja de hora
          ctx.beginPath();
          ctx.moveTo(clockX, clockY);
          ctx.lineTo(
            clockX + Math.cos(hourAngle) * (clockR * 0.54),
            clockY + Math.sin(hourAngle) * (clockR * 0.54)
          );
          ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
          ctx.lineWidth = 2.2 * clockScale;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Aguja de minutos
          ctx.beginPath();
          ctx.moveTo(clockX, clockY);
          ctx.lineTo(
            clockX + Math.cos(minAngle) * (clockR * 0.78),
            clockY + Math.sin(minAngle) * (clockR * 0.78)
          );
          ctx.strokeStyle = isDark ? '#38bdf8' : '#2563eb';
          ctx.lineWidth = 1.6 * clockScale;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Texto digital de la hora (alto contraste asegurado)
          const textX = clockX + 17 * clockScale;
          ctx.font = `bold ${obj.fontSize || Math.round(24 * clockScale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
          ctx.fillText(obj.text || '12:00', textX, 0);
        }

        // Draw bounding box and transform handles if selected
        if (selectedObjectId === obj.id) {
          const sr = getScaleRatio();
          const pad = 10 * sr;
          const handleR = Math.max(8 * sr, 8);
          const stalkH = 26 * sr;

          // Bounding box dashed
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(2 * sr, 2);
          ctx.setLineDash([6 * sr, 6 * sr]);
          ctx.strokeRect(-hw - pad, -hh - pad, obj.width + pad * 2, obj.height + pad * 2);
          ctx.setLineDash([]);

          // 4 Corner scale handles (Verde Esmeralda con borde blanco)
          const corners = [
            { x: -hw - pad, y: -hh - pad },
            { x: hw + pad, y: -hh - pad },
            { x: -hw - pad, y: hh + pad },
            { x: hw + pad, y: hh + pad },
          ];
          for (const c of corners) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, handleR, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(2 * sr, 2);
            ctx.stroke();
          }

          // Top rotate handle con mástil azul
          ctx.beginPath();
          ctx.moveTo(0, -hh - pad);
          ctx.lineTo(0, -hh - pad - stalkH);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = Math.max(2 * sr, 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, -hh - pad - stalkH, handleR, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(2 * sr, 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Update delete button visibility
      if (deleteBtn) {
        deleteBtn.style.display = selectedObjectId ? 'inline-flex' : 'none';
      }
    }

    function getScaleRatio(): number {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return 1;
      return canvas.width / rect.width;
    }

    function getCanvasCoordinates(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function hitTest(
      x: number,
      y: number
    ): {
      hitObject: CanvasObject | null;
      handle: 'scale' | 'rotate' | 'delete' | null;
    } {
      const sr = getScaleRatio();
      const hitR = Math.max(30 * sr, 30);
      const stalkH = 26 * sr;

      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;

        const dx = x - cx;
        const dy = y - cy;
        const cos = Math.cos(-obj.rotation);
        const sin = Math.sin(-obj.rotation);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        const hw = obj.width / 2;
        const hh = obj.height / 2;
        const pad = 10 * sr;

        if (selectedObjectId === obj.id) {
          // 1. Rotate handle check
          if (Math.hypot(localX, localY - (-hh - pad - stalkH)) <= hitR) {
            return { hitObject: obj, handle: 'rotate' };
          }

          // 2. Corner scale handles check
          const corners = [
            { x: -hw - pad, y: -hh - pad },
            { x: hw + pad, y: -hh - pad },
            { x: -hw - pad, y: hh + pad },
            { x: hw + pad, y: hh + pad },
          ];
          for (const c of corners) {
            if (Math.hypot(localX - c.x, localY - c.y) <= hitR) {
              return { hitObject: obj, handle: 'scale' };
            }
          }
        }

        // Body hit test
        if (Math.abs(localX) <= hw + pad + 15 * sr && Math.abs(localY) <= hh + pad + 15 * sr) {
          return { hitObject: obj, handle: null };
        }
      }
      return { hitObject: null, handle: null };
    }

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const { x, y } = getCanvasCoordinates(e);
      pointerDownX = x;
      pointerDownY = y;
      lastPointerX = x;
      lastPointerY = y;

      if (currentTool === 'pencil') {
        saveHistory();
        // Calibrate stroke factor with square root scaling to avoid huge blobs on high-res camera photos
        const factor = Math.max(1, Math.sqrt(Math.max(canvas.width, canvas.height) / 720));
        currentFreeStroke = {
          color: currentColor,
          width: Math.round(currentStrokeWidth * factor),
          points: [{ x, y }],
        };
        strokes.push(currentFreeStroke);
        renderAll();
        if (e.cancelable) e.preventDefault();
        return;
      }

      const { hitObject, handle } = hitTest(x, y);

      if (hitObject) {
        selectedObjectId = hitObject.id;
        dragStartX = x;
        dragStartY = y;
        objStartX = hitObject.x;
        objStartY = hitObject.y;
        objStartW = hitObject.width;
        objStartH = hitObject.height;
        objStartFontSize = hitObject.fontSize || 36;
        objStartRotation = hitObject.rotation || 0;

        if (handle === 'scale' || handle === 'rotate') {
          isTransforming = true;
          transformMode = handle;
        } else {
          isDragging = true;
        }
        renderAll();
        if (e.cancelable) e.preventDefault();
      } else {
        selectedObjectId = null;
        renderAll();
      }
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const { x, y } = getCanvasCoordinates(e);
      lastPointerX = x;
      lastPointerY = y;

      if (currentTool === 'pencil' && currentFreeStroke) {
        const lastPt = currentFreeStroke.points[currentFreeStroke.points.length - 1];
        if (!lastPt || Math.hypot(x - lastPt.x, y - lastPt.y) >= 2) {
          currentFreeStroke.points.push({ x, y });
          renderAll();
        }
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (isDragging && selectedObjectId) {
        const obj = objects.find((o) => o.id === selectedObjectId);
        if (obj) {
          obj.x = objStartX + (x - dragStartX);
          obj.y = objStartY + (y - dragStartY);
          renderAll();
        }
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (isTransforming && selectedObjectId && transformMode) {
        const obj = objects.find((o) => o.id === selectedObjectId);
        if (obj) {
          const cx = objStartX + objStartW / 2;
          const cy = objStartY + objStartH / 2;

          if (transformMode === 'scale') {
            const currentDist = Math.hypot(x - cx, y - cy);
            const startDist = Math.max(20, Math.hypot(dragStartX - cx, dragStartY - cy));
            const ratio = currentDist / startDist;
            const newW = Math.max(28, Math.round(objStartW * ratio));
            const newH = Math.max(28, Math.round(objStartH * ratio));
            obj.x = cx - newW / 2;
            obj.y = cy - newH / 2;
            obj.width = newW;
            obj.height = newH;
            if (objStartFontSize) {
              obj.fontSize = Math.max(14, Math.round(objStartFontSize * ratio));
            }
          } else if (transformMode === 'rotate') {
            const currentAngle = Math.atan2(y - cy, x - cx);
            const startAngle = Math.atan2(dragStartY - cy, dragStartX - cx);
            obj.rotation = objStartRotation + (currentAngle - startAngle);
          }
          renderAll();
        }
        if (e.cancelable) e.preventDefault();
      }
    };

    const onPointerUp = () => {
      const movedDist = Math.hypot(pointerDownX - lastPointerX, pointerDownY - lastPointerY);

      // Si fue un tap sobre un card de ubicación o reloj sin haber arrastrado ni transformado, alternar estilo (white <-> dark)
      if (selectedObjectId && !isTransforming && !currentFreeStroke && movedDist < 8) {
        const selObj = objects.find((o) => o.id === selectedObjectId);
        if (selObj && (selObj.type === 'location' || selObj.type === 'clock')) {
          saveHistory();
          selObj.cardStyle = selObj.cardStyle === 'white' ? 'dark' : 'white';
          renderAll();
        }
      }

      if (currentTool === 'pencil' && currentFreeStroke) {
        currentFreeStroke = null;
      }
      if (isDragging || isTransforming) {
        saveHistory();
      }
      isDragging = false;
      isTransforming = false;
      transformMode = null;
    };

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp, { passive: false });

    // Color Swatches
    overlay.querySelectorAll('.wa-color-swatch').forEach((sw) => {
      sw.addEventListener('click', () => {
        overlay.querySelectorAll('.wa-color-swatch').forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        currentColor = sw.getAttribute('data-color') || '#10b981';

        if (selectedObjectId) {
          const selObj = objects.find((o) => o.id === selectedObjectId);
          if (selObj) {
            saveHistory();
            selObj.color = currentColor;
            renderAll();
          }
        }
      });
    });

    // Stroke width buttons
    overlay.querySelectorAll('.wa-stroke-btn').forEach((sBtn) => {
      sBtn.addEventListener('click', () => {
        overlay.querySelectorAll('.wa-stroke-btn').forEach((b) => b.classList.remove('active'));
        sBtn.classList.add('active');
        currentStrokeWidth = Number(sBtn.getAttribute('data-width')) || 7;

        if (selectedObjectId) {
          const selObj = objects.find((o) => o.id === selectedObjectId);
          if (selObj) {
            saveHistory();
            const factor = Math.max(1, Math.sqrt(Math.max(canvas.width, canvas.height) / 720));
            selObj.strokeWidth = Math.round(currentStrokeWidth * factor);
            renderAll();
          }
        }
      });
    });

    // Delete selected object
    deleteBtn.addEventListener('click', () => {
      if (selectedObjectId) {
        saveHistory();
        const idx = objects.findIndex((o) => o.id === selectedObjectId);
        if (idx !== -1) objects.splice(idx, 1);
        selectedObjectId = null;
        renderAll();
      }
    });

    // Keyboard delete / backspace
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        const activeEl = document.activeElement;
        if (activeEl === captionInput || activeEl === inputModalText) return;
        saveHistory();
        const idx = objects.findIndex((o) => o.id === selectedObjectId);
        if (idx !== -1) objects.splice(idx, 1);
        selectedObjectId = null;
        renderAll();
      }
    });

    // Tools
    overlay.querySelectorAll('.wa-tool-pill[data-tool]').forEach((pill) => {
      pill.addEventListener('click', async () => {
        const tool = pill.getAttribute('data-tool');
        if (tool === 'emoji') {
          stickersPopover.style.display =
            stickersPopover.style.display === 'none' ? 'block' : 'none';
          return;
        }
        stickersPopover.style.display = 'none';

        if (tool === 'pencil') {
          currentTool = currentTool === 'pencil' ? 'none' : 'pencil';
          overlay.querySelectorAll('.wa-tool-pill').forEach((p) => p.classList.remove('active'));
          if (currentTool === 'pencil') pill.classList.add('active');
          return;
        }

        currentTool = 'none';
        overlay.querySelectorAll('.wa-tool-pill').forEach((p) => p.classList.remove('active'));

        const factor = Math.max(1, Math.max(canvas.width, canvas.height) / 750);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        if (tool === 'arrow') {
          saveHistory();
          const w = Math.round(180 * factor);
          const h = Math.round(50 * factor);
          const newObj: CanvasObject = {
            id: `arrow_${Date.now()}`,
            type: 'arrow',
            x: cx - w / 2,
            y: cy - h / 2,
            width: w,
            height: h,
            rotation: 0,
            color: currentColor,
            strokeWidth: Math.round(currentStrokeWidth * factor),
          };
          objects.push(newObj);
          selectedObjectId = newObj.id;
          renderAll();
        } else if (tool === 'rect') {
          saveHistory();
          const size = Math.round(180 * factor);
          const newObj: CanvasObject = {
            id: `rect_${Date.now()}`,
            type: 'rect',
            x: cx - size / 2,
            y: cy - size / 2,
            width: size,
            height: size,
            rotation: 0,
            color: currentColor,
            strokeWidth: Math.round(currentStrokeWidth * factor),
          };
          objects.push(newObj);
          selectedObjectId = newObj.id;
          renderAll();
        } else if (tool === 'circle') {
          saveHistory();
          const size = Math.round(180 * factor);
          const newObj: CanvasObject = {
            id: `circle_${Date.now()}`,
            type: 'circle',
            x: cx - size / 2,
            y: cy - size / 2,
            width: size,
            height: size,
            rotation: 0,
            color: currentColor,
            strokeWidth: Math.round(currentStrokeWidth * factor),
          };
          objects.push(newObj);
          selectedObjectId = newObj.id;
          renderAll();
        } else if (tool === 'text') {
          const text = await promptModal('Escriba el texto para la foto:', 'Texto corporativo');
          if (text) {
            saveHistory();
            const fontSize = Math.round(38 * factor);
            const w = Math.round(Math.max(200, text.length * 24) * factor);
            const h = Math.round(60 * factor);
            const newObj: CanvasObject = {
              id: `text_${Date.now()}`,
              type: 'text',
              text,
              x: cx - w / 2,
              y: cy - h / 2,
              width: w,
              height: h,
              rotation: 0,
              color: currentColor,
              fontSize,
            };
            objects.push(newObj);
            selectedObjectId = newObj.id;
            renderAll();
          }
        }
      });
    });

    // Sticker / Emoji Selection
    overlay.querySelectorAll('.wa-emoji-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const em = btn.getAttribute('data-emoji') || '⭐';
        stickersPopover.style.display = 'none';
        saveHistory();
        const factor = Math.max(1, Math.max(canvas.width, canvas.height) / 750);
        const size = Math.round(100 * factor);
        const newObj: CanvasObject = {
          id: `emoji_${Date.now()}`,
          type: 'emoji',
          text: em,
          x: canvas.width / 2 - size / 2,
          y: canvas.height / 2 - size / 2,
          width: size,
          height: size,
          rotation: 0,
          color: currentColor,
          fontSize: Math.round(64 * factor),
        };
        objects.push(newObj);
        selectedObjectId = newObj.id;
        renderAll();
      });
    });

    // Location Sticker
    overlay.querySelector('#wa-tool-location')?.addEventListener('click', async () => {
      const locationName =
        (await promptModal('Nombre de la ubicación para la foto:', 'Lima, Perú')) || 'Ubicación Actual';
      saveHistory();
      const factor = Math.max(1, Math.sqrt(Math.max(canvas.width, canvas.height) / 720));
      const fontSize = Math.round(18 * factor);
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textMetrics = ctx.measureText(locationName);
      const w = Math.round(textMetrics.width + 68 * factor);
      const h = Math.round(48 * factor);
      const newObj: CanvasObject = {
        id: `loc_${Date.now()}`,
        type: 'location',
        text: locationName,
        x: canvas.width / 2 - w / 2,
        y: canvas.height / 2 - h / 2,
        width: w,
        height: h,
        rotation: 0,
        color: currentColor === '#ffffff' ? '#ef4444' : currentColor,
        fontSize,
        cardStyle: 'white',
      };
      objects.push(newObj);
      selectedObjectId = newObj.id;
      renderAll();
    });

    // Clock / Time Sticker
    overlay.querySelector('#wa-tool-clock')?.addEventListener('click', () => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      saveHistory();
      const factor = Math.max(1, Math.sqrt(Math.max(canvas.width, canvas.height) / 720));
      const fontSize = Math.round(22 * factor);
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;
      const textMetrics = ctx.measureText(timeStr);
      const w = Math.round(textMetrics.width + 68 * factor);
      const h = Math.round(48 * factor);
      const newObj: CanvasObject = {
        id: `clock_${Date.now()}`,
        type: 'clock',
        text: timeStr,
        x: canvas.width / 2 - w / 2,
        y: canvas.height / 2 - h / 2,
        width: w,
        height: h,
        rotation: 0,
        color: currentColor === '#ffffff' ? '#38bdf8' : currentColor,
        fontSize,
        cardStyle: 'dark',
      };
      objects.push(newObj);
      selectedObjectId = newObj.id;
      renderAll();
    });

    // Rotate 90 deg
    overlay.querySelector('#wa-btn-rotate')?.addEventListener('click', () => {
      rotationAngle = (rotationAngle + 90) % 360;
      setupCanvasSize();
    });

    // Undo
    overlay.querySelector('#wa-btn-undo')?.addEventListener('click', () => {
      if (historyStack.length > 0) {
        const last = historyStack.pop()!;
        objects.length = 0;
        objects.push(...last.objects);
        strokes.length = 0;
        strokes.push(...last.strokes);
        selectedObjectId = null;
        renderAll();
      }
    });

    // Cancel
    overlay.querySelector('#wa-btn-cancel')?.addEventListener('click', () => {
      cleanup();
      if (onCancel) onCancel();
    });

    // Send photo
    const sendPhoto = () => {
      selectedObjectId = null;
      renderAll();

      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const caption = captionInput.value.trim();
      const finalFilename = imageFile.name.replace(/\.[^/.]+$/, '') + '-editada.jpg';

      cleanup();
      onSend({
        dataUrl: finalDataUrl,
        filename: finalFilename,
        caption,
      });
    };

    overlay.querySelector('#wa-btn-send')?.addEventListener('click', sendPhoto);
    captionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendPhoto();
      }
    });

    function cleanup() {
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      overlay.remove();
    }

    setupCanvasSize();
    window.addEventListener('resize', setupCanvasSize, { once: true });
    captionInput.focus();
  }
}
