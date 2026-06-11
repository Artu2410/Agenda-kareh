import { Resend } from 'resend';
import logger from '../config/logger.js';

const mailerLogger = logger.child({ service: 'mailer' });

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
};

const getFromAddress = () => {
  const name = process.env.RESEND_FROM_NAME || 'Kareh Salud';
  const email = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'onboarding@resend.dev';
  return `${name} <${email}>`;
};

/**
 * Envía un email con Resend.
 * En desarrollo sin RESEND_API_KEY loguea el contenido y no falla.
 *
 * @param {{ to: string|string[], subject: string, html: string }} options
 * @returns {Promise<{ delivered: boolean }>}
 */
export const sendEmail = async ({ to, subject, html }) => {
  const resend = getResendClient();

  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY no configurada — no se puede enviar email en producción.');
    }

    mailerLogger.warn('Email omitido en desarrollo (sin RESEND_API_KEY)', { to, subject });
    return { delivered: false };
  }

  const recipients = Array.isArray(to) ? to : [to];

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: recipients,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }

  mailerLogger.info('Email enviado', { to: recipients, subject });
  return { delivered: true };
};

export { getFromAddress, getResendClient };
