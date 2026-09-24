// Kleine DOM-Hilfen für die Oberfläche.

import { esc } from '../util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Ereignisdelegation: Elemente mit data-act="name" rufen handlers[name](el, event) auf
export function delegate(root, handlers) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    if (el.disabled || el.classList.contains('disabled')) return;
    const fn = handlers[el.dataset.act];
    if (fn) { e.stopPropagation(); fn(el, e); }
  });
}

export function bar(frac, color = '#8b1a1a', extra = '') {
  const pct = Math.max(0, Math.min(100, Math.round(frac * 100)));
  return `<span class="bar ${extra}"><span style="width:${pct}%;background:${color}"></span></span>`;
}

export function swatch(color) {
  return `<span class="swatch" style="background:${esc(color)}"></span>`;
}

let toastTimer = null;
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Modales Fenster; gibt Promise zurück, das mit dem Wert von close(value) aufgelöst wird
const modalStack = [];
export function openModal(html, opts = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : '');
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${opts.closable !== false ? '<button class="modal-x" data-act="__close" aria-label="×">×</button>' : ''}<div class="modal-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    const entry = { wrap, resolve, opts };
    modalStack.push(entry);
    const close = (v) => {
      wrap.remove();
      const i = modalStack.indexOf(entry);
      if (i >= 0) modalStack.splice(i, 1);
      resolve(v);
    };
    entry.close = close;
    const handlers = { __close: () => close(opts.cancelValue ?? null), ...(opts.handlers ? opts.handlers(close, wrap) : {}) };
    delegate(wrap, handlers);
    if (opts.closable !== false) {
      wrap.addEventListener('click', (e) => { if (e.target === wrap) close(opts.cancelValue ?? null); });
    }
    if (opts.onOpen) opts.onOpen(wrap, close);
  });
}

export function topModal() { return modalStack[modalStack.length - 1] || null; }
export function closeTopModal() { const m = topModal(); if (m && m.opts.closable !== false) m.close(m.opts.cancelValue ?? null); }
export function modalOpen() { return modalStack.length > 0; }
