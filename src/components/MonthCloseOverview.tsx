'use client';

import { useMemo, useState } from 'react';
import { accrualPolicy } from '@/data/config';
import { buildAccrualCandidates } from '@/lib/accruals';
import { computeCloseOverview } from '@/lib/overview';
import { uniquePostingDates } from '@/lib/journal';
import { useCloseProgress } from './CloseProgressProvider';

export const MonthCloseOverview = () => {
  const periodDates = useMemo(
    () => uniquePostingDates().filter((d) => d.startsWith(accrualPolicy.currentPeriod)),
    []
  );
  const candidates = useMemo(() => buildAccrualCandidates(accrualPolicy.currentPeriod), []);
  const { progress } = useCloseProgress();
  const overview = useMemo(() => computeCloseOverview(periodDates, candidates, progress), [periodDates, candidates, progress]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trend, setTrend] = useState(() => buildTrend(overview.readinessScore));

  function buildTrend(score: number) {
    const points = Array.from({ length: 8 }).map((_, idx) => {
      const noise = score + (Math.random() * 14 - 7) + idx * 1.5;
      const clamped = Math.max(5, Math.min(100, noise));
      return Math.round(clamped);
    });
    return points;
  }

  const triggerSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/close-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overview, period: accrualPolicy.currentPeriod }),
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

  const refreshVisuals = () => setTrend(buildTrend(overview.readinessScore));

  return (
    <section className="glass rounded-2xl p-6 border border-border/80">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <p className="text-sm text-muted uppercase tracking-wide">Month-end overview</p>
          <h2 className="text-2xl font-semibold">Close readiness for {accrualPolicy.currentPeriod}</h2>
        </div>
        <button
          onClick={triggerSummary}
          className="bg-accent-strong/80 text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent-strong disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Generate AI month-end summary'}
        </button>
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
            <div className="text-xs uppercase tracking-wide text-muted">Live visuals (demo)</div>
            <div className="text-sm text-muted">Refresh to simulate dynamic updates as reviews progress.</div>
          </div>
          <button
            onClick={refreshVisuals}
            className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-border/60"
          >
            Refresh visuals
          </button>
        </div>
        <div className="mt-4 flex items-end gap-2 h-32">
          {trend.map((val, idx) => (
            <div key={idx} className="flex-1">
              <div
                className="w-full rounded-t-md bg-accent-strong"
                style={{ height: `${val}%` }}
                title={`${val}% readiness`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted mt-1">
          {trend.map((_, idx) => (
            <span key={idx}>T{idx + 1}</span>
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
