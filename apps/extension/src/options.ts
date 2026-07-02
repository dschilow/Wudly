import { DEFAULT_SETTINGS, loadSettings, type Settings } from './types';

const enabled = document.getElementById('enabled') as HTMLInputElement;
const reporting = document.getElementById('reporting') as HTMLInputElement;
const apiUrl = document.getElementById('apiUrl') as HTMLInputElement;
const saved = document.getElementById('saved') as HTMLDivElement;

void loadSettings().then((s) => {
  enabled.checked = s.enabled;
  reporting.checked = s.reporting;
  apiUrl.value = s.apiUrl;
});

let timer: ReturnType<typeof setTimeout> | undefined;
async function save(): Promise<void> {
  const settings: Settings = {
    enabled: enabled.checked,
    reporting: reporting.checked,
    apiUrl: apiUrl.value.trim() || DEFAULT_SETTINGS.apiUrl,
  };
  await chrome.storage.local.set(settings);
  saved.style.visibility = 'visible';
  clearTimeout(timer);
  timer = setTimeout(() => (saved.style.visibility = 'hidden'), 1500);
}

enabled.addEventListener('change', () => void save());
reporting.addEventListener('change', () => void save());
apiUrl.addEventListener('change', () => void save());

/* "Warum sehe ich nichts?" — one click shows whether the API is reachable.
 * Also warms a sleeping free-tier instance, so the next page view answers fast. */
const test = document.getElementById('test') as HTMLButtonElement;
const testStatus = document.getElementById('teststatus') as HTMLSpanElement;

test.addEventListener('click', () => {
  void (async () => {
    // Persist a just-typed URL first, then test exactly what will be used.
    await save();
    const base = (apiUrl.value.trim() || DEFAULT_SETTINGS.apiUrl).replace(/\/+$/, '');
    testStatus.className = '';
    testStatus.textContent = 'Prüfe … (schlafende API braucht bis zu 30 s)';
    try {
      const res = await fetch(`${base}/sightings/resolve?q=verbindungstest`, {
        credentials: 'omit',
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        testStatus.className = 'ok';
        testStatus.textContent = '✓ API erreichbar';
      } else {
        testStatus.className = 'fail';
        testStatus.textContent = `✗ API antwortet mit HTTP ${res.status}`;
      }
    } catch {
      testStatus.className = 'fail';
      testStatus.textContent = '✗ Nicht erreichbar (URL prüfen / API gestartet?)';
    }
  })();
});
