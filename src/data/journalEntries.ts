import { JournalEntry } from '@/types';

type AccountProfile = {
  account: string;
  costCenter: string;
  mean: number;
  volatility: number;
};

const profiles: AccountProfile[] = [
  { account: '5200 - Software Subscriptions', costCenter: 'IT01', mean: 1800, volatility: 0.15 },
  { account: '5600 - Logistics & Freight', costCenter: 'OPS10', mean: 6200, volatility: 0.22 },
  { account: '5400 - Travel & Meals', costCenter: 'SALES05', mean: 950, volatility: 0.35 },
  { account: '5300 - Professional Services', costCenter: 'FIN01', mean: 4200, volatility: 0.28 },
  { account: '5500 - Marketing & Events', costCenter: 'MKT01', mean: 3100, volatility: 0.32 },
  { account: '5700 - HR & Recruiting', costCenter: 'HR01', mean: 2500, volatility: 0.25 },
  { account: '5100 - Facilities Expense', costCenter: 'FAC02', mean: 4800, volatility: 0.18 },
  { account: '5900 - Training & Education', costCenter: 'LND01', mean: 900, volatility: 0.30 },
];

const preparers = ['N. Lopez', 'A. Wu', 'R. Patel', 'S. Johnson', 'M. Green', 'K. Rossi'];
const approvers = ['Controller', 'Assistant Controller', 'Sr. Manager', 'Director'];
const sourceSystems = ['NetSuite', 'Workday', 'Coupa'];

let seed = 42;
const rand = () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const roundToNearest = (value: number, step = 5) => Math.round(value / step) * step;

const amountForProfile = (profile: AccountProfile) => {
  const swing = (rand() * 2 - 1) * profile.volatility;
  const base = profile.mean * (1 + swing);
  return Math.max(60, roundToNearest(base));
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const toPeriod = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const addEntry = (
  list: JournalEntry[],
  date: Date,
  profile: AccountProfile,
  amount: number,
  opts?: Partial<JournalEntry> & { jeId?: string }
) => {
  const jeId = opts?.jeId ?? `JE-${formatDate(date).replace(/-/g, '')}-${String(list.length + 1).padStart(4, '0')}`;
  const isDebit = opts?.credit ? false : true;
  const entry: JournalEntry = {
    jeId,
    postingDate: formatDate(date),
    period: toPeriod(date),
    account: profile.account,
    costCenter: profile.costCenter,
    debit: isDebit ? amount : 0,
    credit: isDebit ? 0 : amount,
    description: opts?.description ?? `${profile.account} activity`,
    preparer: opts?.preparer ?? pick(preparers),
    approver: opts?.approver ?? pick(approvers),
    sourceSystem: opts?.sourceSystem ?? pick(sourceSystems),
    reversalOf: opts?.reversalOf,
  };
  list.push(entry);
};

const generateJournalEntries = (): JournalEntry[] => {
  const entries: JournalEntry[] = [];
  const start = new Date('2025-04-15');

  for (let i = 0; i < 90; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    // Generate a set of base entries per day (all profiles for richer volume).
    profiles.forEach((profile) => {
      const amount = amountForProfile(profile);
      addEntry(entries, date, profile, amount, {
        description: `${profile.account} - routine`,
      });
    });

    // Add a balance sheet reclass every few days.
    if (i % 7 === 0) {
      const profile = profiles[0];
      const amount = roundToNearest(amountForProfile(profile) * 0.6);
      addEntry(entries, date, profile, amount, {
        description: 'Monthly true-up',
        credit: amount,
      });
    }

    // Sprinkle extra random adjustments to increase dataset size.
    if (rand() > 0.6) {
      const profile = pick(profiles);
      const amount = roundToNearest(amountForProfile(profile) * (0.5 + rand()));
      addEntry(entries, date, profile, amount, {
        description: 'Ad-hoc adjustment',
        credit: rand() > 0.5 ? amount : 0,
        debit: rand() > 0.5 ? amount : 0,
      });
    }
  }

  // Insert specific anomalies and patterns for demo richness.
  const anomalyDates: { date: string; apply: (date: Date) => void }[] = [
    {
      date: '2025-06-10',
      apply: (date) => {
        const profile = profiles.find((p) => p.account.startsWith('5600'))!;
        const amt = 8200;
        addEntry(entries, date, profile, amt, {
          description: 'Freight clearing - duplicated',
        });
        addEntry(entries, date, profile, amt, {
          description: 'Freight clearing - duplicated',
          preparer: 'R. Patel',
        });
      },
    },
    {
      date: '2025-06-12',
      apply: (date) => {
        const profile = profiles.find((p) => p.account.startsWith('5400'))!;
        addEntry(entries, date, profile, 25000, {
          description: 'Executive offsite flights - unusually high',
        });
      },
    },
    {
      date: '2025-06-15',
      apply: (date) => {
        const profile = profiles.find((p) => p.account.startsWith('5300'))!;
        addEntry(entries, date, profile, 15000, {
          description: 'One-time compliance project',
        });
      },
    },
    {
      date: '2025-06-18',
      apply: (date) => {
        const profile = profiles.find((p) => p.account.startsWith('5600'))!;
        addEntry(entries, date, profile, 4100, {
          description: 'Manual reversal posted without base',
          credit: 4100,
        });
      },
    },
    {
      date: '2025-06-20',
      apply: (date) => {
        const profile = profiles.find((p) => p.account.startsWith('5500'))!;
        addEntry(entries, date, profile, 6200, {
          description: 'Event reversal - late',
          credit: 6200,
          reversalOf: 'JE-20250528-0801',
        });
      },
    },
    {
      date: '2025-06-24',
      apply: (date) => {
        const profile = profiles.find((p) => p.account.startsWith('5200'))!;
        const amt = 1900;
        addEntry(entries, date, profile, amt, {
          description: 'SaaS fee posted twice',
        });
        addEntry(entries, date, profile, amt, {
          description: 'SaaS fee posted twice',
          approver: 'Assistant Controller',
        });
      },
    },
  ];

  anomalyDates.forEach(({ date, apply }) => {
    apply(new Date(date));
  });

  // Create a base accrual and its intended reversal to test reversal logic.
  const accrualDate = new Date('2025-05-28');
  const reversalDate = new Date('2025-06-25');
  const accrualProfile = profiles.find((p) => p.account.startsWith('5500'))!;
  addEntry(entries, accrualDate, accrualProfile, 6200, {
    description: 'Event accrual',
    credit: 6200,
    jeId: 'JE-20250528-0801',
  });
  addEntry(entries, reversalDate, accrualProfile, 7000, {
    description: 'Reversal of JE-20250528-0801 amount mismatch',
    debit: 7000,
    reversalOf: 'JE-20250528-0801',
  });

  // Sort by date to keep predictable ordering.
  entries.sort((a, b) => a.postingDate.localeCompare(b.postingDate));
  return entries;
};

export const journalEntries: JournalEntry[] = generateJournalEntries();
