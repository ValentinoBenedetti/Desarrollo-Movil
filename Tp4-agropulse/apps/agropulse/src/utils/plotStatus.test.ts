import { getPlotStatus } from './plotStatus';

describe('plotStatus', () => {
  it('returns stale if measured_at is null', () => {
    expect(getPlotStatus(30, null)).toBe('stale');
  });

  it('returns stale if reading is older than 15 minutes', () => {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60000).toISOString();
    expect(getPlotStatus(30, twentyMinsAgo)).toBe('stale');
  });

  it('returns dry if moisture is below threshold_min', () => {
    const now = new Date().toISOString();
    expect(getPlotStatus(20, now, 25, 45)).toBe('dry');
  });

  it('returns optimal if moisture is within thresholds', () => {
    const now = new Date().toISOString();
    expect(getPlotStatus(30, now, 25, 45)).toBe('optimal');
  });

  it('returns wet if moisture is above threshold_max', () => {
    const now = new Date().toISOString();
    expect(getPlotStatus(50, now, 25, 45)).toBe('wet');
  });
});
