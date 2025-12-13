'use client';

import { CloseProgress } from '@/lib/overview';
import { createContext, useContext, useMemo, useState } from 'react';

type StoredAiResponse = {
  narrative?: string;
  explanations: { jeId: string; summary: string; text: string }[];
};

export type JeDecision = 'PENDING' | 'IGNORED' | 'ESCALATED';

type CloseProgressContext = {
  progress: CloseProgress;
  markDayReviewed: (date: string) => void;
  markDayExplained: (date: string) => void;
  markVendorExplained: (vendorId: string) => void;
  getJeAiResponse: (key: string) => StoredAiResponse | undefined;
  setJeAiResponse: (key: string, value: StoredAiResponse) => void;
  getDecision: (jeId: string) => JeDecision;
  setDecision: (jeId: string, decision: JeDecision) => void;
};

const Context = createContext<CloseProgressContext | undefined>(undefined);

export const CloseProgressProvider = ({ children }: { children: React.ReactNode }) => {
  const [reviewedDates, setReviewedDates] = useState<Set<string>>(new Set());
  const [jeExplainedDates, setJeExplainedDates] = useState<Set<string>>(new Set());
  const [accrualExplainedVendors, setAccrualExplainedVendors] = useState<Set<string>>(new Set());
  const [jeAiCache, setJeAiCache] = useState<Map<string, StoredAiResponse>>(new Map());
  const [jeDecisions, setJeDecisions] = useState<Map<string, JeDecision>>(new Map());

  const value = useMemo<CloseProgressContext>(
    () => ({
      progress: { reviewedDates, jeExplainedDates, accrualExplainedVendors },
      markDayReviewed: (date: string) => setReviewedDates((prev) => new Set(prev).add(date)),
      markDayExplained: (date: string) => setJeExplainedDates((prev) => new Set(prev).add(date)),
      markVendorExplained: (vendorId: string) => setAccrualExplainedVendors((prev) => new Set(prev).add(vendorId)),
      getJeAiResponse: (key: string) => jeAiCache.get(key),
      setJeAiResponse: (key: string, value: StoredAiResponse) =>
        setJeAiCache((prev) => {
          const next = new Map(prev);
          next.set(key, value);
          return next;
        }),
      getDecision: (jeId: string) => jeDecisions.get(jeId) ?? 'PENDING',
      setDecision: (jeId: string, decision: JeDecision) =>
        setJeDecisions((prev) => {
          const next = new Map(prev);
          next.set(jeId, decision);
          return next;
        }),
    }),
    [reviewedDates, jeExplainedDates, accrualExplainedVendors, jeAiCache, jeDecisions]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useCloseProgress = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('CloseProgressProvider missing');
  return ctx;
};
