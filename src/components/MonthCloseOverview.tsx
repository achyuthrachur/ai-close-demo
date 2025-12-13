'use client';

import { useMemo, useState } from 'react';
import { accrualPolicy } from '@/data/config';
import { buildAccrualCandidates } from '@/lib/accruals';
import { computeCloseOverview } from '@/lib/overview';
import { uniquePostingDates } from '@/lib/journal';
import { useCloseProgress } from './CloseProgressProvider';

export const MonthCloseOverview = () => {
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
  const { progress } = useCloseProgress();
  const overview = useMemo(() => computeCloseOverview(periodDates, candidates, progress), [periodDates, candidates, progress]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState(() => buildTrendAcrossMonths(months, progress));

  function buildTrendAcrossMonths(periods: string[], state: typeof progress) {
    return periods.map((period) => {
      const dates = allDates.filter((d) => d.startsWith(period));
      const cands = buildAccrualCandidates(period);
      const ov = computeCloseOverview(dates, cands, state);
      return { period, score: ov.readinessScore };
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
          title="AP accruals"
          primary={`${overview.accruals.withAiMemo}/${overview.accruals.expectedMissing} accruals memoed`}
          secondary={`${overview.accruals.totalVendors} vendors analyzed`}
        />
        <div className="glass rounded-xl p-4 border border-border/60 flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-muted">Readiness score</div>
          <div className="text-3xl font-semibold">{overview.readinessScore}%</div>
          <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
            <div
              className="h-2 bg-accent-strong rounded-full"
              style={{ width: `${overview.readinessScore}%` }}
            />
          </div>
          <div className="text-xs text-muted">
            Weighted blend of JE review (55%) and accrual handling (45%). Deterministic and reproducible.
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-4 border border-border/60 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Monthly trend</div>
            <div className="text-sm text-muted">Readiness trend across recent months.</div>
          </div>
          <button
            onClick={refreshVisuals}
            className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-border/60"
          >
            Refresh visuals
          </button>
        </div>
        <div className="mt-4 flex items-end gap-3 h-36">
          {trend.map((point, idx) => (
            <div key={idx} className="flex-1">
              <div
                className="w-full rounded-t-md bg-accent-strong"
                style={{ height: `${point.score}%` }}
                title={`${point.period}: ${point.score}% readiness`}
              />
              <div className="text-xs text-center text-muted mt-1">{point.period}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="glass rounded-xl p-4 border border-border/60">
          <div className="text-xs uppercase tracking-wide text-accent-strong mb-2">Open JE days</div>
          {overview.openDays.length === 0 ? (
            <p className="text-sm text-muted">All days in this period have been reviewed.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overview.openDays.map((d) => (
                <span key={d} className="chip bg-amber-100 text-amber-800 border-amber-300">
                  {d}
                </span>
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
