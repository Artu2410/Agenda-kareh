import {
  computeExpiry,
  isValidFileSignature,
  signFileKey,
  signUploadUrls,
  stripUploadUrlQueries,
} from '../src/utils/fileUrlSigning.js';

describe('fileUrlSigning', () => {
  const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-file-signing-1234567890';
    delete process.env.FILE_URL_SECRET;
    delete process.env.FILE_URL_TTL_HOURS;
  });

  it('signs /uploads URLs in nested responses and leaves other values alone', () => {
    const body = {
      patient: { dniImageUrl: 'https://api.example.com/uploads/patient-documents/dni.jpg', age: 40 },
      attachments: JSON.stringify([{ url: '/uploads/clinical-history/a.png' }]),
      external: 'https://otro.com/wp-content/uploads/x.jpg?v=1',
      createdAt: new Date(NOW),
    };

    const signed = signUploadUrls(body, NOW);

    expect(signed.patient.dniImageUrl).toMatch(/\/uploads\/patient-documents\/dni\.jpg\?exp=\d+&sig=[\w-]{43}$/);
    expect(signed.attachments).toMatch(/a\.png\?exp=\d+&sig=[\w-]{43}/);
    expect(signed.external).toBe(body.external);
    expect(signed.patient.age).toBe(40);
    expect(signed.createdAt).toBe(body.createdAt);
  });

  it('validates signature, path and expiry', () => {
    const exp = computeExpiry(NOW);
    const sig = signFileKey('patient-documents/dni.jpg', exp);

    expect(isValidFileSignature({ key: 'patient-documents/dni.jpg', exp, sig, nowMs: NOW })).toBe(true);
    expect(isValidFileSignature({ key: 'patient-documents/otro.jpg', exp, sig, nowMs: NOW })).toBe(false);
    expect(isValidFileSignature({ key: 'patient-documents/dni.jpg', exp, sig, nowMs: exp * 1000 + 1 })).toBe(false);
    expect(isValidFileSignature({ key: 'patient-documents/dni.jpg', exp: exp + 86400 * 30, sig: signFileKey('patient-documents/dni.jpg', exp + 86400 * 30), nowMs: NOW })).toBe(false);
  });

  it('treats encoded and decoded paths as the same key', () => {
    const exp = computeExpiry(NOW);
    const sig = signFileKey('docs/a%20b.pdf', exp);
    expect(isValidFileSignature({ key: 'docs/a b.pdf', exp, sig, nowMs: NOW })).toBe(true);
  });

  it('strips signatures and tokens before saving', () => {
    const input = { url: '/uploads/x/y.pdf?exp=1&sig=abc', other: '/uploads/z.png?token=secret' };
    expect(stripUploadUrlQueries(input)).toEqual({ url: '/uploads/x/y.pdf', other: '/uploads/z.png' });
  });
});
