'use client';

import { useEffect, useMemo, useState } from 'react';
import { journalEntries } from '@/data/journalEntries';
import { formatCurrency, formatDate } from '@/lib/format';
import { flagEntriesForDate, flagEntriesForPeriod, flagEntriesForRange, uniquePostingDates } from '@/lib/journal';
import { JEFlag } from '@/types';
import { useCloseProgress } from './CloseProgressProvider';

type AiExplanation = {
  jeId: string;
  text: string;
  summary: string;
};

type AiResponse = {
  explanations: AiExplanation[];
  dailyNarrative?: string;
};

const riskColor = (risk: string) => {
  if (risk === 'HIGH') return 'text-rose-800 bg-rose-100 border-rose-300';
  if (risk === 'MEDIUM') return 'text-amber-800 bg-amber-100 border-amber-300';
  return 'text-emerald-800 bg-emerald-100 border-emerald-300';
};

export const DailyReviewSection = () => {
  const dates = useMemo(() => uniquePostingDates(), []);
  const months = useMemo(() => Array.from(new Set(journalEntries.map((je) => je.period))).sort(), []);
  const weeks = useMemo(() => {
    const weekStarts = new Set<string>();
    dates.forEach((d) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // monday
      const start = new Date(date);
      start.setDate(diff);
      weekStarts.add(start.toISOString().split('T')[0]);
    });
    return Array.from(weekStarts).sort();
  }, [dates]);

  const latestDate = dates[dates.length - 1] ?? '';
  const [selected, setSelected] = useState<string>(latestDate);
  const [mode, setMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [filter, setFilter] = useState<'ALL' | 'FLAGGED' | 'HIGH'>('FLAGGED');
  const [page, setPage] = useState(0);
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const { markDayReviewed, markDayExplained } = useCloseProgress();

  const computeFlags = () => {
    if (mode === 'DAY') return flagEntriesForDate(selected);
    if (mode === 'WEEK') {
      const start = selected;
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return flagEntriesForRange(start, end.toISOString().split('T')[0]);
    }
    return flagEntriesForPeriod(selected);
  };

  const { flaggedEntries, summary } = useMemo(computeFlags, [selected, mode]);

  useEffect(() => {
    const opts = mode === 'DAY' ? dates : mode === 'WEEK' ? weeks : months;
    if (!opts.includes(selected) && opts.length) {
      setSelected(opts[opts.length - 1]);
    }
  }, [mode, dates, weeks, months, selected]);

  useEffect(() => {
    if (mode === 'DAY' && selected) markDayReviewed(selected);
    setPage(0);
    setAiResponse(null);
  }, [selected, mode, markDayReviewed]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return flaggedEntries;
    if (filter === 'FLAGGED') return flaggedEntries.filter((f) => f.flags.length);
    return flaggedEntries.filter((f) => f.risk === 'HIGH');
  }, [filter, flaggedEntries]);

  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const triggerAi = async () => {
    const payload = {
      scope: mode,
      selection: selected,
      flagged: flaggedEntries.filter((f) => f.flags.length),
      summary,
    };
    setLoadingAi(true);
    try {
      const res = await fetch('/api/je-explanations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setAiResponse(json);
      if (mode === 'DAY') markDayExplained(selected);
    } catch (err) {
      setAiResponse({
        explanations: [],
        dailyNarrative: 'Unable to reach AI provider. Showing deterministic data only.',
      });
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  const chipForFlag = (flag: JEFlag) => {
    const map: Record<JEFlag, string> = {
      DUPLICATE: 'Duplicate',
      UNUSUAL_AMOUNT: 'Unusual amount',
      REVERSAL_ISSUE: 'Reversal issue',
    };
    return map[flag];
  };

  if (!selected) {
    return (
      <section className="glass rounded-2xl p-6 border border-border/80">
        <p className="text-muted">No journal entry data available.</p>
      </section>
    );
  }

  const optionsForMode = mode === 'DAY' ? dates : mode === 'WEEK' ? weeks : months;

  return (
    <section className="glass rounded-2xl p-6 border border-border/80">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <p className="text-sm text-muted uppercase tracking-wide">JE Review</p>
          <h2 className="text-2xl font-semibold">Spot anomalies before approvals</h2>
          <p className="text-sm text-muted mt-1">
            Deterministic flags surface duplicates, unusual amounts, and reversal issues; AI narrates the why and suggests next actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-muted flex flex-col gap-1">
            View
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'DAY' | 'WEEK' | 'MONTH')}
              className="glass bg-card border border-border/70 rounded-lg px-3 py-2 text-foreground"
            >
              <option value="DAY">Daily</option>
              <option value="WEEK">Weekly</option>
              <option value="MONTH">Monthly</option>
            </select>
          </label>
          <label className="text-sm text-muted flex flex-col gap-1">
            {mode === 'DAY' ? 'Date' : mode === 'WEEK' ? 'Week of' : 'Month'}
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="glass bg-card border border-border/70 rounded-lg px-3 py-2 text-foreground"
            >
              {optionsForMode.map((d) => (
                <option key={d} value={d}>
                  {mode === 'MONTH' ? d : formatDate(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted flex flex-col gap-1">
            Filter
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'ALL' | 'FLAGGED' | 'HIGH')}
              className="glass bg-card border border-border/70 rounded-lg px-3 py-2 text-foreground"
            >
              <option value="ALL">Show all</option>
              <option value="FLAGGED">Only flagged</option>
              <option value="HIGH">Only high risk</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3 mt-6">
        <SummaryTile label="Entries" value={summary.totalEntries} />
        <SummaryTile
          label="Flagged %"
          value={`${summary.flaggedPercentage.toFixed(0)}%`}
          caption={`${summary.flaggedCounts.DUPLICATE + summary.flaggedCounts.UNUSUAL_AMOUNT + summary.flaggedCounts.REVERSAL_ISSUE
            } flagged`}
        />
        <SummaryTile label="High-risk" value={summary.highRiskCount} caption="Includes unusual amounts & reversals" />
        <SummaryTile
          label="Duplicates"
          value={summary.flaggedCounts.DUPLICATE}
          caption={`${summary.flaggedCounts.UNUSUAL_AMOUNT} unusual | ${summary.flaggedCounts.REVERSAL_ISSUE} reversal`}
        />
      </div>

      <div className="flex flex-wrap gap-3 items-center mt-6">
        <button
          onClick={triggerAi}
          disabled={loadingAi || !flaggedEntries.some((f) => f.flags.length)}
          className="rounded-lg bg-accent-strong/80 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong transition disabled:opacity-60"
        >
          {loadingAi ? 'Requesting AI...' : 'Explain flags with AI'}
        </button>
        <span className="text-sm text-muted">
          Deterministic flags drive the numbers. AI summarizes and proposes next steps.
        </span>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="min-w-full text-sm">
          <thead className="text-muted border-b border-border/60">
            <tr>
              <th className="py-3 pr-3 text-left">Account</th>
              <th className="py-3 pr-3 text-left">Desc</th>
              <th className="py-3 pr-3 text-left">Debit</th>
              <th className="py-3 pr-3 text-left">Credit</th>
              <th className="py-3 pr-3 text-left">Preparer</th>
              <th className="py-3 pr-3 text-left">Flags</th>
            </tr>
          </thead>
          <tbody>
            {currentPage.map((row) => (
              <tr key={row.entry.jeId} className="border-b border-border/60 hover:bg-border/20">
                <td className="py-3 pr-3">
                  <div className="font-medium">{row.entry.account}</div>
                  <div className="text-muted text-xs flex gap-2">
                    <span>{row.entry.costCenter}</span>
                    <span>·</span>
                    <span>{formatDate(row.entry.postingDate)}</span>
                  </div>
                </td>
                <td className="py-3 pr-3 max-w-xs">
                  <div className="text-foreground/90">{row.entry.description}</div>
                  <div className="text-muted text-xs">{row.entry.sourceSystem}</div>
                </td>
                <td className="py-3 pr-3">{row.entry.debit ? formatCurrency(row.entry.debit) : '—'}</td>
                <td className="py-3 pr-3">{row.entry.credit ? formatCurrency(row.entry.credit) : '—'}</td>
                <td className="py-3 pr-3">
                  <div>{row.entry.preparer}</div>
                  <div className="text-muted text-xs">{row.entry.approver}</div>
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-2">
                    {row.flags.length === 0 && <span className="chip text-muted">Clean</span>}
                    {row.flags.map((flag) => (
                      <span key={flag} className={`chip ${riskColor(row.risk)}`}>
                        {chipForFlag(flag)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageCount > 1 && (
          <div className="flex items-center gap-2 justify-end mt-2 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-border/70 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {page + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
              disabled={page === pageCount - 1}
              className="px-3 py-1 rounded border border-border/70 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {aiResponse?.dailyNarrative && (
        <div className="mt-6 p-4 rounded-xl border border-border/70 bg-accent-strong/10">
          <div className="text-sm uppercase tracking-wide text-accent-strong mb-1">AI Narrative</div>
          <p className="text-sm text-foreground/90 whitespace-pre-line">{aiResponse.dailyNarrative}</p>
        </div>
      )}

      {!!aiResponse?.explanations.length && (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {aiResponse.explanations.map((exp) => (
            <div key={exp.jeId} className="glass p-4 rounded-xl border border-border/70">
              <div className="text-xs uppercase tracking-wide text-accent-strong mb-1">{exp.jeId}</div>
              <div className="font-semibold">{exp.summary}</div>
              <p className="text-sm text-muted mt-2 whitespace-pre-line">{exp.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const SummaryTile = ({ label, value, caption }: { label: string; value: string | number; caption?: string }) => (
  <div className="glass rounded-xl p-4 border border-border/60">
    <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
    <div className="text-2xl font-semibold">{value}</div>
    {caption && <div className="text-xs text-muted mt-1">{caption}</div>}
  </div>
);
