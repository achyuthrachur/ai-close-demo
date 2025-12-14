import { AccrualCandidate, FlaggedEntry } from '@/types';

export type CloseProgress = {
  reviewedDates: Set<string>;
  jeExplainedDates: Set<string>;
  accrualExplainedVendors: Set<string>;
};

export type CloseOverview = {
  je: {
    totalDays: number;
    reviewedDays: number;
    aiExplainedDays: number;
  };
  accruals: {
    totalVendors: number;
    expectedMissing: number;
    withAiMemo: number;
  };
  readinessScore: number;
  remediationScore: number;
  openDays: string[];
  openVendors: string[];
};

export const computeCloseOverview = (
  periodDates: string[],
  candidates: AccrualCandidate[],
  progress: CloseProgress,
  flaggedEntries: FlaggedEntry[],
  decisions: Map<string, string>
): CloseOverview => {
  const totalDays = periodDates.length;
  const resolvedStatuses = new Set(['ESCALATED', 'IGNORED', 'REMEDIATED']);
  const unresolvedAny = flaggedEntries.filter(
    (f) => f.flags.length && !resolvedStatuses.has(decisions.get(f.entry.jeId) ?? 'PENDING')
  );
  const reviewedDays =
    unresolvedAny.length === 0
      ? totalDays
      : periodDates.filter((d) => {
          if (progress.reviewedDates.has(d)) return true;
          const entries = flaggedEntries.filter((f) => f.entry.postingDate === d);
          if (!entries.length) return false;
          const unresolved = entries.filter(
            (f) => f.flags.length && !resolvedStatuses.has(decisions.get(f.entry.jeId) ?? 'PENDING')
          );
          return unresolved.length === 0;
        }).length;
  const aiExplainedDays = periodDates.filter((d) => progress.jeExplainedDates.has(d)).length;

  const expectedMissing = candidates.filter((c) => c.expectedMissing).map((c) => c.vendorId);
  const withAiMemo = expectedMissing.filter((id) => progress.accrualExplainedVendors.has(id)).length;

  const totalEntries = flaggedEntries.length;
  const flaggedCount = flaggedEntries.filter((f) => f.flags.length).length;
  const cleanCount = totalEntries - flaggedCount;
  const decidedCount = flaggedEntries.filter((f) => {
    const status = decisions.get(f.entry.jeId);
    return f.flags.length && (status === 'ESCALATED' || status === 'REMEDIATED');
  }).length;

  const readinessScore = totalEntries ? Math.round((cleanCount / totalEntries) * 100) : 0;
  const remediationScore = flaggedCount ? Math.round((decidedCount / flaggedCount) * 100) : 100;
  const openDays = Array.from(new Set(flaggedEntries.map((f) => f.entry.postingDate)))
    .filter((d) => periodDates.includes(d))
    .filter((d) => {
      const flaggedOnDay = flaggedEntries.filter((f) => f.entry.postingDate === d && f.flags.length);
      return flaggedOnDay.some((f) => !resolvedStatuses.has(decisions.get(f.entry.jeId) ?? 'PENDING'));
    })
    .sort();
  const openVendors = expectedMissing.filter((id) => !progress.accrualExplainedVendors.has(id));

  return {
    je: { totalDays, reviewedDays, aiExplainedDays },
    accruals: {
      totalVendors: candidates.length,
      expectedMissing: expectedMissing.length,
      withAiMemo,
    },
    readinessScore,
    remediationScore,
    openDays,
    openVendors,
  };
};
