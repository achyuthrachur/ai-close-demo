import { jeRules } from '@/data/config';
import { journalEntries } from '@/data/journalEntries';
import { average, stdDev } from './math';
import { FlaggedEntry, JEFlag, JournalEntry, RiskLevel } from '@/types';

export type DailySummary = {
  totalEntries: number;
  flaggedCounts: Record<JEFlag, number>;
  flaggedPercentage: number;
  highRiskCount: number;
};

const netAmount = (entry: JournalEntry) => entry.debit - entry.credit;
const magnitude = (entry: JournalEntry) => Math.abs(netAmount(entry));

const byAccountStats = () => {
  const stats = new Map<
    string,
    {
      mean: number;
      std: number;
      values: number[];
    }
  >();

  const grouped = new Map<string, number[]>();
  journalEntries.forEach((je) => {
    const key = je.account;
    const values = grouped.get(key) ?? [];
    values.push(magnitude(je));
    grouped.set(key, values);
  });

  grouped.forEach((values, account) => {
    stats.set(account, {
      mean: average(values),
      std: stdDev(values),
      values,
    });
  });
  return stats;
};

const accountStatsCache = byAccountStats();

const duplicateMap = (period: string) => {
  const map = new Map<string, JournalEntry[]>();
  journalEntries
    .filter((je) => je.period === period)
    .forEach((je) => {
      const key = `${je.account}|${je.costCenter}|${Math.round(magnitude(je))}`;
      const arr = map.get(key) ?? [];
      arr.push(je);
      map.set(key, arr);
    });
  return map;
};

const findPotentialOriginal = (entry: JournalEntry) => {
  const targetAmount = magnitude(entry);
  return journalEntries.find((candidate) => {
    if (candidate.postingDate >= entry.postingDate) return false;
    const similarAmount = Math.abs(magnitude(candidate) - targetAmount) <= jeRules.duplicateTolerance;
    const oppositeSide = netAmount(candidate) * netAmount(entry) < 0;
    return candidate.account === entry.account && similarAmount && oppositeSide;
  });
};

const determineRisk = (flags: JEFlag[]): RiskLevel => {
  if (!flags.length) return 'LOW';
  if (flags.includes('UNUSUAL_AMOUNT') || flags.includes('REVERSAL_ISSUE')) return 'HIGH';
  if (flags.length > 1) return 'HIGH';
  return 'MEDIUM';
};

export const flagEntriesForDate = (date: string) => {
  const daily = journalEntries.filter((je) => je.postingDate === date);
  const period = daily[0]?.period ?? '';
  const dupes = period ? duplicateMap(period) : new Map<string, JournalEntry[]>();

  const flagged: FlaggedEntry[] = daily.map((entry) => {
    const flags: JEFlag[] = [];
    const context: FlaggedEntry['context'] = {};

    // Duplicate detection
    const dupKey = `${entry.account}|${entry.costCenter}|${Math.round(magnitude(entry))}`;
    const duplicates = dupes.get(dupKey) ?? [];
    if (duplicates.length > 1) {
      flags.push('DUPLICATE');
      context.duplicateCount = duplicates.length;
    }

    // Unusual amounts
    const stats = accountStatsCache.get(entry.account);
    if (stats && stats.values.length >= jeRules.minimumHistoryCount && stats.std > 0) {
      context.accountAverage = stats.mean;
      context.accountStdDev = stats.std;
      const deviation = Math.abs(magnitude(entry) - stats.mean);
      if (deviation > jeRules.unusualStdDevThreshold * stats.std) {
        flags.push('UNUSUAL_AMOUNT');
      }
    }

    // Reversals and backwards postings
    const looksLikeReversal =
      !!entry.reversalOf || /reversal|reverse|true[- ]up|trueup|reclass/i.test(entry.description);
    if (looksLikeReversal) {
      const original =
        journalEntries.find((je) => je.jeId === entry.reversalOf) ?? findPotentialOriginal(entry);
      const hasMatch = Boolean(original);
      const daysSinceOriginal = original
        ? Math.abs(
            (new Date(entry.postingDate).getTime() - new Date(original.postingDate).getTime()) / (1000 * 60 * 60 * 24)
          )
        : undefined;
      context.hasMatchingReversal = hasMatch;
      context.daysSinceOriginal = daysSinceOriginal;

      if (!hasMatch || (daysSinceOriginal ?? 0) > jeRules.lateReversalDays) {
        flags.push('REVERSAL_ISSUE');
      }
    }

    return {
      entry,
      flags,
      risk: determineRisk(flags),
      context,
    };
  });

  const flaggedCounts: Record<JEFlag, number> = {
    DUPLICATE: flagged.filter((f) => f.flags.includes('DUPLICATE')).length,
    UNUSUAL_AMOUNT: flagged.filter((f) => f.flags.includes('UNUSUAL_AMOUNT')).length,
    REVERSAL_ISSUE: flagged.filter((f) => f.flags.includes('REVERSAL_ISSUE')).length,
  };

  const summary: DailySummary = {
    totalEntries: flagged.length,
    flaggedCounts,
    flaggedPercentage: flagged.length
      ? (flagged.filter((f) => f.flags.length > 0).length / flagged.length) * 100
      : 0,
    highRiskCount: flagged.filter((f) => f.risk === 'HIGH').length,
  };

  return { flaggedEntries: flagged, summary };
};

export const uniquePostingDates = () => {
  const dates = Array.from(new Set(journalEntries.map((je) => je.postingDate)));
  return dates.sort();
};
