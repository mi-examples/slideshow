import { useEffect, useRef } from 'react';
import * as pbi from 'powerbi-client';
import { models } from 'powerbi-client';
import { MI } from '../../mi';
import type { Report } from '../../types';
import styles from './report-embed.module.scss';

export interface PageRef {
  name: string;
  displayName: string;
}

interface ReportEmbedProps {
  report: Report;
  pageName: string | null;
  onPagesReady: (pages: PageRef[]) => void;
  onError: (err: Error) => void;
}

const powerbi = new pbi.service.Service(
  pbi.factories.hpmFactory,
  pbi.factories.wpmpFactory,
  pbi.factories.routerFactory,
);

export default function ReportEmbed({ report, pageName, onPagesReady, onError }: ReportEmbedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const embeddedRef = useRef<pbi.Embed | null>(null);

  // Keep the latest callbacks in refs so the embed effect doesn't
  // re-run (and re-embed the report) on every parent render.
  const onPagesReadyRef = useRef(onPagesReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPagesReadyRef.current = onPagesReady;
  }, [onPagesReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const info = await MI.getEmbedInfo(report.id);

        if (cancelled) {
          return;
        }

        powerbi.reset(container);

        const commonConfig = {
          accessToken: info.accessToken,
          tokenType: models.TokenType.Aad,
          embedUrl: info.embedUrl,
          id: info.id,
          permissions: models.Permissions.Read,
        };

        let embedded: pbi.Embed;

        if (info.kind === 'report') {
          const config: models.IReportEmbedConfiguration = {
            ...commonConfig,
            type: 'report',
            settings: {
              panes: {
                filters: { visible: false },
                pageNavigation: { visible: false },
              },
              background: models.BackgroundType.Transparent,
            },
          };

          embedded = powerbi.embed(container, config);
        } else if (info.kind === 'dashboard') {
          const config: models.IDashboardEmbedConfiguration = {
            ...commonConfig,
            type: 'dashboard',
          };

          embedded = powerbi.embed(container, config);
        } else {
          const config: models.ITileEmbedConfiguration = {
            ...commonConfig,
            type: 'tile',
            dashboardId: info.dashboardId ?? '',
          };

          embedded = powerbi.embed(container, config);
        }

        embeddedRef.current = embedded;

        embedded.on('loaded', async () => {
          if (cancelled) {
            return;
          }

          // Only reports have pages to cycle. For dashboards and tiles,
          // report a single synthetic slot so the slideshow advances after
          // the configured duration.
          if (info.kind !== 'report') {
            onPagesReadyRef.current([{ name: '', displayName: report.name }]);

            return;
          }

          try {
            const pages = await (embedded as pbi.Report).getPages();

            if (cancelled) {
              return;
            }

            onPagesReadyRef.current(
              pages.map((p) => ({ name: p.name, displayName: p.displayName })),
            );
          } catch (err) {
            onErrorRef.current(err instanceof Error ? err : new Error(String(err)));
          }
        });

        embedded.on('error', (event: pbi.service.ICustomEvent<unknown>) => {
          onErrorRef.current(new Error(String(event?.detail ?? 'Power BI embed error')));
        });
      } catch (err) {
        if (!cancelled) {
          onErrorRef.current(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      cancelled = true;
      powerbi.reset(container);
      embeddedRef.current = null;
    };
  }, [report.id, report.name]);

  useEffect(() => {
    if (!pageName) {
      return;
    }

    const embedded = embeddedRef.current;

    // setPage is report-only; dashboards and tiles don't have pages.
    if (!embedded || !(embedded instanceof pbi.Report)) {
      return;
    }

    embedded.setPage(pageName).catch((err: unknown) => {
      onErrorRef.current(err instanceof Error ? err : new Error(String(err)));
    });
  }, [pageName]);

  return <div ref={containerRef} className={styles.container} />;
}
