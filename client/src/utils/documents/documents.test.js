import { describe, expect, it } from 'vitest';
import { buildKinesicReportHtml, buildLicenseLine } from './kinesicReportHtml';
import { buildPatientReceiptHtml } from './patientReceiptHtml';
import { KINESIC_REPORT_TEMPLATES, suggestTemplateId } from './kinesicReportTemplates';
import { calculateAge, formatClinicalRecord, formatDateAR, formatDniAR } from './printDocument';
import {
  countTreatmentSessions,
  getLatestDiagnosis,
  getLatestProfessionalId,
  getPatientCoverage,
  parseAmountInput,
} from '../../components/documents/patientDocumentData';

const professional = { fullName: 'Katia Alumine Romero', licenseNumber: '18900', licenseNumberMP: '10318' };

const buildReport = (templateId, overrides = {}) => {
  const template = KINESIC_REPORT_TEMPLATES[templateId];
  return buildKinesicReportHtml({
    title: template.title,
    treatmentIntro: template.treatmentIntro,
    date: '2026-11-10',
    patient: { fullName: 'María González', dni: '30.111.222', birthDate: '1985-04-12', age: '41', clinicalRecordNumber: 42 },
    coverage: 'OSDE 210',
    affiliateNumber: '61234567-01',
    diagnosis: 'LUMBALGIA MECÁNICA',
    physician: 'Dr. Pérez',
    anamnesis: 'Dolor lumbar de 3 meses de evolución.\nEmpeora al estar sentada.',
    metricsIn: template.metrics.map((metric, index) => ({ label: metric.label, suffix: metric.suffix, value: String(5 + index) })),
    sessions: 10,
    techniques: template.techniques.map((name) => ({ name, detail: 'Objetivo analgésico. Buena tolerancia y mejoría progresiva.' })),
    dischargeStatus: 'Mejoría funcional significativa.',
    metricsOut: template.metrics.map((metric) => ({ label: metric.label, suffix: metric.suffix, value: '2' })),
    plan: 'Continuar con plan de ejercicios domiciliarios.',
    professional: { fullName: professional.fullName, licenseLine: buildLicenseLine(professional) },
    ...overrides,
  });
};

const receipt = {
  displayNumber: '0001-00000042',
  issueDate: '2026-11-10T12:00:00.000Z',
  patientName: 'María González',
  patientDni: '30111222',
  coverage: 'OSDE 210',
  affiliateNumber: '61234567-01',
  professionalName: 'Katia Alumine Romero',
  professionalLicense: 'MN 18900 / MP 10318',
  diagnosis: 'LUMBALGIA MECÁNICA',
  description: '10 sesiones de kinesiología y fisioterapia',
  amount: 150000.5,
};

describe('documentos imprimibles', () => {
  it('arma los tres informes con los datos del paciente, las técnicas y la firma', () => {
    Object.keys(KINESIC_REPORT_TEMPLATES).forEach((templateId) => {
      const html = buildReport(templateId);
      expect(html).toContain(KINESIC_REPORT_TEMPLATES[templateId].title);
      expect(html).toContain('María González');
      expect(html).toContain('0042');
      expect(html).toContain('10/11/2026');
      expect(html).toContain('M.P. 10318 | M.N. 18900');
      KINESIC_REPORT_TEMPLATES[templateId].techniques.forEach((technique) => expect(html).toContain(technique));
    });
  });

  it('escapa el texto ingresado para que no se ejecute HTML', () => {
    const html = buildReport('fkt', { anamnesis: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('arma el comprobante con la leyenda de ARCA, número y total', () => {
    const html = buildPatientReceiptHtml(receipt);
    expect(html).toContain('no válido como factura ante ARCA');
    expect(html).toContain('0001-00000042');
    expect(html).toContain('30.111.222');
    expect(html).toMatch(/150\.000,50/);
  });

  it('formatea fechas, DNI, edad y HC', () => {
    expect(formatDateAR('2026-11-10T12:00:00.000Z')).toBe('10/11/2026');
    expect(formatDniAR('30111222')).toBe('30.111.222');
    expect(calculateAge('1985-04-12', new Date(2026, 10, 10))).toBe('41');
    expect(calculateAge('1900-01-01T12:00:00Z')).toBe('');
    expect(formatClinicalRecord(42)).toBe('0042');
  });
});

describe('datos automáticos del paciente', () => {
  const patient = {
    healthInsurance: 'OSDE',
    obraSocial: { nombreOs: 'OSDE 210' },
    affiliateNumber: '123',
    isIU: true,
    appointments: [
      { date: '2026-11-08', status: 'CANCELLED', diagnosis: 'OTRA', professionalId: 'x' },
      { date: '2026-11-05', status: 'COMPLETED', diagnosis: 'Lumbalgia', professionalId: 'pr1' },
      { date: '2026-11-03', status: 'COMPLETED', diagnosis: 'LUMBALGIA', professionalId: 'pr1' },
      { date: '2026-01-10', status: 'COMPLETED', diagnosis: 'Cervicalgia', professionalId: 'pr2' },
    ],
  };

  it('toma diagnóstico, sesiones del tratamiento actual y profesional del último turno', () => {
    expect(getLatestDiagnosis(patient)).toBe('Lumbalgia');
    expect(countTreatmentSessions(patient)).toBe(2);
    expect(getLatestProfessionalId(patient)).toBe('pr1');
    expect(getPatientCoverage(patient)).toEqual({ coverage: 'OSDE 210', affiliateNumber: '123' });
    expect(getPatientCoverage({ treatAsParticular: true, affiliateNumber: '9' })).toEqual({ coverage: 'Particular', affiliateNumber: '' });
    expect(suggestTemplateId(patient)).toBe('pelvicFloor');
  });

  it('interpreta montos en formato argentino', () => {
    expect(parseAmountInput('15.000')).toBe(15000);
    expect(parseAmountInput('15.000,50')).toBe(15000.5);
    expect(parseAmountInput('$ 1200')).toBe(1200);
    expect(parseAmountInput('12.5')).toBe(12.5);
    expect(Number.isNaN(parseAmountInput(''))).toBe(true);
  });
});
