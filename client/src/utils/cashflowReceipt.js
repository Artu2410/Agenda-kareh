import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatAccountFlow } from './cashflow';

const BRAND_NAME = 'KAREH';
const CONTACT_PHONE = '+54 9 11 3201-6039';
const CONTACT_ADDRESS = 'Av. Senador Morón 782, Bella Vista';
const THERMAL_WIDTH_MM = 58;
const FISCAL_DISCLAIMER = 'COMPROBANTE INTERNO. NO VALIDO COMO FACTURA O RECIBO FISCAL ANTE ARCA (EX AFIP).';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatCurrency = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
}).format(Number.parseFloat(value) || 0);

const formatDateTime = (value) => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
  }

  return format(parsed, 'dd/MM/yyyy HH:mm', { locale: es });
};

const getReceiptReference = (id) => {
  const safeId = String(id || '').trim();
  if (!safeId) return 'SIN-REF';
  return safeId.slice(-8).toUpperCase();
};

const buildReceiptHtml = (transaction) => {
  const patientName = transaction?.appointment?.patient?.fullName?.trim();
  const concept = transaction?.concept?.trim() || 'Movimiento de caja';
  const paymentMethod = transaction?.paymentMethod?.trim() || 'No especificado';
  const accountFlow = formatAccountFlow(transaction);
  const issueDate = formatDateTime(new Date());
  const movementDate = formatDateTime(transaction?.date);
  const amount = formatCurrency(transaction?.amount);
  const reference = getReceiptReference(transaction?.id);

  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprobante ${escapeHtml(reference)}</title>
        <style>
          @page {
            size: ${THERMAL_WIDTH_MM}mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            width: ${THERMAL_WIDTH_MM}mm;
            background: #ffffff;
            color: #000000;
            font-family: "Courier New", monospace;
          }

          body {
            padding: 3mm;
          }

          .ticket {
            width: 100%;
            font-size: 12px;
            line-height: 1.5;
          }

          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 2mm;
            margin-bottom: 2mm;
          }

          .brand {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: 1px;
            line-height: 1;
          }

          .subtitle {
            margin-top: 1mm;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .block {
            margin-bottom: 2mm;
          }

          .label {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }

          .value {
            font-size: 13px;
            font-weight: 900;
            word-break: break-word;
          }

          .amount {
            margin: 2mm 0;
            padding: 1.5mm 0;
            text-align: center;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
          }

          .amount-label {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .amount-value {
            font-size: 22px;
            font-weight: 900;
            line-height: 1.1;
          }

          .divider {
            border-top: 1px dashed #000;
            margin: 2mm 0;
          }

          .footer {
            text-align: center;
            font-size: 11px;
            font-weight: 900;
          }

          .footer-line {
            margin-top: 1mm;
          }

          .disclaimer {
            margin-top: 2mm;
            font-size: 10px;
            font-weight: 900;
            text-align: center;
            line-height: 1.4;
            text-transform: uppercase;
          }

          @media print {
            body {
              padding: 2.5mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="brand">${BRAND_NAME}</div>
            <div class="subtitle">Comprobante de recepcion</div>
          </div>

          <div class="block">
            <div class="label">Referencia</div>
            <div class="value">${escapeHtml(reference)}</div>
          </div>

          <div class="block">
            <div class="label">Fecha registrada</div>
            <div class="value">${escapeHtml(movementDate)}</div>
          </div>

          <div class="block">
            <div class="label">Emitido</div>
            <div class="value">${escapeHtml(issueDate)}</div>
          </div>

          ${patientName ? `
            <div class="block">
              <div class="label">Paciente</div>
              <div class="value">${escapeHtml(patientName)}</div>
            </div>
          ` : ''}

          <div class="block">
            <div class="label">Concepto</div>
            <div class="value">${escapeHtml(concept)}</div>
          </div>

          <div class="block">
            <div class="label">Medio de pago</div>
            <div class="value">${escapeHtml(paymentMethod)}</div>
          </div>

          <div class="block">
            <div class="label">Cuenta acreditada</div>
            <div class="value">${escapeHtml(accountFlow)}</div>
          </div>

          <div class="amount">
            <div class="amount-label">Importe recibido</div>
            <div class="amount-value">${escapeHtml(amount)}</div>
          </div>

          <div class="divider"></div>

          <div class="footer">
            <div class="footer-line">${escapeHtml(CONTACT_PHONE)}</div>
            <div class="footer-line">${escapeHtml(CONTACT_ADDRESS)}</div>
          </div>

          <div class="disclaimer">${escapeHtml(FISCAL_DISCLAIMER)}</div>
        </div>
      </body>
    </html>
  `;
};

export const openCashflowReceiptPrintWindow = (transaction) => {
  const printWindow = window.open('', '', 'height=720,width=480');

  if (!printWindow) {
    window.alert('El navegador bloqueó la ventana de impresión.');
    return false;
  }

  printWindow.document.write(buildReceiptHtml(transaction));
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.onafterprint = () => {
    printWindow.close();
  };

  return true;
};
