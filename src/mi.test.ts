import { describe, expect, it } from 'vitest';
import { parsePowerBiUrl } from './mi';

const BASE = 'https://app.powerbi.com';
const G1 = 'c5e9d464-329d-4bd8-846f-6c21e484cafc';
const R1 = '54ef4905-c8da-4808-a9c6-4145c612fe3b';
const G2 = '4be8da4e-ae82-4bb5-ae7d-594c2b001566';
const D2 = '33ba36f2-f1d3-4a66-aa90-47a9e50a8e49';
const T2 = 'e0e6a375-4e1a-419d-9ada-43ce4bdfca45';

describe('parsePowerBiUrl', () => {
  describe('reports', () => {
    it('parses a report URL without a page section', () => {
      expect(parsePowerBiUrl(`${BASE}/groups/${G1}/reports/${R1}`)).toEqual({
        kind: 'report',
        groupId: G1,
        reportId: R1,
      });
    });

    it('parses a report URL with a trailing page/section', () => {
      expect(
        parsePowerBiUrl('https://app.powerbi.com/groups/workspace1/reports/report1/ReportSection3'),
      ).toEqual({
        kind: 'report',
        groupId: 'workspace1',
        reportId: 'report1',
      });
    });

    it('ignores query strings and fragments', () => {
      expect(
        parsePowerBiUrl('https://app.powerbi.com/groups/w1/reports/r1?navContentPaneEnabled=false#z=1'),
      ).toEqual({ kind: 'report', groupId: 'w1', reportId: 'r1' });
    });
  });

  describe('dashboards', () => {
    it('parses a dashboard URL', () => {
      expect(parsePowerBiUrl(`${BASE}/groups/${G2}/dashboards/${D2}`)).toEqual({
        kind: 'dashboard',
        groupId: G2,
        dashboardId: D2,
      });
    });

    it('parses a dashboard URL with trailing path segments', () => {
      expect(
        parsePowerBiUrl('https://app.powerbi.com/groups/w1/dashboards/d1/details'),
      ).toEqual({ kind: 'dashboard', groupId: 'w1', dashboardId: 'd1' });
    });
  });

  describe('tiles', () => {
    it('parses a tile in focus mode', () => {
      expect(
        parsePowerBiUrl(`${BASE}/groups/${G2}/dashboards/${D2}/tiles/${T2}/infocus`),
      ).toEqual({
        kind: 'tile',
        groupId: G2,
        dashboardId: D2,
        tileId: T2,
      });
    });

    it('prefers the tile match over the dashboard match', () => {
      // The dashboard regex also matches this URL; the tile check must run first.
      const result = parsePowerBiUrl(
        'https://app.powerbi.com/groups/w/dashboards/d/tiles/t',
      );

      expect(result?.kind).toBe('tile');
    });
  });

  describe('unsupported / unparseable', () => {
    it('returns null for Tableau URLs', () => {
      expect(
        parsePowerBiUrl('https://tableau.example.com/#/site/prod/views/Sales/Overview'),
      ).toBeNull();
    });

    it('returns null for Qlik URLs', () => {
      expect(
        parsePowerBiUrl('https://example.qliksense.com/sense/app/abc/sheet/xyz'),
      ).toBeNull();
    });

    it('returns null for empty strings', () => {
      expect(parsePowerBiUrl('')).toBeNull();
    });

    it('returns null for Power BI Apps URLs (not yet supported)', () => {
      expect(
        parsePowerBiUrl('https://app.powerbi.com/apps/app1/reports/r1'),
      ).toBeNull();
    });
  });
});
