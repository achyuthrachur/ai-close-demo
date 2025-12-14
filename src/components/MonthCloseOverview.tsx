'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { accrualPolicy } from '@/data/config';
import { buildAccrualCandidates } from '@/lib/accruals';
import { computeCloseOverview } from '@/lib/overview';
import { flagEntriesForPeriod, uniquePostingDates } from '@/lib/journal';
import { useCloseProgress } from './CloseProgressProvider';
import { StackedBar } from './StackedBar';

export const MonthCloseOverview = () => {
  const router = useRouter();
  const allDates = useMemo(() => uniquePostingDates(), []);
  const months = useMemo(
    () =>
      Array.from(new Set(allDates.map((d) => d.slice(0, 7))))
        .filter((p) => ['2025-04', '2025-05', '2025-06', '2025-07'].includes(p))
        .sort(),
    [allDates]
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>(accrualPolicy.currentPeriod);
  const periodDates = useMemo(() => allDates.filter((d) => d.startsWith(selectedPeriod)), [allDates, selectedPeriod]);
  const candidates = useMemo(() => buildAccrualCandidates(selectedPeriod), [selectedPeriod]);
  const { progress, getAllDecisions } = useCloseProgress();
  const decisions = getAllDecisions();
  const periodFlags = useMemo(() => flagEntriesForPeriod(selectedPeriod), [selectedPeriod]);
  const overview = useMemo(
    () => computeCloseOverview(periodDates, candidates, progress, periodFlags.flaggedEntries, decisions),
    [periodDates, candidates, progress, periodFlags.flaggedEntries, decisions]
  );
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState(() => buildTrendAcrossMonths(months, progress));
  const monthlyStats = useMemo(
    () =>
      months.map((period) => {
        const flags = flagEntriesForPeriod(period);
        const totalEntries = flags.flaggedEntries.length;
        const flagged = flags.flaggedEntries.filter((f) => f.flags.length).length;
        const highRisk = flags.flaggedEntries.filter((f) => f.risk === 'HIGH').length;
        const decided = flags.flaggedEntries.filter((f) => {
          const status = decisions.get(f.entry.jeId);
          return f.flags.length && (status === 'ESCALATED' || status === 'REMEDIATED');
        }).length;
        const perFlag = flags.flaggedEntries.reduce(
          (acc, f) => {
            f.flags.forEach((flag) => acc[flag]++);
            return acc;
          },
          { DUPLICATE: 0, UNUSUAL_AMOUNT: 0, REVERSAL_ISSUE: 0 }
        );
        return {
          period,
          totalEntries,
          flagged,
          highRisk,
          remediation: flagged ? Math.round((decided / flagged) * 100) : 100,
          readiness: totalEntries ? Math.round(((totalEntries - flagged) / totalEntries) * 100) : 0,
          perFlag,
        };
      }),
    [months, decisions]
  );

  function buildTrendAcrossMonths(periods: string[], state: typeof progress) {
    return periods.map((period) => {
      const dates = allDates.filter((d) => d.startsWith(period));
      const cands = buildAccrualCandidates(period);
      const flags = flagEntriesForPeriod(period);
      const ov = computeCloseOverview(dates, cands, state, flags.flaggedEntries, decisions);
      return { period, readiness: ov.readinessScore, remediation: ov.remediationScore };
    });
  }

  const triggerSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/close-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overview, period: selectedPeriod, monthlyTrend: trend }),
      });
      const json = await res.json();
      setAiSummary(json.summary);
    } catch (err) {
      console.error(err);
      setAiSummary('Unable to reach AI provider. Deterministic readiness metrics are still accurate.');
    } finally {
      setLoading(false);
    }
  };

  const refreshVisuals = () => setTrend(buildTrendAcrossMonths(months, progress));

  const goToJeDay = (date: string) => {
    const url = `/?tab=je&jeMode=DAY&jeDate=${date}#je-review`;
    router.push(url);
    requestAnimationFrame(() => {
      const el = document.getElementById('je-review');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <section className="glass rounded-2xl p-6 border border-border/80">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <p className="text-sm text-muted uppercase tracking-wide">Month-end overview</p>
          <h2 className="text-2xl font-semibold">Close readiness</h2>
          <p className="text-sm text-muted mt-1">
            Pulls JE review and accrual progress into one readiness score, shows month-to-month trends, and lets AI narrate what to do next.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted flex flex-col gap-1">
            Period
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="glass bg-card border border-border/70 rounded-lg px-3 py-2 text-foreground"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={triggerSummary}
            className="bg-accent-strong/80 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent-strong disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Generating…' : 'Generate AI month-end summary'}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <MetricCard
          title="JE review"
          primary={`${overview.je.reviewedDays}/${overview.je.totalDays} days reviewed`}
          secondary={`${overview.je.aiExplainedDays} days with AI narratives`}
        />
        <MetricCard
          title="Readiness (clean JEs)"
          primary={`${overview.readinessScore}%`}
          secondary="Clean/unflagged entries as % of total"
        />
        <MetricCard
          title="Remediation (flagged resolved)"
          primary={`${overview.remediationScore}%`}
          secondary="Flagged entries escalated or remediated"
        />
      </div>

      <div className="glass rounded-xl p-4 border border-border/60 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Monthly trend</div>
            <div className="text-sm text-muted">Readiness and volume trends across recent months.</div>
          </div>
          <button
            onClick={refreshVisuals}
            className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-border/60"
          >
            Refresh visuals
          </button>
        </div>
        {trend.length === 0 ? (
          <p className="text-sm text-muted mt-3">Trend will appear after data is loaded.</p>
        ) : (
          <>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-3 border border-border/60 rounded-lg p-4">
                  <div className="text-sm font-semibold">Readiness by month</div>
                  <div className="flex items-end gap-6 h-72">
                    {trend.map((point, idx) => {
                      const maxReady = 100;
                      const heightPx = Math.max(80, (point.readiness / maxReady) * 240);
                      return (
                        <div key={idx} className="flex-1 flex flex-col justify-end items-center gap-2">
                          <div
                            className="w-12 rounded-t-md bg-accent-strong shadow"
                            style={{ height: `${heightPx}px` }}
                            title={`${point.period}: ${point.readiness}% readiness`}
                          >
                            <div className="text-[11px] text-white font-semibold text-center leading-none pt-2">
                              {point.readiness}%
                            </div>
                          </div>
                          <div className="text-xs text-center text-muted">{point.period}</div>
                        </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-3 border border-border/60 rounded-lg p-4">
                <div className="text-sm font-semibold">Flag mix by month</div>
                <div className="flex items-end gap-6 h-72">
                  {monthlyStats.map((stat, idx) => {
                    const maxTotal = Math.max(
                      ...monthlyStats.map((s) => s.perFlag.DUPLICATE + s.perFlag.UNUSUAL_AMOUNT + s.perFlag.REVERSAL_ISSUE),
                      1
                    );
                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center gap-2">
                        <StackedBar
                          dup={stat.perFlag.DUPLICATE}
                          unusual={stat.perFlag.UNUSUAL_AMOUNT}
                          reversal={stat.perFlag.REVERSAL_ISSUE}
                          maxTotal={maxTotal}
                        />
                        <div className="text-xs text-center text-muted">{stat.period}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 text-xs text-muted mt-2">
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Duplicate</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Unusual amount</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-400 inline-block" /> Reversal issue</div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted mb-1">JE volume vs flagged</div>
                {monthlyStats.length === 0 ? (
                  <p className="text-sm text-muted">No data available.</p>
                ) : (
                  <div className="flex items-end gap-4 h-48 border border-border/60 rounded-lg p-4 overflow-hidden">
                    {(() => {
                      const maxTotal = Math.max(...monthlyStats.map((s) => s.totalEntries), 1);
                      const maxBarHeight = 120;
                      const minBarHeight = 40;
                      return monthlyStats.map((stat) => {
                        const barTotal = Math.min(
                          maxBarHeight,
                          Math.max(minBarHeight, (stat.totalEntries / maxTotal) * maxBarHeight)
                        );
                        const barFlagged = Math.max(8, (stat.flagged / Math.max(1, stat.totalEntries)) * barTotal);
                        return (
                          <div key={stat.period} className="flex-1 flex flex-col items-center justify-end gap-1">
                            <div className="w-10 bg-border/40 rounded relative overflow-hidden" style={{ height: `${barTotal}px` }}>
                              <div
                                className="bg-accent-strong absolute bottom-0 left-0 right-0"
                                style={{ height: `${barFlagged}px` }}
                                title={`${stat.flagged} flagged of ${stat.totalEntries}`}
                              />
                            </div>
                            <div className="text-xs text-muted text-center">
                              {stat.period}
                              <div className="text-[11px]">{stat.totalEntries} / {stat.flagged} flagged</div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted mb-1">High-risk JEs</div>
                {monthlyStats.length === 0 ? (
                  <p className="text-sm text-muted">No data available.</p>
                ) : (
                  <div className="flex items-end gap-3 h-48 border border-border/60 rounded-lg p-3 overflow-hidden">
                    {(() => {
                      const maxHigh = Math.max(...monthlyStats.map((s) => s.highRisk), 1);
                      const maxBarHeight = 120;
                      return monthlyStats.map((stat) => {
                        const heightPx = Math.min(
                          maxBarHeight,
                          Math.max(12, (stat.highRisk / Math.max(1, maxHigh)) * maxBarHeight)
                        );
                        return (
                          <div key={stat.period} className="flex-1 flex flex-col items-center justify-end gap-1">
                            <div
                              className="w-8 rounded-t-md bg-rose-400"
                              style={{ height: `${heightPx}px` }}
                              title={`${stat.highRisk} high-risk of ${stat.totalEntries}`}
                            >
                              <div className="text-[10px] text-white font-semibold text-center leading-none pt-1">
                                {stat.highRisk}
                              </div>
                            </div>
                            <div className="text-xs text-muted text-center mt-1">{stat.period}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted mb-1">Remediation % (flagged resolved)</div>
                {monthlyStats.length === 0 ? (
                  <p className="text-sm text-muted">No data available.</p>
                ) : (
                  <div className="flex items-end gap-3 h-48 border border-border/60 rounded-lg p-3 overflow-hidden">
                    {monthlyStats.map((stat) => {
                      const maxBarHeight = 120;
                      const heightPx = Math.min(maxBarHeight, Math.max(12, (stat.remediation / 100) * maxBarHeight));
                      return (
                        <div key={stat.period} className="flex-1 flex flex-col items-center justify-end gap-1">
                          <div
                          className="w-8 rounded-t-md bg-emerald-400"
                          style={{ height: `${heightPx}px` }}
                          title={`${stat.remediation}% of flagged resolved`}
                        >
                          <div className="text-[10px] text-white font-semibold text-center leading-none pt-1">
                            {stat.remediation}%
                          </div>
                        </div>
                        <div className="text-xs text-muted text-center mt-1">{stat.period}</div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="glass rounded-xl p-4 border border-border/60">
          <div className="text-xs uppercase tracking-wide text-accent-strong mb-2">Open JE days</div>
          {overview.openDays.length === 0 ? (
            <p className="text-sm text-muted">All days in this period have been reviewed.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overview.openDays.map((d) => (
                <button
                  key={d}
                  onClick={() => goToJeDay(d)}
                  className="chip bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="glass rounded-xl p-4 border border-border/60">
          <div className="text-xs uppercase tracking-wide text-accent-strong mb-2">Vendors needing memo</div>
          {overview.openVendors.length === 0 ? (
            <p className="text-sm text-muted">All expected accruals have AI memos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overview.openVendors.map((id) => {
                const vendor = candidates.find((c) => c.vendorId === id);
                return (
                  <span key={id} className="chip bg-amber-100 text-amber-800 border-amber-300">
                    {vendor?.vendorName ?? id}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {aiSummary && (
        <div className="mt-6 p-4 rounded-xl border border-border/70 bg-accent-strong/10 text-sm">
          <div className="text-xs uppercase tracking-wide text-accent-strong mb-1">AI month-end summary</div>
          <p className="text-foreground/90 whitespace-pre-line">{aiSummary}</p>
        </div>
      )}
    </section>
  );
};

const MetricCard = ({ title, primary, secondary }: { title: string; primary: string; secondary: string }) => (
  <div className="glass rounded-xl p-4 border border-border/60">
    <div className="text-xs uppercase tracking-wide text-muted">{title}</div>
    <div className="text-xl font-semibold mt-1">{primary}</div>
    <div className="text-sm text-muted mt-1">{secondary}</div>
  </div>
);
