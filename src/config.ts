import { PP_VARIABLES } from './constants';

export const DEFAULT_PAGE_DURATION_SECONDS = 30;

export const PAGE_DURATION_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 10, label: '10s' },
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '1m' },
  { seconds: 120, label: '2m' },
  { seconds: 300, label: '5m' },
];

/**
 * A PP_VARIABLES string value that still looks like the raw template (e.g.
 * `"[Slide Duration]"`) means MI didn't substitute it — treat as unset.
 */
function isUnsubstitutedTemplate(s: string): boolean {
  return s.startsWith('[') && s.endsWith(']');
}

function parseSeconds(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 1 ? raw : null;
  }

  if (typeof raw === 'string') {
    if (isUnsubstitutedTemplate(raw)) {
      return null;
    }

    const n = Number(raw);

    return Number.isFinite(n) && n >= 1 ? n : null;
  }

  return null;
}

export function getInitialPageDurationSeconds(): number {
  return parseSeconds(PP_VARIABLES.PAGE_DURATION_SECONDS) ?? DEFAULT_PAGE_DURATION_SECONDS;
}

/**
 * Returns the configured folder ids (from PP_VARIABLES.FOLDERS), or null
 * when unconfigured — in which case the app falls back to the folder picker.
 */
export function getConfiguredFolderIds(): string[] | null {
  const raw = PP_VARIABLES.FOLDERS;

  if (raw === undefined || raw === null) {
    return null;
  }

  let parts: string[] = [];

  if (Array.isArray(raw)) {
    parts = raw.map((v) => String(v).trim()).filter(Boolean);
  } else if (typeof raw === 'number') {
    parts = [String(raw)];
  } else if (typeof raw === 'string') {
    if (isUnsubstitutedTemplate(raw)) {
      return null;
    }

    parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return parts.length > 0 ? parts : null;
}
