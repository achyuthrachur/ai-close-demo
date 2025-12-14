type Props = {
  dup: number;
  unusual: number;
  reversal: number;
  maxTotal: number;
  label?: string;
};

export const StackedBar = ({ dup, unusual, reversal, maxTotal, label }: Props) => {
  const total = dup + unusual + reversal;
  const height = Math.min(240, Math.max(40, (total / Math.max(1, maxTotal)) * 240));
  const dupH = total ? Math.max(6, (dup / total) * height) : 0;
  const unH = total ? Math.max(6, (unusual / total) * height) : 0;
  const revH = total ? Math.max(6, (reversal / total) * height) : 0;
  const caption = label ?? `Dup ${dup} · Unusual ${unusual} · Reversal ${reversal}`;

  return (
    <div className="flex flex-col items-center">
      <div className="w-10 bg-border/60 rounded overflow-hidden" style={{ height }}>
        <div className="w-full bg-amber-400" style={{ height: dupH }} title={`Duplicate: ${dup}`} />
        <div className="w-full bg-rose-400" style={{ height: unH }} title={`Unusual: ${unusual}`} />
        <div className="w-full bg-purple-400" style={{ height: revH }} title={`Reversal: ${reversal}`} />
      </div>
      <div className="text-[10px] text-muted mt-1 leading-none">{caption}</div>
    </div>
  );
};
