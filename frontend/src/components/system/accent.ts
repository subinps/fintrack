export const ACCENT_STORAGE_KEY = 'fintrack.accent';

export const ACCENTS = [
  { id: 'blue', label: 'Periwinkle (default)' },
  { id: 'violet', label: 'Violet' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'rose', label: 'Rose' },
  { id: 'amber', label: 'Amber' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

export function isAccentId(value: string | null): value is AccentId {
  return ACCENTS.some((accent) => accent.id === value);
}

/** Applies one accent token set to <html>; everything reads --primary from there. */
export function applyAccent(id: AccentId) {
  const root = document.documentElement;
  if (id === 'blue') delete root.dataset.accent;
  else root.dataset.accent = id;
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id);
  } catch {
    /* private mode: the choice simply does not persist */
  }
}

/** Called once before first paint so the saved accent does not flash. */
export function applyStoredAccent() {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentId(stored)) applyAccent(stored);
  } catch {
    /* no access to storage: default accent */
  }
}
