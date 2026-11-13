import type { Sequence } from '../../domain/model';

const TAB_KEY = 'points.tab-id';
const STORAGE_PREFIX = 'points.sequence.';

function tabId(): string {
  let value = sessionStorage.getItem(TAB_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(TAB_KEY, value);
  }
  return value;
}

export function saveSequence(sequence: Sequence): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + tabId(), JSON.stringify(sequence));
  } catch {
    // Storage can be unavailable or full. The editor remains usable.
  }
}

export function restoreSequence(): Sequence | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tabId());
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && 'notation' in value && 'beats' in value
      ? value as Sequence
      : null;
  } catch {
    return null;
  }
}

export function clearSavedSequence(): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + tabId());
  } catch {
    // Ignore storage failures.
  }
}

export function subscribeToSequencePersistence(
  getSequence: () => Sequence,
  onRestore: (sequence: Sequence) => void,
): () => void {
  const restored = restoreSequence();
  if (restored) onRestore(restored);
  const save = () => saveSequence(getSequence());
  const timer = window.setInterval(save, 1500);
  window.addEventListener('pagehide', save);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('pagehide', save);
    save();
  };
}
