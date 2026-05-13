import { useCallback, useEffect, useRef, useState } from 'react';
import { MI, UnsupportedBiToolError } from '../../mi';
import { getInitialPageDurationSeconds, PAGE_DURATION_OPTIONS } from '../../config';
import type { Report } from '../../types';
import ReportEmbed, { type PageRef } from './report-embed';
import styles from './slideshow.module.scss';

interface SlideshowProps {
  folderIds: string[];
  label: string;
  onChangeFolder: (() => void) | null;
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      /* ignore — fullscreen denied by browser / gesture policy */
    });
  } else {
    document.exitFullscreen();
  }
}

function folderIdsKey(ids: string[]): string {
  return ids.join(',');
}

export default function Slideshow({ folderIds, label, onChangeFolder }: SlideshowProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportIndex, setReportIndex] = useState(0);
  // Per-report state is stamped with the reportId it belongs to; when the
  // active report changes, the derived pages / pageIndex naturally reset.
  const [reportState, setReportState] = useState<{
    reportId: string;
    pages: PageRef[];
    pageIndex: number;
    error: Error | null;
  }>({ reportId: '', pages: [], pageIndex: 0, error: null });
  const [barVisible, setBarVisible] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [pageDurationSeconds, setPageDurationSeconds] = useState<number>(getInitialPageDurationSeconds);

  const hideTimer = useRef<number | null>(null);
  const autoTimer = useRef<number | null>(null);
  const watchdogTimer = useRef<number | null>(null);

  const sourceKey = folderIdsKey(folderIds);
  const loading = loadedKey !== sourceKey;
  const currentReport: Report | undefined = reports[reportIndex];
  const isCurrent = !!currentReport && reportState.reportId === currentReport.id;
  const pages: PageRef[] = isCurrent ? reportState.pages : [];
  const pageIndex = isCurrent ? reportState.pageIndex : 0;
  const embedError = isCurrent ? reportState.error : null;
  const currentPage: PageRef | undefined = pages[pageIndex];
  const pageName = currentPage?.name ?? null;

  useEffect(() => {
    let alive = true;

    MI.listReportsInFolders(folderIds)
      .then((rs) => {
        if (!alive) {
          return;
        }

        setReports(rs);
        setReportIndex(0);
        setReportState({ reportId: '', pages: [], pageIndex: 0, error: null });
        setLoadError(null);
        setLoadedKey(sourceKey);
      })
      .catch((err: unknown) => {
        if (!alive) {
          return;
        }

        setLoadError(err instanceof Error ? err.message : String(err));
        setLoadedKey(sourceKey);
      });

    return () => {
      alive = false;
    };
  }, [folderIds, sourceKey]);

  const setPageIndex = useCallback((i: number) => {
    setReportState((s) => ({ ...s, pageIndex: i }));
  }, []);

  const next = useCallback(() => {
    if (reports.length === 0) {
      return;
    }

    if (pages.length > 0 && pageIndex < pages.length - 1) {
      setPageIndex(pageIndex + 1);

      return;
    }

    setReportIndex((i) => (i + 1) % reports.length);
  }, [reports.length, pages.length, pageIndex, setPageIndex]);

  const prev = useCallback(() => {
    if (reports.length === 0) {
      return;
    }

    if (pages.length > 0 && pageIndex > 0) {
      setPageIndex(pageIndex - 1);

      return;
    }

    setReportIndex((i) => (i - 1 + reports.length) % reports.length);
  }, [reports.length, pages.length, pageIndex, setPageIndex]);

  const armHideTimer = useCallback(() => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }

    hideTimer.current = window.setTimeout(() => setBarVisible(false), 3000);
  }, []);

  const resetHide = useCallback(() => {
    setBarVisible(true);
    armHideTimer();
  }, [armHideTimer]);

  useEffect(() => {
    armHideTimer();

    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, [armHideTimer, reportIndex, pageIndex]);

  // Auto-cycle. Paused while pages are loading (pages.length === 0), and when
  // there's literally nothing to cycle through.
  useEffect(() => {
    if (autoTimer.current) {
      window.clearInterval(autoTimer.current);
    }

    const canCycle = pages.length > 1 || reports.length > 1;

    if (autoPlay && pages.length > 0 && canCycle) {
      autoTimer.current = window.setInterval(next, pageDurationSeconds * 1000);
    }

    return () => {
      if (autoTimer.current) {
        window.clearInterval(autoTimer.current);
      }
    };
  }, [autoPlay, pages.length, reports.length, next, pageDurationSeconds]);

  // Watchdog: if the current slide has an embed error OR pages never arrive,
  // force-advance so an unattended display isn't stuck forever. Only active
  // when autoplay is on and there's more than one report to move to.
  useEffect(() => {
    if (watchdogTimer.current) {
      window.clearTimeout(watchdogTimer.current);
      watchdogTimer.current = null;
    }

    if (!autoPlay || reports.length <= 1) {
      return;
    }

    const stuck = pages.length === 0;
    const errored = embedError !== null;

    if (!stuck && !errored) {
      return;
    }

    // Give the embed up to 3× the per-page duration (min 20s, max 60s) to
    // recover before we force-advance.
    const timeoutMs = Math.min(Math.max(pageDurationSeconds * 3 * 1000, 20_000), 60_000);

    watchdogTimer.current = window.setTimeout(() => {
      next();
    }, timeoutMs);

    return () => {
      if (watchdogTimer.current) {
        window.clearTimeout(watchdogTimer.current);
        watchdogTimer.current = null;
      }
    };
  }, [autoPlay, reports.length, pages.length, embedError, pageDurationSeconds, reportIndex, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();

      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
        resetHide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
        resetHide();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'p' || e.key === 'P') {
        setAutoPlay((p) => !p);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, resetHide]);

  const currentReportId = currentReport?.id;

  const handlePagesReady = useCallback(
    (newPages: PageRef[]) => {
      if (!currentReportId) {
        return;
      }

      setReportState({ reportId: currentReportId, pages: newPages, pageIndex: 0, error: null });
    },
    [currentReportId],
  );

  const handleEmbedError = useCallback(
    (err: Error) => {
      if (!currentReportId) {
        return;
      }

      setReportState((s) => ({
        ...s,
        reportId: currentReportId,
        error: err,
      }));
    },
    [currentReportId],
  );

  if (loading) {
    return <div className={styles.centered}>Loading reports…</div>;
  }

  if (loadError) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>Failed to load folder: {loadError}</div>
        {onChangeFolder && (
          <button type="button" onClick={onChangeFolder} className={styles.emptyButton}>
            Select a different folder
          </button>
        )}
      </div>
    );
  }

  if (reports.length === 0 || !currentReport) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>
          {onChangeFolder ? 'No Power BI reports in this folder.' : 'No Power BI reports configured.'}
        </div>
        {onChangeFolder && (
          <button type="button" onClick={onChangeFolder} className={styles.emptyButton}>
            Select a different folder
          </button>
        )}
      </div>
    );
  }

  const progressPct = pages.length > 0
    ? ((reportIndex + (pageIndex + 1) / pages.length) / reports.length) * 100
    : (reportIndex / reports.length) * 100;

  return (
    <div
      className={styles.stage}
      onMouseMove={(e) => {
        if (e.clientY < 80 || barVisible) {
          resetHide();
        }
      }}
    >
      <div className={styles.progress} style={{ width: `${progressPct}%` }} />

      <div className={`${styles.bar} ${barVisible ? '' : styles.barHidden}`}>
        {onChangeFolder ? (
          <button
            type="button"
            onClick={onChangeFolder}
            className={styles.folderBtn}
            title="Change folder"
          >
            {label}
          </button>
        ) : (
          <div className={styles.folderLabel}>{label}</div>
        )}
        <div className={styles.divider} />
        <div className={styles.title}>
          <span className={styles.reportName}>{currentReport.name}</span>
          {currentPage && (
            <>
              <span className={styles.chevron}>›</span>
              <span className={styles.pageName}>{currentPage.displayName}</span>
            </>
          )}
        </div>
        <div className={styles.counter}>
          {reportIndex + 1} / {reports.length}
          {pages.length > 0 && (
            <>
              {' · '}
              {pageIndex + 1} / {pages.length}
            </>
          )}
        </div>
        <label className={styles.durationLabel} title="Time each page is shown">
          <span className={styles.durationText}>Per page</span>
          <select
            className={styles.durationSelect}
            value={pageDurationSeconds}
            onChange={(e) => setPageDurationSeconds(Number(e.target.value))}
          >
            {PAGE_DURATION_OPTIONS.map((o) => (
              <option key={o.seconds} value={o.seconds}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <IconBtn onClick={prev} title="Previous (←)">‹</IconBtn>
        <IconBtn onClick={next} title="Next (→)">›</IconBtn>
        <IconBtn
          onClick={() => setAutoPlay((p) => !p)}
          title="Auto-play (P)"
          active={autoPlay}
        >
          {autoPlay ? '❚❚' : '▶'}
        </IconBtn>
        <IconBtn onClick={toggleFullscreen} title="Fullscreen (F)">⛶</IconBtn>
      </div>

      <div className={styles.embed}>
        <ReportEmbed
          report={currentReport}
          pageName={pageName}
          onPagesReady={handlePagesReady}
          onError={handleEmbedError}
        />
        {embedError && (
          <div className={styles.errorOverlay}>
            {embedError instanceof UnsupportedBiToolError ? (
              <>
                <div className={styles.errorTitle}>Unsupported report</div>
                <div className={styles.errorBody}>
                  {currentReport.name} isn&apos;t a Power BI report, dashboard, or tile — skipping.
                </div>
              </>
            ) : (
              <>
                <div className={styles.errorTitle}>Embed error</div>
                <div className={styles.errorBody}>{embedError.message}</div>
              </>
            )}
            <button type="button" onClick={next} className={styles.emptyButton}>
              Skip to next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface IconBtnProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}

function IconBtn({ onClick, title, active, children }: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${styles.iconBtn} ${active ? styles.iconBtnActive : ''}`}
    >
      {children}
    </button>
  );
}
