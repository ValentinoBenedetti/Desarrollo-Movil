export type PlotStatus = 'stale' | 'dry' | 'optimal' | 'wet';

export function getPlotStatus(
  moisture_pct: number | null,
  measured_at: string | null,
  threshold_min: number = 25,
  threshold_max: number = 45
): PlotStatus {
  if (moisture_pct === null || measured_at === null) return 'stale';

  const measuredDate = new Date(measured_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - measuredDate.getTime()) / 60000;

  if (diffMinutes > 15) return 'stale';

  if (moisture_pct < threshold_min) return 'dry';
  if (moisture_pct > threshold_max) return 'wet';
  return 'optimal';
}
