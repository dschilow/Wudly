import type { SightingResolutionDto } from '@wudly/shared';
import type { DetectedProduct } from './types';

/**
 * The visible "Wudly Signal": a compact pill bottom-right that expands into a
 * verdict card. Lives in a Shadow DOM island so shop CSS can't leak in (or
 * ours out). Deliberately quiet — a trust signal, not an ad banner.
 */

const HOST_ID = 'wudly-signal-host';

export function removeOverlay(): void {
  document.getElementById(HOST_ID)?.remove();
}

export function mountOverlay(
  product: DetectedProduct,
  result: SightingResolutionDto,
  onEngage: (product: DetectedProduct) => void,
): void {
  removeOverlay();
  if (sessionStorage.getItem(dismissKey(product))) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'closed' });
  root.appendChild(styles());

  const pill = buildPill(result);
  const card = buildCard(product, result, onEngage);
  card.hidden = true;

  pill.addEventListener('click', () => {
    const opening = card.hidden;
    card.hidden = !card.hidden;
    pill.classList.toggle('open', opening);
    // Opening the card is the "engage" demand signal (once per page view).
    if (opening && !pill.dataset.engaged) {
      pill.dataset.engaged = '1';
      onEngage(product);
    }
  });

  root.append(card, pill);
  document.documentElement.appendChild(host);
}

function buildPill(result: SightingResolutionDto): HTMLButtonElement {
  const pill = document.createElement('button');
  pill.className = 'pill';
  pill.type = 'button';
  pill.title = 'Wudly Signal';

  const known = result.status === 'known';
  const rebuy = result.product?.rebuyScore;
  const consensus = result.product?.externalAvgPercent;

  const dot = `<span class="dot ${known ? 'known' : 'queued'}"></span>`;
  let label = 'Wudly';
  if (known && rebuy != null) label = `Wiederkauf ${Math.round(rebuy)} %`;
  else if (known && consensus != null) label = `Netz-Konsens ${Math.round(consensus)} %`;
  pill.innerHTML = `${dot}<span class="label">${escapeHtml(label)}</span>`;
  return pill;
}

function buildCard(
  product: DetectedProduct,
  result: SightingResolutionDto,
  onEngage: (product: DetectedProduct) => void,
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'card';
  const p = result.product;
  const name = p?.canonicalName ?? product.title;

  const rows: string[] = [];
  if (p) {
    if (p.wudlySeal) rows.push(`<div class="seal">Wudly-empfohlen</div>`);
    if (p.rebuyScore != null) {
      rows.push(stat('Wiederkauf', `${Math.round(p.rebuyScore)} %`, `${p.ownerCount} Besitzer`));
    }
    if (p.externalAvgPercent != null) {
      rows.push(
        stat(
          'Netz-Konsens',
          `${Math.round(p.externalAvgPercent)} %`,
          `${p.externalSourceCount} ${p.externalSourceCount === 1 ? 'Quelle' : 'Quellen'}`,
        ),
      );
    }
    if (rows.length === 0) {
      rows.push(
        `<p class="note">Schon im Wudly-Katalog — noch kein Besitzer-Urteil. Sei die erste Stimme.</p>`,
      );
    }
  } else {
    rows.push(
      `<p class="note">Wudly kennt dieses Produkt noch nicht — es wird gerade in den Katalog aufgenommen.</p>`,
    );
  }

  const cta = result.webUrl
    ? `<a class="cta" href="${escapeAttr(result.webUrl)}" target="_blank" rel="noopener">Bei Wudly ansehen</a>`
    : '';

  card.innerHTML = `
    <div class="head">
      <span class="brand"><span class="dot known"></span>Wudly Signal</span>
      <button class="close" type="button" aria-label="Ausblenden">×</button>
    </div>
    <div class="name">${escapeHtml(name.slice(0, 90))}</div>
    ${rows.join('')}
    ${cta}
  `;

  card.querySelector('.close')?.addEventListener('click', () => {
    sessionStorage.setItem(dismissKey(product), '1');
    removeOverlay();
  });
  card.querySelector('.cta')?.addEventListener('click', () => onEngage(product));
  return card;
}

function stat(label: string, value: string, hint: string): string {
  return `
    <div class="stat">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value)}</span>
      <span class="stat-hint">${escapeHtml(hint)}</span>
    </div>`;
}

function dismissKey(product: DetectedProduct): string {
  return `wudly-dismiss:${product.identifierValue ?? product.title.slice(0, 60)}`;
}

/** Undo all ×-dismissals in this tab — the toolbar icon brings the signal back. */
export function clearDismissals(): void {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('wudly-dismiss:')) sessionStorage.removeItem(key);
  }
}

function styles(): HTMLStyleElement {
  const style = document.createElement('style');
  // Verdict design language: ink on paper, one green accent, no gradients.
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .pill {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 14px; border: 1px solid #0c0d1226; border-radius: 999px;
      background: #ffffff; color: #0c0d12; cursor: pointer;
      font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
      box-shadow: 0 4px 16px #0c0d1224; transition: transform 120ms ease;
    }
    .pill:hover { transform: translateY(-1px); }
    .pill.open { box-shadow: 0 2px 8px #0c0d121a; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .dot.known { background: #0aa06a; }
    .dot.queued { background: #9aa0ae; }
    .card {
      position: fixed; right: 16px; bottom: 64px; z-index: 2147483646;
      width: 300px; padding: 14px 16px 16px;
      background: #ffffff; color: #0c0d12;
      border: 1px solid #0c0d1226; border-radius: 16px;
      box-shadow: 0 12px 32px #0c0d122e;
      font-size: 13px; line-height: 1.45;
    }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .brand { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #5b5f6d; }
    .close { border: 0; background: none; color: #9aa0ae; font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px; }
    .close:hover { color: #0c0d12; }
    .name { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
    .seal { display: inline-block; margin-bottom: 8px; padding: 3px 8px; border-radius: 999px; background: #0aa06a14; color: #077951; font-size: 11px; font-weight: 700; }
    .stat { display: flex; align-items: baseline; gap: 8px; padding: 7px 0; border-top: 1px solid #0c0d1216; }
    .stat-label { color: #5b5f6d; flex: 1; }
    .stat-value { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .stat-hint { color: #9aa0ae; font-size: 11px; }
    .note { margin: 0; padding: 7px 0 2px; border-top: 1px solid #0c0d1216; color: #3a3d49; }
    .cta {
      display: block; margin-top: 12px; padding: 9px 12px; border-radius: 10px;
      background: #14151b; color: #ffffff; text-align: center; text-decoration: none;
      font-weight: 700; font-size: 13px;
    }
    .cta:hover { background: #24262f; }
  `;
  return style;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
