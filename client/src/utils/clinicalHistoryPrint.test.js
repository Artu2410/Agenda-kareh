import { describe, expect, it } from 'vitest';
import { buildClinicalHistoryPrintHtml, escapePrintHtml } from './clinicalHistoryPrint';

const summary = {
  fullName: 'BENITEZ OLIVIA',
  recordNumber: 'HC 0079',
  dni: '71040715',
  birthDate: '22/1/2026',
  age: '10 meses',
  coverage: 'PARTICULAR',
  coverageClass: 'coverage-blue',
  affiliateNumber: 'Sin número',
  risks: [],
};

describe('escapePrintHtml', () => {
  it('escapa HTML peligroso', () => {
    expect(escapePrintHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
    expect(escapePrintHtml(null)).toBe('');
  });
});

describe('buildClinicalHistoryPrintHtml', () => {
  it('incluye logo, paciente y edad tal cual (sin "años" agregado)', () => {
    const html = buildClinicalHistoryPrintHtml({ patientSummary: summary, entries: [] });
    expect(html).toContain('kareh-login-logo.png');
    expect(html).toContain('BENITEZ OLIVIA');
    expect(html).toContain('>10 meses<');
    expect(html).not.toContain('10 meses años');
  });

  it('renderiza cada evolución con su fecha y firma', () => {
    const html = buildClinicalHistoryPrintHtml({
      patientSummary: summary,
      entries: [{
        dateLabel: '12/10/2026',
        diagnosis: 'CBO',
        evolutionHtml: '<p>Evolución</p>',
        abandonMessage: '',
        attachments: [],
        signatureName: 'Lic. Romero',
        signatureLicenses: 'M.P. 1',
      }],
    });
    expect(html).toContain('12/10/2026');
    expect(html).toContain('Lic. Romero');
  });
});
