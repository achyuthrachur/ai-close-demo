'use client';

import { CloseProgress } from '@/lib/overview';
import { createContext, useContext, useMemo, useState } from 'react';

type CloseProgressContext = {
  progress: CloseProgress;
  markDayReviewed: (date: string) => void;
  markDayExplained: (date: string) => void;
  markVendorExplained: (vendorId: string) => void;
};

const Context = createContext<CloseProgressContext | undefined>(undefined);

export const CloseProgressProvider = ({ children }: { children: React.ReactNode }) => {
  const [reviewedDates, setReviewedDates] = useState<Set<string>>(new Set());
  const [jeExplainedDates, setJeExplainedDates] = useState<Set<string>>(new Set());
  const [accrualExplainedVendors, setAccrualExplainedVendors] = useState<Set<string>>(new Set());

  const value = useMemo<CloseProgressContext>(
    () => ({
      progress: { reviewedDates, jeExplainedDates, accrualExplainedVendors },
      markDayReviewed: (date: string) => setReviewedDates((prev) => new Set(prev).add(date)),
      markDayExplained: (date: string) => setJeExplainedDates((prev) => new Set(prev).add(date)),
      markVendorExplained: (vendorId: string) => setAccrualExplainedVendors((prev) => new Set(prev).add(vendorId)),
    }),
    [reviewedDates, jeExplainedDates, accrualExplainedVendors]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useCloseProgress = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('CloseProgressProvider missing');
  return ctx;
};
