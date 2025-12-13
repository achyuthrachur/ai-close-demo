'use client';

type Tab = {
  key: string;
  label: string;
  description?: string;
};

type Props = {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
};

export const TopTabs = ({ tabs, active, onChange }: Props) => (
  <div className="flex flex-wrap gap-3">
    {tabs.map((tab) => {
      const isActive = tab.key === active;
      return (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`glass px-4 py-3 rounded-xl text-left transition hover:-translate-y-0.5 ${
            isActive ? 'border-accent-strong shadow-accent-500/40' : 'border-border/60 opacity-80'
          }`}
        >
          <div className="text-sm uppercase tracking-wide text-accent-strong">{tab.label}</div>
          {tab.description && <div className="text-sm text-muted max-w-xs">{tab.description}</div>}
        </button>
      );
    })}
  </div>
);
