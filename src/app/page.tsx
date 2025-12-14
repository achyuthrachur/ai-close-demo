'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DailyReviewSection } from '@/components/DailyReviewSection';
import { ApAccrualSection } from '@/components/ApAccrualSection';
import { MonthCloseOverview } from '@/components/MonthCloseOverview';
import { TopTabs } from '@/components/TopTabs';
import { CloseProgressProvider } from '@/components/CloseProgressProvider';

const tabs = [
  { key: 'je', label: 'JE Review', description: 'Deterministic flags + AI explanations' },
  { key: 'ap', label: 'AP Accrual Co-pilot', description: 'Predict missing invoices & memos' },
  { key: 'overview', label: 'Month-End Close Overview', description: 'Readiness score & summary' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const HomeShell = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams?.get('tab') as TabKey) ?? 'je';
  const [active, setActive] = useState<TabKey>(initialTab);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showData, setShowData] = useState(false);

  useEffect(() => {
    const nextTab = (searchParams?.get('tab') as TabKey) ?? 'je';
    setActive(nextTab);
  }, [searchParams]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }, [theme]);

  const onTabChange = (key: TabKey) => {
    setActive(key);
    const params = new URLSearchParams(searchParams?.toString());
    params.set('tab', key);
    router.push(`/?${params.toString()}${window.location.hash}`);
  };

  const loadDemoData = () => {
    setShowData(true);
    setActive('je');
    setMode('MONTH');
    setSelected(defaultMonth);
    const params = new URLSearchParams(searchParams?.toString());
    params.set('tab', 'je');
    params.set('jeMode', 'MONTH');
    params.set('jeDate', defaultMonth);
    router.push(`/?${params.toString()}`);
  };

  return (
    <CloseProgressProvider>
      <main className="w-full max-w-screen-2xl mx-auto py-10 px-4 md:px-8 space-y-8">
        <header className="glass rounded-3xl p-8 border border-border/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-sm text-muted">
              <span className="chip bg-emerald-100 text-emerald-800 border-emerald-300">Deterministic logic</span>
              <span className="chip bg-sky-100 text-sky-800 border-sky-300">AI narratives</span>
              <span className="chip bg-slate-200 text-slate-800 border-slate-300">Synthetic JSON data</span>
            </div>
            <h1 className="text-4xl font-semibold mt-4">AI-Augmented Journal Entry</h1>
            <p className="text-lg text-muted mt-2 max-w-3xl">
              Explore a ready-to-demo experience that blends deterministic controls (flags, thresholds, accrual math) with AI
              explanations. Click below to load demo data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-border/40"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
            </button>
            {!showData && (
              <button
                onClick={loadDemoData}
                className="px-4 py-2 rounded-lg bg-accent-strong text-white font-semibold shadow"
              >
                Load demo data
              </button>
            )}
          </div>
        </header>

        {!showData ? (
          <div className="glass rounded-3xl p-10 border border-border/80 text-center">
            <p className="text-lg text-muted">Data is hidden until you load it.</p>
            <button
              onClick={loadDemoData}
              className="mt-4 px-5 py-3 rounded-lg bg-accent-strong text-white font-semibold shadow"
            >
              Load Demo Data
            </button>
          </div>
        ) : (
          <>
            <TopTabs tabs={tabs} active={active} onChange={onTabChange} />
            {active === 'je' && <DailyReviewSection />}
            {active === 'ap' && <ApAccrualSection />}
            {active === 'overview' && <MonthCloseOverview />}
          </>
        )}
      </main>
    </CloseProgressProvider>
  );
};

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6 text-muted">Loading dashboard...</div>}>
      <HomeShell />
    </Suspense>
  );
}
