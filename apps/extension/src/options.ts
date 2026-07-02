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
