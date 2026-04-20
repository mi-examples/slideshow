import { PP_VARIABLES } from './constants';

export interface Theme {
  primary: string;
  accent: string;
}

export const DEFAULT_THEME: Theme = {
  primary: '#000000',
  accent: '#075b7e',
};

function parseColor(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  // Unsubstituted template literal like "[Primary Color]".
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return null;
  }

  return trimmed;
}

export function getTheme(): Theme {
  return {
    primary: parseColor(PP_VARIABLES.PRIMARY_COLOR) ?? DEFAULT_THEME.primary,
    accent: parseColor(PP_VARIABLES.ACCENT_COLOR) ?? DEFAULT_THEME.accent,
  };
}
