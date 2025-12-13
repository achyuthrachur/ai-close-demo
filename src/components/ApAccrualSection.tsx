'use client';

import { useEffect, useMemo, useState } from 'react';
import { accrualPolicy } from '@/data/config';
import { buildAccrualCandidates } from '@/lib/accruals';
import { formatCurrency, formatDate } from '@/lib/format';
import { AccrualCandidate } from '@/types';
import { useCloseProgress } from './CloseProgressProvider';

type MemoResponse = {
  vendorId: string;
  explanation: string;
  memo: string;
  nextSteps?: string[];
};

export const ApAccrualSection = () => {
  const candidates = useMemo(() => buildAccrualCandidates(accrualPolicy.currentPeriod), []);
  const [filterMissing, setFilterMissing] = useState(true);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(candidates[0]?.vendorId ?? '');
  const [loadingVendor, setLoadingVendor] = useState<string | null>(null);
  const [aiMemos, setAiMemos] = useState<Record<string, MemoResponse>>({});
  const { markVendorExplained } = useCloseProgress();

  const visible = filterMissing ? candidates.filter((c) => c.expectedMissing) : candidates;
  const selected = visible.find((c) => c.vendorId === selectedVendorId) ?? visible[0];

  useEffect(() => {
    if (!selected && visible[0]) {
      setSelectedVendorId(visible[0].vendorId);
    }
  }, [visible, selected]);

  const requestMemo = async (candidate: AccrualCandidate) => {
    setLoadingVendor(candidate.vendorId);
    try {
      const res = await fetch('/api/accrual-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
      const json = await res.json();
      setAiMemos((prev) => ({ ...prev, [candidate.vendorId]: json }));
      markVendorExplained(candidate.vendorId);
    } catch (err) {
      console.error(err);
      setAiMemos((prev) => ({
        ...prev,
        [candidate.vendorId]: {
          vendorId: candidate.vendorId,
          explanation: 'AI provider not reachable; deterministic suggestion shown instead.',
          memo: '',
          nextSteps: ['Review vendor PO/contract manually', 'Confirm timing with AP'],
        },
      }));
    } finally {
      setLoadingVendor(null);
    }
  };

  return (
    <section className="glass rounded-2xl p-6 border border-border/80">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <p className="text-sm text-muted uppercase tracking-wide">AP Accrual Co-pilot</p>
          <h2 className="text-2xl font-semibold">Surface missing invoices before month-end</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterMissing}
              onChange={(e) => setFilterMissing(e.target.checked)}
              className="accent-accent-strong"
            />
            Show vendors with expected missing invoices
          </label>
        </div>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="min-w-full text-sm">
          <thead className="text-muted border-b border-border/60">
            <tr>
              <th className="py-3 pr-3 text-left">Vendor</th>
              <th className="py-3 pr-3 text-left">Cadence</th>
              <th className="py-3 pr-3 text-left">History</th>
              <th className="py-3 pr-3 text-left">Suggested accrual</th>
              <th className="py-3 pr-3 text-left">Confidence</th>
              <th className="py-3 pr-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.vendorId}
                className={`border-b border-border/60 hover:bg-white/5 cursor-pointer ${
                  selected?.vendorId === row.vendorId ? 'bg-white/5' : ''
                }`}
                onClick={() => setSelectedVendorId(row.vendorId)}
              >
                <td className="py-3 pr-3">
                  <div className="font-semibold">{row.vendorName}</div>
                  <div className="text-muted text-xs">{row.glAccount}</div>
                </td>
                <td className="py-3 pr-3">{row.cadence}</td>
                <td className="py-3 pr-3">
                  <div>{row.historyCount} invoices</div>
                  <div className="text-muted text-xs">Last: {row.lastInvoiceDate ? formatDate(row.lastInvoiceDate) : 'n/a'}</div>
                </td>
                <td className="py-3 pr-3">
                  {row.expectedMissing ? (
                    <div className="font-semibold">{row.suggestedAccrual ? formatCurrency(row.suggestedAccrual) : '—'}</div>
                  ) : (
                    <span className="text-muted">Not expected</span>
                  )}
                </td>
                <td className="py-3 pr-3">{row.confidence}%</td>
                <td className="py-3 pr-3">
                  {row.expectedMissing ? (
                    <span className="chip bg-amber-500/10 text-amber-100">Missing</span>
                  ) : (
                    <span className="chip bg-emerald-500/10 text-emerald-100">On track</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div className="glass p-4 rounded-xl border border-border/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-accent-strong">Deterministic suggestion</div>
                <h3 className="text-xl font-semibold mt-1">{selected.vendorName}</h3>
              </div>
              <button
                onClick={() => requestMemo(selected)}
                className="bg-accent-strong/80 text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent-strong disabled:opacity-50"
                disabled={loadingVendor === selected.vendorId}
              >
                {loadingVendor === selected.vendorId ? 'Requesting AI…' : 'AI memo'}
              </button>
            </div>
            <div className="mt-3 text-sm text-muted">
              Cadence detected: {selected.cadence}. Average amount (last {selected.recentInvoices.length}):{' '}
              {selected.averageAmount ? formatCurrency(selected.averageAmount) : 'n/a'}. Suggested accrual is based on the
              last {Math.min(selected.recentInvoices.length, 3)} invoices.
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="glass p-3 rounded-lg border border-border/60">
                <div className="text-muted text-xs uppercase">Suggested accrual</div>
                <div className="text-xl font-semibold">
                  {selected.suggestedAccrual ? formatCurrency(selected.suggestedAccrual) : '—'}
                </div>
              </div>
              <div className="glass p-3 rounded-lg border border-border/60">
                <div className="text-muted text-xs uppercase">Confidence</div>
                <div className="text-xl font-semibold">{selected.confidence}%</div>
              </div>
              <div className="glass p-3 rounded-lg border border-border/60">
                <div className="text-muted text-xs uppercase">Debit</div>
                <div>{selected.glAccount}</div>
              </div>
              <div className="glass p-3 rounded-lg border border-border/60">
                <div className="text-muted text-xs uppercase">Credit</div>
                <div>2100 - Accrued Expenses</div>
              </div>
            </div>

            {aiMemos[selected.vendorId] && (
              <div className="mt-4 p-3 rounded-lg border border-border/60 bg-accent-strong/10 text-sm">
                <div className="text-xs uppercase tracking-wide text-accent-strong mb-1">AI explanation</div>
                <p className="text-foreground/90">{aiMemos[selected.vendorId].explanation}</p>
                {aiMemos[selected.vendorId].memo && (
                  <div className="mt-2 text-muted">
                    <span className="font-semibold text-foreground">JE Memo: </span>
                    {aiMemos[selected.vendorId].memo}
                  </div>
                )}
                {!!aiMemos[selected.vendorId].nextSteps?.length && (
                  <div className="mt-2">
                    <div className="text-xs uppercase tracking-wide text-accent-strong">Next steps</div>
                    <ul className="list-disc list-inside text-muted">
                      {aiMemos[selected.vendorId].nextSteps!.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass p-4 rounded-xl border border-border/70">
            <div className="text-xs uppercase tracking-wide text-accent-strong mb-2">Recent invoices</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-muted border-b border-border/60">
                  <tr>
                    <th className="py-2 pr-3 text-left">Date</th>
                    <th className="py-2 pr-3 text-left">Amount</th>
                    <th className="py-2 pr-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.recentInvoices
                    .slice(-10)
                    .reverse()
                    .map((inv) => (
                      <tr key={inv.invoiceId} className="border-b border-border/50">
                        <td className="py-2 pr-3">{formatDate(inv.invoiceDate)}</td>
                        <td className="py-2 pr-3">{formatCurrency(inv.amount)}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`chip ${inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-100' : 'bg-amber-500/10 text-amber-100'
                              }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
