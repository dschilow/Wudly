import type { SightingResolutionDto } from '@wudly/shared';
import type { DetectedProduct } from './types';

/**
 * The visible "Wudly Signal": a compact pill bottom-right that expands into a
 * verdict card. Lives in a Shadow DOM island so shop CSS can't leak in (or
 * ours out). Deliberately quiet — a trust signal, not an ad banner.
 */

const HOST_ID = 'wudly-signal-host';

/** Closes the open card on Escape; unregistered together with the overlay. */
let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

export function removeOverlay(): void {
  document.getElementById(HOST_ID)?.remove();
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler, true);
    escapeHandler = null;
  }
}

export function mountLoadingPill(product: DetectedProduct): void {
  removeOverlay();
  if (sessionStorage.getItem(dismissKey(product))) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'closed' });
  root.appendChild(styles());

  const pill = document.createElement('button');
  pill.className = 'pill loading';
  pill.type = 'button';
  pill.disabled = true;
  pill.title = 'Wudly prüft dieses Produkt';
  pill.setAttribute('aria-busy', 'true');
  pill.innerHTML = '<span class="dot queued pulse"></span><span class="label">Wudly prüft...</span>';

  root.append(pill);
  document.documentElement.appendChild(host);
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

  // One demand signal per page view, no matter how many parts of the card the
  // user touches — otherwise opening and then clicking a CTA counts twice and
  // inflates the ranking that decides where research budget goes.
  let engaged = false;
  const engageOnce = (): void => {
    if (engaged) return;
    engaged = true;
    onEngage(product);
  };

  const pill = buildPill(result);
  const card = buildCard(product, result, engageOnce);
  card.hidden = true;

  const setOpen = (open: boolean): void => {
    card.hidden = !open;
    pill.classList.toggle('open', open);
    pill.setAttribute('aria-expanded', String(open));
    if (open) engageOnce();
  };

  pill.addEventListener('click', () => setOpen(card.hidden));

  escapeHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || card.hidden) return;
    setOpen(false);
    pill.focus();
  };
  document.addEventListener('keydown', escapeHandler, true);

  root.append(card, pill);
  document.documentElement.appendChild(host);
}

function buildPill(result: SightingResolutionDto): HTMLButtonElement {
  const pill = document.createElement('button');
  pill.className = 'pill';
  pill.type = 'button';
  pill.setAttribute('aria-expanded', 'false');

  const known = result.status === 'known';
  const rebuy = result.product?.rebuyScore;
  const consensus = result.product?.externalAvgPercent;

  const dot = `<span class="dot ${known ? 'known' : 'queued'}"></span>`;
  let label = 'Wudly';
  if (known && rebuy != null) label = `Wiederkauf ${Math.round(rebuy)} %`;
  else if (known && consensus != null) label = `Netz-Konsens ${Math.round(consensus)} %`;
  pill.title = known ? `Wudly Signal — ${label}` : 'Wudly Signal — noch kein Besitzer-Urteil';
  pill.setAttribute('aria-label', pill.title);
  pill.innerHTML = `${dot}<span class="label">${escapeHtml(label)}</span>`;
  return pill;
}

function buildCard(
  product: DetectedProduct,
  result: SightingResolutionDto,
  onEngage: () => void,
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Wudly Signal');
  const p = result.product;
  const name = p?.canonicalName ?? product.title;

  // Shop rating from the page's own structured data, normalized to 0–100 —
  // the raw material for the "Sterne-Lücke" (star gap) comparison.
  const rating = product.rating;
  const shopPercent =
    rating && rating.maxValue > 0 ? Math.round((rating.value / rating.maxValue) * 100) : null;

  const rows: string[] = [];
  let hasSignal = false;
  if (p) {
    if (p.wudlySeal) rows.push(`<div class="seal">Wudly-empfohlen</div>`);
    const rebuy = p.rebuyScore != null ? Math.round(p.rebuyScore) : null;
    if (rebuy != null) {
      hasSignal = true;
      rows.push(stat('Wiederkauf', `${rebuy} %`, `${p.ownerCount} Besitzer`));
    }
    if (rating && shopPercent != null) {
      rows.push(
        stat(
          'Shop-Bewertung',
          `${formatStars(rating.value)} ★`,
          rating.count ? `${rating.count} Stimmen · ~${shopPercent} %` : `~${shopPercent} %`,
        ),
      );
    }
    if (p.externalAvgPercent != null) {
      hasSignal = true;
      rows.push(
        stat(
          'Netz-Konsens',
          `${Math.round(p.externalAvgPercent)} %`,
          `${p.externalSourceCount} ${p.externalSourceCount === 1 ? 'Quelle' : 'Quellen'}`,
        ),
      );
    }
    // The one line no star rating can give: stars measure the purchase moment,
    // the rebuy score measures whether owners STAY happy. Called out when the
    // shop's stars clearly oversell the product.
    if (rebuy != null && shopPercent != null && shopPercent - rebuy >= 15) {
      rows.push(
        `<p class="gap"><strong>Sterne-Lücke:</strong> Der Shop zeigt ${shopPercent} % — aber nur ${rebuy} % der Besitzer würden wieder kaufen.</p>`,
      );
    }
    if (result.topRegretReason) {
      rows.push(
        `<p class="line"><span class="line-label">Häufigste Kaufreue:</span> ${escapeHtml(result.topRegretReason)}</p>`,
      );
    }
    if (result.topAlternative) {
      rows.push(
        `<p class="line"><span class="line-label">Besitzer wechselten zu:</span> ${escapeHtml(result.topAlternative)}</p>`,
      );
    }
    if (!hasSignal) {
      rows.push(
        `<p class="note">Schon im Wudly-Katalog — noch kein Besitzer-Urteil. Sei die erste Stimme.</p>`,
      );
    }
  } else {
    // Deliberately no "wird gerade aufgenommen" any more: that was a promise
    // the backend cannot keep. Paid enrichment is budgeted and only reaches
    // products that prove demand, so a queued sighting may wait — or never
    // make it. State the fact, and hand over the one action that helps now.
    rows.push(`<p class="note">Zu diesem Produkt gibt es bei Wudly noch kein Besitzer-Urteil.</p>`);
  }

  const cta = result.webUrl
    ? `<a class="cta" href="${escapeAttr(result.webUrl)}" target="_blank" rel="noopener">Bei Wudly ansehen</a>`
    : result.searchUrl
      ? `<a class="cta" href="${escapeAttr(result.searchUrl)}" target="_blank" rel="noopener">Auf Wudly prüfen</a>`
      : '';
  // Owner shortcut: the extension is not just a consumer of the owner truth,
  // it recruits the next voice — straight into the 30-second verdict flow.
  const ownCta = result.ownUrl
    ? `<a class="own" href="${escapeAttr(result.ownUrl)}" target="_blank" rel="noopener">Besitzt du es? 30-Sekunden-Urteil abgeben →</a>`
    : '';

  card.innerHTML = `
    <div class="head">
      <span class="brand"><span class="dot known"></span>Wudly Signal</span>
      <button class="close" type="button" aria-label="Ausblenden">×</button>
    </div>
    <div class="name">${escapeHtml(name.slice(0, 90))}</div>
    ${rows.join('')}
    ${cta}
    ${ownCta}
  `;

  card.querySelector('.close')?.addEventListener('click', () => {
    sessionStorage.setItem(dismissKey(product), '1');
    removeOverlay();
  });
  card.querySelector('.cta')?.addEventListener('click', () => onEngage());
  card.querySelector('.own')?.addEventListener('click', () => onEngage());
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

/** German decimal comma, one digit ("4.6" → "4,6"). */
function formatStars(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1).replace('.', ',');
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
  // Every color goes through a token so the dark scheme is one override block
  // — the overlay sits on top of shops that are themselves light or dark.
  style.textContent = `
    :host {
      all: initial;
      --ink: #0c0d12;
      --paper: #ffffff;
      --muted: #5b5f6d;
      --faint: #9aa0ae;
      --body: #3a3d49;
      --line: #0c0d1226;
      --hairline: #0c0d1216;
      --accent: #0aa06a;
      --accent-ink: #077951;
      --accent-wash: #0aa06a14;
      --warn-ink: #8f1d1d;
      --warn-wash: #c6282812;
      --cta-bg: #14151b;
      --cta-bg-hover: #24262f;
      --cta-ink: #ffffff;
      --shadow: 0 12px 32px #0c0d122e;
      --shadow-pill: 0 4px 16px #0c0d1224;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --ink: #f1f2f5;
        --paper: #17181e;
        --muted: #a2a7b4;
        --faint: #767b89;
        --body: #d3d6dd;
        --line: #ffffff26;
        --hairline: #ffffff1a;
        --accent: #21c58a;
        --accent-ink: #4ed6a5;
        --accent-wash: #21c58a1f;
        --warn-ink: #ff9d9d;
        --warn-wash: #c628281f;
        --cta-bg: #f1f2f5;
        --cta-bg-hover: #ffffff;
        --cta-ink: #14151b;
        --shadow: 0 12px 32px #00000066;
        --shadow-pill: 0 4px 16px #00000059;
      }
    }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .pill {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 14px; border: 1px solid var(--line); border-radius: 999px;
      background: var(--paper); color: var(--ink); cursor: pointer;
      font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
      box-shadow: var(--shadow-pill); transition: transform 120ms ease;
    }
    .pill:hover { transform: translateY(-1px); }
    .pill:disabled { cursor: wait; }
    .pill.open { box-shadow: 0 2px 8px #0c0d121a; }
    :is(.pill, .close, .cta, .own):focus-visible {
      outline: 2px solid var(--accent); outline-offset: 2px;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .dot.known { background: var(--accent); }
    .dot.queued { background: var(--faint); }
    .dot.pulse { animation: wudly-pulse 900ms ease-in-out infinite; }
    @keyframes wudly-pulse {
      0%, 100% { opacity: 0.45; transform: scale(0.86); }
      50% { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pill { transition: none; }
      .pill:hover { transform: none; }
      .dot.pulse { animation: none; opacity: 0.7; }
    }
    .card {
      position: fixed; right: 16px; bottom: 64px; z-index: 2147483646;
      width: 300px; max-width: calc(100vw - 32px); padding: 14px 16px 16px;
      background: var(--paper); color: var(--ink);
      border: 1px solid var(--line); border-radius: 16px;
      box-shadow: var(--shadow);
      font-size: 13px; line-height: 1.45;
    }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .brand { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .close { border: 0; background: none; color: var(--faint); font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px; }
    .close:hover { color: var(--ink); }
    .name { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
    .seal { display: inline-block; margin-bottom: 8px; padding: 3px 8px; border-radius: 999px; background: var(--accent-wash); color: var(--accent-ink); font-size: 11px; font-weight: 700; }
    .stat { display: flex; align-items: baseline; gap: 8px; padding: 7px 0; border-top: 1px solid var(--hairline); }
    .stat-label { color: var(--muted); flex: 1; }
    .stat-value { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .stat-hint { color: var(--faint); font-size: 11px; }
    .gap {
      margin: 8px 0 0; padding: 8px 10px; border-radius: 10px;
      background: var(--warn-wash); color: var(--warn-ink); font-size: 12px; line-height: 1.45;
    }
    .line { margin: 0; padding: 7px 0 2px; border-top: 1px solid var(--hairline); color: var(--body); font-size: 12px; }
    .line-label { color: var(--muted); font-weight: 600; }
    .note { margin: 0; padding: 7px 0 2px; border-top: 1px solid var(--hairline); color: var(--body); }
    .cta {
      display: block; margin-top: 12px; padding: 9px 12px; border-radius: 10px;
      background: var(--cta-bg); color: var(--cta-ink); text-align: center; text-decoration: none;
      font-weight: 700; font-size: 13px;
    }
    .cta:hover { background: var(--cta-bg-hover); }
    .own {
      display: block; margin-top: 8px; text-align: center; text-decoration: none;
      color: var(--accent-ink); font-weight: 600; font-size: 12px;
    }
    .own:hover { text-decoration: underline; }
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
