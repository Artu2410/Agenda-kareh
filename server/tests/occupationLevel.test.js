import { getOccupationLevel } from '../src/controllers/capacity.controller.js';

describe('getOccupationLevel', () => {
  it('keeps occupancy below 10% as underused', () => {
    expect(getOccupationLevel(9.9).key).toBe('UNDERUSED');
  });

  it('classifies 10% occupancy as healthy', () => {
    expect(getOccupationLevel(10).key).toBe('HEALTHY');
    expect(getOccupationLevel(10.2).label).toBe('Saludable');
  });

  it('preserves the higher occupancy warning thresholds', () => {
    expect(getOccupationLevel(70).key).toBe('HIGH');
    expect(getOccupationLevel(85).key).toBe('HIGH');
    expect(getOccupationLevel(85.1).key).toBe('SATURATION');
    expect(getOccupationLevel(95.1).key).toBe('OPERATIVE_RISK');
  });
});
