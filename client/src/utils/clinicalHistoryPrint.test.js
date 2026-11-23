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
  folio: '45',
  phone: '11 2345-6789',
  address: 'Av. Siempreviva 742',
  risks: [{ label: 'Cáncer', active: false }, { label: 'Marcapasos', active: true }],
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

describe('impresión en una hoja', () => {
  const entry = {
    dateLabel: '19/11/2026', diagnosis: 'ANEURISMA', evolutionHtml: '<p>Texto</p>', abandonMessage: '',
    attachments: [{ kind: 'image', url: 'https://x/foto.jpg', label: 'WhatsApp Image.jpeg' }],
    signatureName: 'Lic. Romero', signatureLicenses: 'M.P. 1',
  };
  const html = buildClinicalHistoryPrintHtml({ patientSummary: summary, entries: [entry] });

  it('no imprime los adjuntos', () => {
    expect(html).not.toContain('foto.jpg');
    expect(html).not.toContain('WhatsApp Image');
  });

  it('muestra folio, teléfono y domicilio, y Antecedentes en lugar de Riesgos', () => {
    expect(html).toContain('Folio');
    expect(html).toContain('>45<');
    expect(html).toContain('11 2345-6789');
    expect(html).toContain('Av. Siempreviva 742');
    expect(html).toContain('Antecedentes');
    expect(html).not.toContain('>Riesgos<');
  });

  it('fuerza A4 y escala el contenido para que entre en una hoja', () => {
    expect(html).toContain('size: A4');
    expect(html).toContain('fitToOnePage');
  });
});
