import {
  parseWhatsAppWebhookBody,
  parseWhatsAppWebhookChanges,
  parseWhatsAppWebhookMessages,
  parseWhatsAppWebhookStatuses,
  parseWhatsAppWebhookValue,
} from '../src/controllers/whatsapp/dto/incomingMessage.dto.js';
import { normalizeOutgoingConversationMessagePayload } from '../src/controllers/whatsapp/dto/outgoingMessage.dto.js';
import { normalizeWhatsAppMediaContext } from '../src/controllers/whatsapp/dto/mediaMessage.dto.js';

describe('WhatsApp DTO helpers', () => {
  it('normalizes incoming webhook payloads safely', () => {
    const body = parseWhatsAppWebhookBody({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              value: {
                messages: [{ id: 'msg-1' }],
                statuses: [{ id: 'msg-1', status: 'sent' }],
              },
            },
          ],
        },
      ],
    });

    expect(body.object).toBe('whatsapp_business_account');
    expect(body.entries).toHaveLength(1);
    expect(parseWhatsAppWebhookChanges(body.entries[0])).toHaveLength(1);
    expect(parseWhatsAppWebhookValue(parseWhatsAppWebhookChanges(body.entries[0])[0]).messages).toHaveLength(1);
    expect(parseWhatsAppWebhookMessages(parseWhatsAppWebhookValue(parseWhatsAppWebhookChanges(body.entries[0])[0]))).toHaveLength(1);
    expect(parseWhatsAppWebhookStatuses(parseWhatsAppWebhookValue(parseWhatsAppWebhookChanges(body.entries[0])[0]))).toHaveLength(1);
  });

  it('normalizes outgoing conversation payloads', () => {
    expect(normalizeOutgoingConversationMessagePayload({
      text: '  Hola mundo  ',
      file: { name: 'adjunto.pdf' },
    })).toEqual({
      text: 'Hola mundo',
      hasFile: true,
    });
  });

  it('normalizes media contexts with null-safe defaults', () => {
    expect(normalizeWhatsAppMediaContext({
      mediaId: 'media-1',
      mimeType: 'image/png',
      conversationId: 'conv-1',
      filename: 'archivo.png',
      contentType: 'image/png',
    })).toEqual({
      mediaId: 'media-1',
      mimeType: 'image/png',
      conversationId: 'conv-1',
      filename: 'archivo.png',
      contentType: 'image/png',
    });

    expect(normalizeWhatsAppMediaContext({})).toEqual({
      mediaId: null,
      mimeType: null,
      conversationId: null,
      filename: null,
      contentType: null,
    });
  });
});
