import {
  dateOnlySchema,
  dayOfWeekSchema,
  documentsChecklistSchema,
  idSchema,
  optionalDateInput,
  optionalEmail,
  optionalIdSchema,
  optionalPhone,
  optionalString,
  requiredEmail,
  requiredString,
  timeSchema,
} from '../src/validations/common.js';

describe('validation common schemas', () => {
  it('validates and trims required strings', () => {
    expect(requiredString('Nombre').parse('  Ana  ')).toBe('Ana');
    expect(() => requiredString('Nombre').parse('')).toThrow('Nombre es obligatorio');
    expect(() => requiredString('Nombre', { max: 3 }).parse('abcd')).toThrow('Nombre es demasiado largo');
  });

  it('normalizes optional strings and ids', () => {
    expect(optionalString('Observación').parse('   ')).toBeUndefined();
    expect(optionalString('Observación').parse('  visible  ')).toBe('visible');
    expect(idSchema('Movimiento').parse('abc1234567')).toBe('abc1234567');
    expect(optionalIdSchema('Movimiento').parse('   ')).toBeUndefined();
  });

  it('validates emails and phones', () => {
    expect(requiredEmail().parse('  TEST@Example.COM ')).toBe('test@example.com');
    expect(optionalEmail().parse('   ')).toBeUndefined();
    expect(optionalPhone().parse('+54 11 1234-5678')).toBe('+54 11 1234-5678');
    expect(() => optionalPhone().parse('abc')).toThrow('Teléfono inválido');
  });

  it('validates dates and times', () => {
    expect(dateOnlySchema('Fecha').parse('2026-05-28')).toBe('2026-05-28');
    expect(optionalDateInput('Fecha').parse('   ')).toBeUndefined();
    expect(optionalDateInput('Fecha').parse('2026-05-28T10:30:00Z')).toBe('2026-05-28T10:30:00Z');
    expect(timeSchema('Horario').parse('09:30')).toBe('09:30');
    expect(dayOfWeekSchema.parse(6)).toBe(6);
    expect(() => dateOnlySchema('Fecha').parse('2026-02-30')).toThrow('Fecha inválida');
  });

  it('validates the documents checklist schema', () => {
    const result = documentsChecklistSchema.parse({
      documents: [
        {
          name: 'Orden médica',
          mandatory: true,
          presented: false,
          fileUrl: 'https://example.com/document.pdf',
          fileName: 'documento.pdf',
          presentedAt: '2026-05-28',
          validityDays: '30',
          reusedFromAppointmentId: 'turno-12345',
        },
      ],
      additionalInfo: '  Revisar primero  ',
    });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].fileName).toBe('documento.pdf');
    expect(result.additionalInfo).toBe('Revisar primero');
  });

  it('truncates overly long document names to the supported limit', () => {
    const longName = 'A'.repeat(260);
    const result = documentsChecklistSchema.parse({
      documents: [{ name: longName }],
    });

    expect(result.documents[0].name).toHaveLength(255);
    expect(result.documents[0].name).toBe(longName.slice(0, 255));
  });
});
