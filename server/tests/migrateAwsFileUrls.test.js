import {
  migrateStoredFileUrl,
  migrateAttachmentsJson,
} from '../scripts/migrate-aws-file-urls.js';

describe('AWS file URL migration', () => {
  it('converts virtual-hosted S3 URLs to local upload paths', () => {
    expect(migrateStoredFileUrl(
      'https://kareh-uploads.s3.amazonaws.com/patient-documents/patient-1/card.jpg'
    )).toBe('/uploads/patient-documents/patient-1/card.jpg');
  });

  it('converts path-style S3 URLs and preserves safe URL encoding', () => {
    expect(migrateStoredFileUrl(
      'https://s3.us-east-1.amazonaws.com/kareh-uploads/whatsapp/chat/file%20name.pdf?download=1'
    )).toBe('/uploads/whatsapp/chat/file%20name.pdf');
  });

  it('converts a legacy public URL that contains the bucket name', () => {
    expect(migrateStoredFileUrl(
      'https://legacy-files.example.com/kareh-uploads/tickets/ticket.pdf'
    )).toBe('/uploads/tickets/ticket.pdf');
  });

  it('leaves unrelated URLs and existing local paths unchanged', () => {
    expect(migrateStoredFileUrl('https://example.com/logo.png')).toBeNull();
    expect(migrateStoredFileUrl('/uploads/tickets/ticket.pdf')).toBeNull();
    expect(migrateStoredFileUrl(null)).toBeNull();
  });

  it('migrates attachment JSON without changing unrelated metadata', () => {
    const input = JSON.stringify([
      {
        name: 'orden.pdf',
        url: 'https://kareh-uploads.s3.amazonaws.com/clinical-history/patient-1/entry-1/orden.pdf',
      },
      { name: 'nota', data: 'texto' },
    ]);

    expect(migrateAttachmentsJson(input).value).toBe(JSON.stringify([
      {
        name: 'orden.pdf',
        url: '/uploads/clinical-history/patient-1/entry-1/orden.pdf',
      },
      { name: 'nota', data: 'texto' },
    ]));
  });
});
