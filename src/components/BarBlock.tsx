type Props = {
  value: number;
  max: number;
  color: string;
  label: string;
};

export const BarBlock = ({ value, max, color, label }: Props) => {
  const height = Math.min(100, Math.max(8, (value / Math.max(1, max)) * 100));
  return (
    <div className="flex flex-col items-center justify-end gap-1">
      <div className={`w-full rounded-t-md ${color}`} style={{ height: `${height}%` }} title={`${label}: ${value}`} />
      <div className="text-[10px] text-muted text-center leading-none">{label}</div>
    </div>
  );
};
