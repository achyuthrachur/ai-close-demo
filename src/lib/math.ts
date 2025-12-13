export const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

export const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = average(values);
  const variance = average(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
};

export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
