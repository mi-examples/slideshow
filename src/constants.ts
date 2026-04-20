export interface PPVariables {
  /**
   * Default time each page is displayed, in SECONDS.
   * Substituted at runtime by the MI portal page (e.g. `[Slide Duration]`).
   */
  PAGE_DURATION_SECONDS?: number | string;

  /**
   * Folders whose External Reports should be shown, in order.
   * Substituted at runtime by MI (e.g. `[Folders]`). Expected to arrive as
   * either a single id, a CSV string of ids, or an array of ids.
   */
  FOLDERS?: number | string | (number | string)[];

  /**
   * Brand colors. Accept any CSS color value (e.g. `#0063a6`, `rgb(...)`).
   * Any unsubstituted `[Primary Color]`-style template falls back to defaults.
   */
  PRIMARY_COLOR?: string;
  ACCENT_COLOR?: string;
}

export const PP_VARIABLES: PPVariables =
  typeof window !== 'undefined' && typeof window.PP_VARIABLES === 'object'
    ? (window.PP_VARIABLES as PPVariables)
    : ({} as PPVariables);
