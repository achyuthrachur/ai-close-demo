import { accrualPolicy } from '@/data/config';
import { apInvoices, vendorProfiles } from '@/data/apInvoices';
import { average, clamp, stdDev } from './math';
import { AccrualCandidate, CadenceLabel, VendorInvoice } from '@/types';

const periodCompare = (a: string, b: string) => {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  if (ay === by) return am - bm;
  return ay - by;
};

const gapsInDays = (dates: string[]) => {
  const sorted = dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const days = (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
    gaps.push(days);
  }
  return gaps;
};

const cadenceLabel = (vendorInvoices: VendorInvoice[]): CadenceLabel => {
  if (vendorInvoices.length < accrualPolicy.minimumInvoicesForCadence) return 'Unknown';
  const gaps = gapsInDays(vendorInvoices.map((i) => i.invoiceDate));
  const avgGap = average(gaps);
  if (avgGap === 0) return 'Unknown';
  if (Math.abs(avgGap - 30) <= accrualPolicy.monthlyGapToleranceDays) return 'Monthly';
  if (Math.abs(avgGap - 90) <= accrualPolicy.quarterlyGapToleranceDays) return 'Quarterly';
  return 'Irregular';
};

const confidenceScore = (invoices: VendorInvoice[]) => {
  if (!invoices.length) return 0;
  const amounts = invoices.map((i) => i.amount);
  const mean = average(amounts);
  const variability = mean ? stdDev(amounts) / mean : 1;
  const historyWeight = Math.min(invoices.length, 10) / 10;
  const score = (1 - variability) * 60 + historyWeight * 40;
  return Math.round(clamp(score, 15, 95));
};

const suggestedAccrual = (invoices: VendorInvoice[]) => {
  if (!invoices.length) return undefined;
  const recent = invoices.slice(-accrualPolicy.averageLastNInvoices);
  return Math.round(average(recent.map((i) => i.amount)));
};

export const buildAccrualCandidates = (period: string): AccrualCandidate[] => {
  const grouped = vendorProfiles.map((vendor) => {
    const history = apInvoices.filter((inv) => inv.vendorId === vendor.vendorId).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
    const cadence = cadenceLabel(history);
    const historyCount = history.length;
    const lastInvoice = history[history.length - 1];
    const lastInvoicePeriod = lastInvoice?.period;
    const expectedMissing =
      cadence === 'Monthly' && periodCompare(lastInvoicePeriod ?? '1900-01', period) < 0
        ? true
        : cadence === 'Quarterly' && periodCompare(lastInvoicePeriod ?? '1900-01', period) <= -3;
    const accrual = expectedMissing ? suggestedAccrual(history) : undefined;
    const confidence = expectedMissing ? confidenceScore(history) : confidenceScore(history.slice(-3));

    const candidate: AccrualCandidate = {
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      cadence,
      historyCount,
      lastInvoiceDate: lastInvoice?.invoiceDate,
      averageAmount: Math.round(average(history.map((h) => h.amount))),
      expectedMissing,
      suggestedAccrual: accrual,
      currency: 'USD',
      glAccount: vendor.defaultGLAccount,
      costCenter: vendor.costCenter,
      confidence,
      recentInvoices: history.slice(-12),
    };
    return candidate;
  });

  return grouped.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
};
