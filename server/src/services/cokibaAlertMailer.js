import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import logger from '../config/logger.js';
import { sendEmail } from './mailer.js';

const alertLogger = logger.child({ service: 'cokiba-alert-mailer' });

const FIELD_LABELS = {
  estado: 'Estado',
  isActive: 'Estado activo',
  detectedStatus: 'Estado detectado',
  detectedIsActive: 'Estado activo detectado',
  honorarioEstimado: 'Honorario estimado',
  coseguroValor: 'Coseguro (fijo)',
  percentageCoinsurance: 'Coseguro (%)',
  fixedCopay: 'Copago fijo',
  requiresAuthorization: 'Requiere autorización',
  authorizationType: 'Tipo de autorización',
  atendibleSanMiguel: 'Atendible San Miguel',
  plazoPago: 'Plazo de pago (días)',
  authorizationNote: 'Nota de autorización',
};

const AUTH_TYPE_LABELS = {
  TOKEN_ONLINE: 'Token online',
  COKIBA_SISTEMA: 'Sistema COKIBA',
  PRESENCIAL: 'Presencial',
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatCurrency = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return escapeHtml(value);
  }

  return `$${numberValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatFieldValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (AUTH_TYPE_LABELS[value]) return AUTH_TYPE_LABELS[value];

  if (['honorarioEstimado', 'coseguroValor', 'fixedCopay'].includes(field)) {
    return formatCurrency(value);
  }

  if (field === 'percentageCoinsurance') {
    const numberValue = Number(value);
    return Number.isFinite(numberValue)
      ? `${numberValue.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`
      : escapeHtml(value);
  }

  if (field === 'plazoPago') {
    return `${escapeHtml(value)} días`;
  }

  return escapeHtml(value);
};

const isFeeChange = (change) => (
  ['honorarioEstimado', 'coseguroValor', 'percentageCoinsurance', 'fixedCopay'].includes(change.field)
);

const partitionChangedEntries = (changedEntries = []) => {
  const partitions = {
    suspended: [],
    reactivated: [],
    fee: [],
    other: [],
  };

  changedEntries.forEach((entry) => {
    if (entry.previous?.isActive !== false && entry.current?.isActive === false) {
      partitions.suspended.push(entry);
      return;
    }

    if (entry.previous?.isActive === false && entry.current?.isActive !== false) {
      partitions.reactivated.push(entry);
      return;
    }

    if (Array.isArray(entry.changes) && entry.changes.some(isFeeChange)) {
      partitions.fee.push(entry);
      return;
    }

    partitions.other.push(entry);
  });

  return partitions;
};

const buildChangedOsRows = (changedEntries) =>
  changedEntries
    .map(({ nombreOs, changes }) => {
      const fieldRows = (changes || [])
        .map(({ field, before, after }) => {
          const label = FIELD_LABELS[field] || field;
          const beforeFmt = formatFieldValue(field, before);
          const afterFmt = formatFieldValue(field, after);

          return `
            <tr>
              <td style="padding:6px 12px;color:#64748b;font-size:13px;">${escapeHtml(label)}</td>
              <td style="padding:6px 12px;font-size:13px;color:#dc2626;text-decoration:line-through;">${beforeFmt}</td>
              <td style="padding:6px 12px;font-size:13px;color:#16a34a;">${afterFmt}</td>
            </tr>`;
        })
        .join('');

      return `
        <div style="margin-bottom:16px;">
          <p style="margin:0 0 6px;font-weight:600;font-size:14px;color:#0f172a;">${escapeHtml(nombreOs)}</p>
          <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#e2e8f0;">
                <th style="padding:6px 12px;text-align:left;font-size:12px;color:#475569;">Campo</th>
                <th style="padding:6px 12px;text-align:left;font-size:12px;color:#475569;">Antes</th>
                <th style="padding:6px 12px;text-align:left;font-size:12px;color:#475569;">Ahora</th>
              </tr>
            </thead>
            <tbody>${fieldRows}</tbody>
          </table>
        </div>`;
    })
    .join('');

const buildOsNameList = (records) =>
  (records || [])
    .map((record) => `<li style="margin:4px 0;">• ${escapeHtml(record.nombreOs || record.codigoCokiba || 'Sin nombre')}</li>`)
    .join('');

const buildSubject = (diffSummary = {}) => {
  const parts = [];

  if (diffSummary.activeToInactive) parts.push(`${diffSummary.activeToInactive} suspendida/s`);
  if (diffSummary.inactiveToActive) parts.push(`${diffSummary.inactiveToActive} reactivada/s`);
  if (diffSummary.addedCount) parts.push(`${diffSummary.addedCount} nueva/s`);
  if (diffSummary.removedCount) parts.push(`${diffSummary.removedCount} baja/s`);
  if (diffSummary.honorarioChanges) parts.push(`${diffSummary.honorarioChanges} cambio/s de aranceles`);
  if (diffSummary.authorizationChanges) parts.push(`${diffSummary.authorizationChanges} cambio/s de autorización`);

  if (parts.length === 0 && diffSummary.changedCount) {
    parts.push(`${diffSummary.changedCount} otro/s cambio/s`);
  }

  if (parts.length === 0) {
    parts.push('sin cambios relevantes');
  }

  const prefix = diffSummary.activeToInactive > 0
    ? '🔴 URGENTE — '
    : diffSummary.honorarioChanges > 0 && !diffSummary.activeToInactive && !diffSummary.removedCount
      ? '💰 '
      : '🔄 ';

  return `${prefix}COKIBA: ${parts.join(' · ')}`;
};

/**
 * Construye el HTML completo del email de alerta.
 */
export const buildCokibaAlertHtml = ({ diffSummary = {}, diff = {}, snapshotAt } = {}) => {
  const dateStr = format(new Date(snapshotAt || Date.now()), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es });
  const partitions = partitionChangedEntries(diff.changed || []);

  const sections = [];

  if (partitions.suspended.length > 0) {
    sections.push(`
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#dc2626;">
          🔴 Suspensiones (${partitions.suspended.length})
        </h3>
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
          Prestaciones suspendidas — cobrar en forma particular al paciente.
        </p>
        ${buildChangedOsRows(partitions.suspended)}
      </div>`);
  }

  if (diff.added?.length > 0) {
    sections.push(`
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#16a34a;">
          🟢 Altas en el catálogo (${diff.added.length})
        </h3>
        <ul style="margin:0;padding-left:0;list-style:none;font-size:13px;color:#0f172a;">
          ${buildOsNameList(diff.added)}
        </ul>
      </div>`);
  }

  if (partitions.reactivated.length > 0) {
    sections.push(`
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#0284c7;">
          🔵 Reactivaciones (${partitions.reactivated.length})
        </h3>
        ${buildChangedOsRows(partitions.reactivated)}
      </div>`);
  }

  if (partitions.fee.length > 0) {
    sections.push(`
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#b45309;">
          💰 Cambios de aranceles / coseguros (${partitions.fee.length})
        </h3>
        ${buildChangedOsRows(partitions.fee)}
      </div>`);
  }

  if (partitions.other.length > 0) {
    sections.push(`
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#7c3aed;">
          🔄 Otros cambios (${partitions.other.length})
        </h3>
        ${buildChangedOsRows(partitions.other)}
      </div>`);
  }

  if (diff.removed?.length > 0) {
    sections.push(`
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 10px;font-size:15px;color:#94a3b8;">
          ⚪ Bajas del catálogo (${diff.removed.length})
        </h3>
        <ul style="margin:0;padding-left:0;list-style:none;font-size:13px;color:#64748b;">
          ${buildOsNameList(diff.removed)}
        </ul>
      </div>`);
  }

  const summaryBadges = [
    diffSummary.addedCount ? `<span style="background:#dcfce7;color:#16a34a;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;">+${diffSummary.addedCount} altas</span>` : '',
    diffSummary.removedCount ? `<span style="background:#f1f5f9;color:#64748b;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;">−${diffSummary.removedCount} bajas</span>` : '',
    diffSummary.activeToInactive ? `<span style="background:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;">🔴 ${diffSummary.activeToInactive} suspendidas</span>` : '',
    diffSummary.inactiveToActive ? `<span style="background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;">🔵 ${diffSummary.inactiveToActive} reactivadas</span>` : '',
    diffSummary.honorarioChanges ? `<span style="background:#fef3c7;color:#b45309;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;">💰 ${diffSummary.honorarioChanges} cambios de aranceles</span>` : '',
    diffSummary.authorizationChanges ? `<span style="background:#ede9fe;color:#6d28d9;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;">🔐 ${diffSummary.authorizationChanges} cambios de autorización</span>` : '',
    partitions.other.length ? `<span style="background:#ede9fe;color:#7c3aed;padding:4px 12px;border-radius:99px;font-size:13px;font-weight:600;">🔄 ${partitions.other.length} otros cambios</span>` : '',
  ].filter(Boolean).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="background:#0d9488;padding:24px 32px;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#ccfbf1;text-transform:uppercase;">
            Kareh Salud · Agenda
          </p>
          <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;font-weight:700;">
            ${escapeHtml(buildSubject(diffSummary))}
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#ccfbf1;">
            Sincronización COKIBA · ${escapeHtml(dateStr)}
          </p>
        </div>

        <div style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            ${summaryBadges}
          </div>
        </div>

        <div style="padding:24px 32px;">
          ${sections.join('')}
        </div>

        <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            Este correo es generado automáticamente por el sistema Kareh Agenda.
            Podés ver el detalle completo en la sección Obras Sociales del panel.
          </p>
        </div>
      </div>
    </body>
    </html>`;
};

/**
 * Envía el email de alerta COKIBA a la dirección configurada.
 * Solo envía si hay cambios reales (diffSummary.hasChanges === true).
 *
 * @param {{ diffSummary: object, diff: object, snapshotAt: string }} params
 */
export const sendCokibaAlertEmail = async ({ diffSummary, diff, snapshotAt }) => {
  const alertEmail = String(process.env.KAREH_ALERT_EMAIL || '').trim();

  if (!alertEmail || !alertEmail.includes('@')) {
    alertLogger.warn('KAREH_ALERT_EMAIL no configurado — email de alerta omitido');
    return { skipped: true, reason: 'no_alert_email' };
  }

  if (!diffSummary?.hasChanges) {
    return { skipped: true, reason: 'no_changes' };
  }

  if (!process.env.RESEND_API_KEY) {
    alertLogger.warn('RESEND_API_KEY no configurada — email de alerta omitido');
    return { skipped: true, reason: 'no_resend_api_key' };
  }

  const subject = buildSubject(diffSummary);
  const html = buildCokibaAlertHtml({ diffSummary, diff, snapshotAt });

  try {
    const result = await sendEmail({ to: alertEmail, subject, html });

    if (result?.delivered) {
      alertLogger.info('Email de alerta COKIBA enviado', { to: alertEmail, subject });
    }

    return result;
  } catch (error) {
    alertLogger.error('No se pudo enviar el email de alerta COKIBA', {
      errorMessage: error.message,
      to: alertEmail,
    });

    return { delivered: false, error: error.message };
  }
};
