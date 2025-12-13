'use client';

import { useState } from 'react';
import { DailyReviewSection } from '@/components/DailyReviewSection';
import { ApAccrualSection } from '@/components/ApAccrualSection';
import { MonthCloseOverview } from '@/components/MonthCloseOverview';
import { TopTabs } from '@/components/TopTabs';
import { CloseProgressProvider } from '@/components/CloseProgressProvider';

const tabs = [
  { key: 'je', label: 'Daily JE Review', description: 'Deterministic flags + AI explanations' },
  { key: 'ap', label: 'AP Accrual Co-pilot', description: 'Predict missing invoices & memos' },
  { key: 'overview', label: 'Month-End Close Overview', description: 'Readiness score & summary' },
];

export default function Home() {
  const [active, setActive] = useState('je');

  return (
    <CloseProgressProvider>
      <main className="max-w-6xl mx-auto py-10 px-4 space-y-8">
        <header className="glass rounded-3xl p-8 border border-border/80">
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="chip bg-emerald-500/10 text-emerald-100">Deterministic logic</span>
            <span className="chip bg-accent-strong/15 text-accent-strong">AI only for narratives</span>
            <span className="chip bg-border/50 text-muted">Synthetic JSON data</span>
          </div>
          <h1 className="text-4xl font-semibold mt-4">AI-augmented close co-pilot</h1>
          <p className="text-lg text-muted mt-2 max-w-3xl">
            Explore a ready-to-demo experience that blends deterministic controls (flags, thresholds, accrual math) with AI
            explanations. Built for Vercel deployment and powered by local JSON data.
          </p>
        </header>

        <TopTabs tabs={tabs} active={active} onChange={setActive} />

        {active === 'je' && <DailyReviewSection />}
        {active === 'ap' && <ApAccrualSection />}
        {active === 'overview' && <MonthCloseOverview />}
      </main>
    </CloseProgressProvider>
  );
}
