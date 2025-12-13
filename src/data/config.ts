export const jeRules = {
  duplicateTolerance: 1, // dollars of tolerance
  unusualStdDevThreshold: 3,
  minimumHistoryCount: 6,
  lateReversalDays: 10,
};

export const accrualPolicy = {
  currentPeriod: '2025-07',
  minimumInvoicesForCadence: 4,
  averageLastNInvoices: 3,
  monthlyGapToleranceDays: 7,
  quarterlyGapToleranceDays: 15,
};
