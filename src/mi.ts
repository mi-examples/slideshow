/**
 * Metric Insights API client.
 *
 * Endpoints used:
 *   - GET /api/folder_element?folder_id=N            — list elements in a folder (public API)
 *   - GET /api/element_info?element=N                — element info incl. external_report_url (public API)
 *   - GET /data/service/intermediate-page/token      — Power BI AAD access token (internal, same-origin)
 *
 * Docs:
 *   - Folder API:  https://help.metricinsights.com/m/API_Access/l/1735182-folder-api
 *   - Element API: https://help.metricinsights.com/m/API_Access/l/1965779-element-api-v701
 *   - Embedding:   https://help.metricinsights.com/m/Embedding/l/102048-embedding-content-on-an-external-webpage
 *
 * Runs as a portal-page app; same-origin session cookies authenticate requests.
 */

import type { EmbedInfo, EmbedKind, Report } from './types';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });

  if (!res.ok) {
    throw new Error(`MI ${path} failed: ${res.status} ${res.statusText}`);
  }

  // Some MI endpoints return JSON with Content-Type: text/plain.
  const text = await res.text();

  return JSON.parse(text) as T;
}

interface FolderElementRow {
  element_id: number | string;
  element_name?: string;
  element_dashboard_name?: string;
  element_type?: string;
  display_order?: number | string;
}

interface FolderElementResponse {
  folder_elements?: FolderElementRow[];
}

interface ElementInfoRow {
  id: number | string;
  name?: string;
  element_type?: string;
  content_type?: string;
  content_type_alias?: string;
  plugin_internal_name?: string;
  external_report_url?: string;
}

// When queried with ?element=N the backend returns `info` as a SINGLE object
// (mapEntity). Without an element id it returns an array (mapEntities). We
// always query by element id, but accept both shapes defensively.
interface ElementInfoResponse {
  info?: ElementInfoRow | ElementInfoRow[];
}

interface TokenResponse {
  status?: string;
  access_token?: string;
}

const EXTERNAL_REPORT_TYPE = 'external report';

function isExternalReport(elementType: string | undefined): boolean {
  return (elementType ?? '').toLowerCase() === EXTERNAL_REPORT_TYPE;
}

export type ParsedPowerBiUrl =
  | { kind: 'report'; groupId: string; reportId: string }
  | { kind: 'dashboard'; groupId: string; dashboardId: string }
  | { kind: 'tile'; groupId: string; dashboardId: string; tileId: string };

/**
 * Parses an external_report_url. Recognized patterns:
 *   /groups/<G>/reports/<R>/...
 *   /groups/<G>/dashboards/<D>/...
 *   /groups/<G>/dashboards/<D>/tiles/<T>/...  (tile in focus mode)
 */
export function parsePowerBiUrl(url: string): ParsedPowerBiUrl | null {
  const tileMatch = url.match(/\/groups\/([^/]+)\/dashboards\/([^/?#]+)\/tiles\/([^/?#]+)/);

  if (tileMatch) {
    return { kind: 'tile', groupId: tileMatch[1], dashboardId: tileMatch[2], tileId: tileMatch[3] };
  }

  const reportMatch = url.match(/\/groups\/([^/]+)\/reports\/([^/?#]+)/);

  if (reportMatch) {
    return { kind: 'report', groupId: reportMatch[1], reportId: reportMatch[2] };
  }

  const dashMatch = url.match(/\/groups\/([^/]+)\/dashboards\/([^/?#]+)/);

  if (dashMatch) {
    return { kind: 'dashboard', groupId: dashMatch[1], dashboardId: dashMatch[2] };
  }

  return null;
}

function buildEmbedInfo(parsed: ParsedPowerBiUrl, accessToken: string): EmbedInfo {
  const base = 'https://app.powerbi.com';
  const kind: EmbedKind = parsed.kind;

  if (parsed.kind === 'report') {
    return {
      kind,
      id: parsed.reportId,
      embedUrl: `${base}/reportEmbed?reportId=${parsed.reportId}&groupId=${parsed.groupId}`,
      accessToken,
    };
  }

  if (parsed.kind === 'dashboard') {
    return {
      kind,
      id: parsed.dashboardId,
      embedUrl: `${base}/dashboardEmbed?dashboardId=${parsed.dashboardId}&groupId=${parsed.groupId}`,
      accessToken,
    };
  }

  return {
    kind,
    id: parsed.tileId,
    dashboardId: parsed.dashboardId,
    embedUrl: `${base}/embed?dashboardId=${parsed.dashboardId}&tileId=${parsed.tileId}&groupId=${parsed.groupId}`,
    accessToken,
  };
}

async function fetchAccessToken(elementId: string): Promise<string> {
  const res = await apiGet<TokenResponse>(
    `/data/service/intermediate-page/token?per_user=Y&element_id=${encodeURIComponent(elementId)}`,
  );

  if (!res.access_token) {
    throw new Error(`Element ${elementId}: access token missing from intermediate-page/token response.`);
  }

  return res.access_token;
}

export const MI = {
  async listReportsInFolder(folderId: string): Promise<Report[]> {
    const data = await apiGet<FolderElementResponse>(
      `/api/folder_element?folder_id=${encodeURIComponent(folderId)}`,
    );

    // Folders can contain Metrics, native Reports, External Content, etc.
    // The slideshow only embeds External Reports — everything else is ignored.
    const externalReports = (data.folder_elements ?? []).filter((r) => isExternalReport(r.element_type));

    externalReports.sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0));

    return externalReports.map((r) => ({
      id: String(r.element_id),
      name: r.element_dashboard_name ?? r.element_name ?? `Report ${r.element_id}`,
    }));
  },

  async listReportsInFolders(folderIds: string[]): Promise<Report[]> {
    const lists = await Promise.all(folderIds.map((id) => this.listReportsInFolder(id)));

    return lists.flat();
  },

  /**
   * Collects everything the SDK needs to embed a report: report id, embed URL,
   * and an AAD access token (per-user).
   */
  async getEmbedInfo(elementId: string): Promise<EmbedInfo> {
    const [infoRes, accessToken] = await Promise.all([
      apiGet<ElementInfoResponse>(`/api/element_info?element=${encodeURIComponent(elementId)}`),
      fetchAccessToken(elementId),
    ]);

    const info = Array.isArray(infoRes.info) ? infoRes.info[0] : infoRes.info;

    if (!info?.external_report_url) {
      throw new Error(`Element ${elementId}: external_report_url missing from element_info response.`);
    }

    const parsed = parsePowerBiUrl(info.external_report_url);

    if (!parsed) {
      throw new UnsupportedBiToolError(elementId, info.external_report_url);
    }

    return buildEmbedInfo(parsed, accessToken);
  },

  /**
   * Refresh just the AAD access token. Called from the Power BI SDK's
   * `tokenExpired` event so a long-running slideshow doesn't die after ~1h.
   */
  async getAccessToken(elementId: string): Promise<string> {
    return fetchAccessToken(elementId);
  },
};

/**
 * Raised when element_info returns a URL we can't recognize (e.g. Tableau,
 * Qlik, etc.). Distinct from generic errors so the UI can render a dedicated
 * "unsupported" slide instead of a raw failure message.
 */
export class UnsupportedBiToolError extends Error {
  readonly elementId: string;
  readonly url: string;

  constructor(elementId: string, url: string) {
    super(`Element ${elementId}: "${url}" is not a Power BI report, dashboard, or tile.`);
    this.name = 'UnsupportedBiToolError';
    this.elementId = elementId;
    this.url = url;
  }
}
