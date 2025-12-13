import { AccrualCandidate } from '@/types';

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
  openDays: string[];
  openVendors: string[];
};

export const computeCloseOverview = (
  periodDates: string[],
  candidates: AccrualCandidate[],
  progress: CloseProgress
): CloseOverview => {
  const totalDays = periodDates.length;
  const reviewedDays = periodDates.filter((d) => progress.reviewedDates.has(d)).length;
  const aiExplainedDays = periodDates.filter((d) => progress.jeExplainedDates.has(d)).length;

  const expectedMissing = candidates.filter((c) => c.expectedMissing).map((c) => c.vendorId);
  const withAiMemo = expectedMissing.filter((id) => progress.accrualExplainedVendors.has(id)).length;

  const jeCompletion = totalDays ? reviewedDays / totalDays : 0;
  const accrualCompletion = expectedMissing.length ? withAiMemo / expectedMissing.length : 1;
  const readinessScore = Math.round(((jeCompletion * 0.55 + accrualCompletion * 0.45) * 100));

  const openDays = periodDates.filter((d) => !progress.reviewedDates.has(d));
  const openVendors = expectedMissing.filter((id) => !progress.accrualExplainedVendors.has(id));

  return {
    je: { totalDays, reviewedDays, aiExplainedDays },
    accruals: {
      totalVendors: candidates.length,
      expectedMissing: expectedMissing.length,
      withAiMemo,
    },
    readinessScore,
    openDays,
    openVendors,
  };
};
