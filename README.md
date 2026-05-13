# Slideshow

A Metric Insights Custom App that cycles through Power BI content as a full-screen slideshow — ideal for wall displays, TVs in office spaces, and always-on dashboards.

## What it does

- Reads one or more **Folders** from Metric Insights and walks every **External Report** inside them, in the folder's configured order.
- For each External Report:
  - **Power BI Reports** — embeds the report and cycles through every page/tab sequentially using `report.setPage()` (no iframe reload between pages).
  - **Power BI Dashboards and Tiles** — embeds the dashboard or focused tile as a single slide.
- Advances after a configurable interval and loops back to the beginning after the last slide.
- Non–External-Report elements in the folder (Metrics, native Reports, External Content, etc.) are ignored.

Keyboard: `←` / `→` / space to navigate, `p` to pause/resume auto-play, `f` to toggle fullscreen.

## How it works

A React-based MI Custom App built on `pp-dev`. It embeds Power BI via Microsoft's `powerbi-client` SDK, getting everything it needs from same-origin Metric Insights APIs:

| MI endpoint | Purpose |
| --- | --- |
| `GET /api/folder_element?folder_id=<id>` | List External Reports in a folder, sorted by `display_order`. |
| `GET /api/element_info?element=<id>` | Returns the element's `external_report_url`, which is parsed for `groupId` / `reportId` / `dashboardId` / `tileId`. |
| `GET /data/service/intermediate-page/token?per_user=Y&element_id=<id>` | Returns the AAD access token used by the Power BI SDK (`tokenType: Aad`). |

> **Internal endpoint note.** `intermediate-page/token` is an internal MI endpoint — it's what MI's own `ExternalReportViewer` uses server-side, but it isn't covered by the public REST API stability guarantees. We use it because there's no public equivalent today for obtaining an embed-ready AAD token. Treat it as subject to change across MI major versions.

Every 45 minutes the app re-calls this endpoint and hands the fresh token to `embedded.setAccessToken()`. AAD tokens are ~60 min, so 45 minutes leaves comfortable headroom. This is what keeps a 24/7 wall display from going stale after ~1 hour.

Relevant MI documentation:

- [Folder API](https://help.metricinsights.com/m/API_Access/l/1735182-folder-api)
- [Element API v7.0.1](https://help.metricinsights.com/m/API_Access/l/1965779-element-api-v701)
- [Embedding content on an external webpage](https://help.metricinsights.com/m/Embedding/l/102048-embedding-content-on-an-external-webpage)

Example Folder: https://beta7.metricinsights.com/home#/tile/folder/316
Deployed App: https://beta7.metricinsights.com/p/slideshow

## Requirements

This app is intended to be **deployed as a Portal Page inside Metric Insights**. It relies on same-origin session-cookie auth and will not function as a standalone website.

You need:

1. A Metric Insights instance with working Power BI plugin connection(s).
2. One or more **Folders** containing the **Power BI External Reports** you want to display, in the desired order.
3. App Template Variables configured on the portal page (see below).

### Kiosk deployments (TV / wall display)

Because every API call relies on the viewer's MI session cookie, **a kiosk browser must stay logged in** for the slideshow to keep working. When the MI session expires (tenant-configured; typically 8–24h) all three backing endpoints start returning 401 and the slideshow will surface embed errors. Options:

- Run the kiosk under a dedicated service account with a long session lifetime.
- Use MI's SSO / session-persistence settings to extend the session.
- Put the kiosk behind a reverse proxy that handles re-auth silently.

### Embed resilience

- **Token refresh:** handled automatically via the Power BI SDK's `tokenExpired` event.
- **Failure recovery:** if a slide fails to embed or hangs, an internal watchdog force-advances to the next slide after `3 × PAGE_DURATION_SECONDS` (bounded 20–60s) so the display doesn't freeze.
- **Unsupported tools:** folders containing non–Power BI External Reports (Tableau, Qlik, etc.) render a brief "Unsupported report" slide and skip forward; they do not stop the slideshow.

## Configuration — App Template Variables

The app is driven by `window.PP_VARIABLES`, which Metric Insights populates at render time from App Template Variables. These are substituted into `index.html`:

| Variable | Type | Default | Purpose |
| --- | --- | --- | --- |
| `FOLDERS` | id, CSV of ids, or array | *(required in production)* | Folders to cycle through. Folders are concatenated in the order given. |
| `PAGE_DURATION_SECONDS` | integer | `30` | Seconds each page/slide is shown. Viewers can still override at runtime via the top-bar dropdown. |
| `PRIMARY_COLOR` | CSS color | `#000000` | Top bar background + picker gradient base. |
| `ACCENT_COLOR` | CSS color | `#075b7e` | Progress bar, highlights, submit button. |

Unsubstituted template literals (e.g. `"[Folders]"` left in place when an App Template Variable is unconfigured) are treated as unset, so defaults apply.

### Example

```html
<script>
  window.PP_VARIABLES = {
    PAGE_DURATION_SECONDS: '[Slide Duration]',
    FOLDERS: '[Folders]',
    PRIMARY_COLOR: '[Primary Color]',
    ACCENT_COLOR: '[Accent Color]'
  };
</script>
```

## Getting Started (Local Development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

When `FOLDERS` is not set (the default in local dev), the app shows a small form where you can enter a folder id to preview. Once `FOLDERS` is populated — either because you're running against a real App deployment or you hardcode it into `index.html` — the picker is skipped and the slideshow runs immediately.

### pp-dev configuration

`pp-dev.config.ts` points the dev server at a real MI instance so API calls (`/api/*`, `/data/*`) are proxied with your session cookie:

```typescript
// pp-dev.config.ts
import { PPDevConfig } from '@metricinsights/pp-dev';

const config: PPDevConfig = {
  backendBaseURL: 'https://example.metricinsights.com',
  appId: 1,
  miHudLess: true,
  v7Features: true,
};

export default config;
```

## Project Layout

```
src/
  app.tsx                          Root — decides picker vs slideshow, injects theme CSS vars
  main.tsx                         Entry
  index.scss                       Global reset + :root theme defaults
  constants.ts                     PP_VARIABLES typings + reader
  config.ts                        Duration parsing, duration dropdown options, FOLDERS parsing
  theme.ts                         Brand color parsing + defaults
  types.ts                         Folder / Report / EmbedInfo / EmbedKind
  mi.ts                            MI API client (folder_element, element_info, intermediate-page/token)
  components/
    folder-picker/                 Dev-only manual folder-id input
    slideshow/
      slideshow.tsx                Cycles reports × pages, top bar, controls
      report-embed.tsx             powerbi-client SDK wrapper (report/dashboard/tile)
```

## Learn More

- [TypeScript](https://www.typescriptlang.org/)
- [React](https://react.dev)
- [PP Dev](https://www.npmjs.com/package/@metricinsights/pp-dev)
- [powerbi-client](https://github.com/microsoft/PowerBI-JavaScript)
- [Metric Insights Docs](https://help.metricinsights.com/)
