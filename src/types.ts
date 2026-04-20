export interface Folder {
  id: string;
  name: string;
  reportCount: number;
}

export interface Report {
  id: string;
  name: string;
}

/**
 * Power BI objects that MI's External Report can point at.
 *   - report:    a multi-page Power BI report (has pages/tabs to cycle)
 *   - dashboard: a single-canvas dashboard of pinned tiles (no pages)
 *   - tile:      a single tile in focus mode (no pages)
 */
export type EmbedKind = 'report' | 'dashboard' | 'tile';

export interface EmbedInfo {
  kind: EmbedKind;
  /** reportId / dashboardId / tileId — matches kind */
  id: string;
  /** Only set when kind === 'tile'; the dashboard that contains the tile. */
  dashboardId?: string;
  embedUrl: string;
  accessToken: string;
}
