export type ToastVariant = 'success' | 'info' | 'warning' | 'danger';

export function formatSystemCurrency(amount: number, currency = 'PEN'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'S/';
  const num = Number(amount || 0);
  return `${symbol} ${num.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function showSystemToast(
  title: string,
  message: string,
  variant: ToastVariant = 'info'
): void {
  const mappedType =
    variant === 'danger' ? 'error' : variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : 'info';
  const w = window as any;
  if (typeof w.showToast === 'function') {
    w.showToast(`${title}: ${message}`, mappedType);
    return;
  }
  console.log(`[Toast ${mappedType}] ${title}: ${message}`);
}

export function showSystemConfirmModal(opts: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
}): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById('omnichannel-confirm-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('dialog');
    dialog.id = 'omnichannel-confirm-dialog';
    dialog.className = 'crm-modal-surface';
    dialog.setAttribute('data-style', 'modern-clean');
    dialog.style.cssText =
      'padding:0;border:none;border-radius:18px;max-width:420px;width:92%;box-shadow:0 24px 60px rgba(0,0,0,0.45);background:var(--widget-bg,#ffffff);color:var(--text-primary,#0f172a);';

    const confirmBg =
      opts.variant === 'danger'
        ? '#ef4444'
        : opts.variant === 'warning'
        ? '#f59e0b'
        : '#4f46e5';

    dialog.innerHTML = `
      <div style="padding:20px 22px;">
        <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:700;">${opts.title}</h3>
        <p style="margin:0 0 18px 0;font-size:13px;line-height:1.5;opacity:0.85;">${opts.message}</p>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" id="omni-confirm-cancel" style="padding:8px 14px;border-radius:10px;border:1px solid rgba(148,163,184,0.35);background:transparent;color:inherit;font-size:12.5px;font-weight:600;cursor:pointer;">
            ${opts.cancelText || 'Cancelar'}
          </button>
          <button type="button" id="omni-confirm-ok" style="padding:8px 16px;border-radius:10px;border:none;background:${confirmBg};color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;">
            ${opts.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const cleanup = (result: boolean) => {
      try {
        dialog.close();
      } catch {}
      dialog.remove();
      resolve(result);
    };

    dialog.querySelector('#omni-confirm-cancel')?.addEventListener('click', () => cleanup(false));
    dialog.querySelector('#omni-confirm-ok')?.addEventListener('click', () => cleanup(true));
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      cleanup(false);
    });

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      cleanup(window.confirm(`${opts.title}\n\n${opts.message}`));
    }
  });
}
