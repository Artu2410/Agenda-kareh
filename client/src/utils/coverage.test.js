import { describe, expect, it } from 'vitest';
import { getCoverageLabel, isParticularCoverage, resolveCoveragePayload } from './coverage';

describe('coverage utilities', () => {
  it('labels particular coverage consistently', () => {
    expect(isParticularCoverage('', false)).toBe(true);
    expect(isParticularCoverage('PARTICULAR', false)).toBe(true);
    expect(getCoverageLabel('osde', false)).toBe('OSDE');
  });

  it('resolves insured payloads using the matched obra social id', () => {
    expect(resolveCoveragePayload(
      {
        healthInsurance: 'OSDE',
        obraSocialId: '',
        treatAsParticular: false,
      },
      {
        id: 'osde-123',
        nombreOs: 'OSDE',
      },
    )).toEqual({
      obraSocialId: 'osde-123',
      healthInsurance: 'OSDE',
      treatAsParticular: false,
    });
  });

  it('keeps particular payloads controlled even when a coverage was loaded', () => {
    expect(resolveCoveragePayload(
      {
        healthInsurance: 'OSDE',
        obraSocialId: 'osde-123',
        treatAsParticular: true,
      },
      {
        id: 'osde-123',
        nombreOs: 'OSDE',
      },
    )).toEqual({
      obraSocialId: '',
      healthInsurance: 'OSDE',
      treatAsParticular: true,
    });
  });
});
