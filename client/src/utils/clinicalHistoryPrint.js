// HTML autocontenido para imprimir la historia clínica (ventana nueva + window.print).
// Todos los valores de texto deben llegar ya escapados con escapePrintHtml.

export const escapePrintHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const buildClinicalHistoryPrintHtml = ({ patientSummary, entries }) => {
  const entryMarkup = entries.length > 0
    ? entries.map((entry) => {
      // Los adjuntos (fotos, PDFs) no se imprimen: la historia va en una sola hoja.
      return `
        <article class="session-card">
          <div class="session-card__header">
            <span class="session-date">${entry.dateLabel}</span>
          </div>
          <div class="session-card__body">
            <h2>${entry.diagnosis}</h2>
            <div class="evolution-block">${entry.evolutionHtml}</div>
            ${entry.abandonMessage ? `<p class="abandon-note">${entry.abandonMessage}</p>` : ''}
            ${entry.signatureName ? `
              <div class="signature">
                <div class="signature-name">${entry.signatureName}</div>
                ${entry.signatureLicenses ? `<div class="signature-licenses">${entry.signatureLicenses}</div>` : ''}
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }).join('')
    : `
      <article class="session-card">
        <div class="session-card__body">
          <h2>Sin evoluciones visibles</h2>
          <div class="evolution-block">
            No hay registros visibles para imprimir en este momento.
          </div>
        </div>
      </article>
    `;

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Historia clínica - ${patientSummary.fullName}</title>
        <style>
          @page {
            size: A4;
            margin: 14mm;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #f4f5f7;
            color: #1e293b;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            padding: 18px;
          }

          .print-shell {
            max-width: 1120px;
            margin: 0 auto;
          }

          .print-header {
            margin-bottom: 28px;
            padding-bottom: 20px;
            border-bottom: 1px solid #cbd5e1;
          }

          .eyebrow {
            margin-bottom: 10px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.35em;
            text-transform: uppercase;
            color: #0d9488;
          }

          .record-badge {
            display: inline-flex;
            margin-bottom: 14px;
            padding: 8px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            background: #f1f5f9;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: #64748b;
          }

          .patient-title {
            margin: 0;
            font-size: 42px;
            font-weight: 900;
            font-style: italic;
            letter-spacing: -0.04em;
            text-transform: uppercase;
            color: #0f172a;
          }

          .layout {
            display: grid;
            grid-template-columns: 220px minmax(0, 1fr);
            gap: 28px;
            align-items: start;
          }

          .sidebar {
            display: grid;
            gap: 20px;
          }

          .sidebar-card,
          .session-card {
            break-inside: avoid;
            box-shadow: none;
            overflow: hidden;
            border-radius: 28px;
            background: #ffffff;
          }

          .sidebar-card {
            border: 1px solid #cbd5e1;
            padding: 24px;
          }

          .sidebar-card.risk-card {
            border-color: #fcd34d;
            background: rgba(254, 243, 199, 0.55);
          }

          .sidebar-title {
            margin: 0 0 16px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: #94a3b8;
          }

          .field {
            padding-bottom: 12px;
            margin-bottom: 12px;
            border-bottom: 1px solid #cbd5e1;
          }

          .field:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: 0;
          }

          .field-label {
            margin-bottom: 4px;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: #94a3b8;
          }

          .field-value {
            font-size: 13px;
            font-weight: 900;
            color: #1e293b;
            word-break: break-word;
          }

          .age-badge {
            display: inline-flex;
            padding: 4px 10px;
            border-radius: 999px;
            background: #ccfbf1;
            color: #0f766e;
          }

          .coverage-teal {
            color: #0f766e;
          }

          .coverage-blue {
            color: #1d4ed8;
          }

          .risk-list {
            display: grid;
            gap: 12px;
          }

          .risk-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            background: #ffffff;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            color: #1e293b;
          }

          .risk-check {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            background: #ffffff;
            color: transparent;
            font-size: 12px;
          }

          .risk-check.active {
            border-color: #0d9488;
            background: #0d9488;
            color: #ffffff;
          }

          .sessions {
            display: grid;
            gap: 24px;
          }

          .session-card {
            border: 2px solid #e2e8f0;
          }

          .session-card__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 28px;
            border-bottom: 1px solid #cbd5e1;
            background: #f1f5f9;
          }

          .session-date {
            display: inline-flex;
            padding: 8px 16px;
            border: 1px solid #cbd5e1;
            border-radius: 18px;
            background: #ffffff;
            font-size: 12px;
            font-weight: 900;
            color: #0f766e;
          }

          .session-card__body {
            padding: 28px;
          }

          .session-card__body h2 {
            margin: 0 0 18px;
            font-size: 30px;
            font-weight: 900;
            letter-spacing: -0.03em;
            text-transform: uppercase;
            color: #0f172a;
            word-break: break-word;
          }

          .evolution-block {
            min-height: 120px;
            font-size: 15px;
            line-height: 1.7;
            color: #334155;
            word-break: break-word;
          }

          .evolution-block ul,
          .evolution-block ol {
            margin: 14px 0;
            padding-left: 24px;
          }

          .evolution-block ul {
            list-style: disc;
          }

          .evolution-block ol {
            list-style: decimal;
          }

          .evolution-block li + li {
            margin-top: 6px;
          }

          .evolution-block mark {
            padding: 0 4px;
            border-radius: 3px;
          }

          .evolution-block strong {
            font-weight: 900;
          }

          .abandon-note {
            margin: 18px 0 0;
            padding: 12px 16px;
            border: 2px solid #f59e0b;
            border-radius: 14px;
            background: #fde047;
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            color: #422006;
          }

          .signature {
            margin-top: 24px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            text-align: right;
          }

          .signature-name {
            font-size: 13px;
            font-weight: 900;
            color: #0f172a;
          }

          .signature-licenses {
            margin-top: 2px;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
          }

          .attachments-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
          }

          .attachment-card {
            overflow: hidden;
            border: 1px solid #cbd5e1;
            border-radius: 18px;
            background: #f8fafc;
          }

          .image-card img {
            display: block;
            width: 100%;
            height: 150px;
            object-fit: cover;
            background: #e2e8f0;
          }

          .image-card figcaption,
          .file-card {
            padding: 12px;
          }

          .image-card figcaption {
            font-size: 10px;
            font-weight: 900;
            color: #475569;
            word-break: break-word;
          }

          .file-card {
            display: flex;
            min-height: 150px;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            text-align: center;
          }

          .file-badge {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #0f172a;
          }

          .file-label {
            font-size: 10px;
            font-weight: 900;
            color: #64748b;
            word-break: break-word;
          }

          /* --- Ajustes de impresión (A4) --- */
          html, body { background: #ffffff; }
          .print-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
          }
          .print-header__text { min-width: 0; }
          .print-logo {
            width: 120px;
            height: auto;
            flex-shrink: 0;
          }
          .patient-title { font-size: 32px; overflow-wrap: anywhere; }
          /* Ficha arriba y evoluciones a todo el ancho: una grilla de dos columnas
             con tarjetas que no se pueden cortar dejaba la primera hoja vacía. */
          .layout { display: block; }
          .sidebar {
            display: grid;
            grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
            gap: 14px;
            margin-bottom: 18px;
          }
          .sidebar-card { padding: 16px 18px; border-radius: 18px; }
          .sidebar-card:first-child .field-list,
          .sidebar-card:first-child {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            column-gap: 18px;
          }
          .sidebar-card:first-child .sidebar-title { grid-column: 1 / -1; }
          .sidebar-card:first-child .field,
          .sidebar-card:first-child .field:last-child {
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          .sessions { display: block; }
          .session-card {
            break-inside: auto;
            margin-bottom: 16px;
            border: 1px solid #cbd5e1;
            border-radius: 18px;
          }
          .session-card__header,
          .session-card__body h2,
          .signature { break-inside: avoid; break-after: auto; }
          .session-card__body h2 { break-after: avoid; }
          .attachments-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          }
          .attachment-card { margin: 0; break-inside: avoid; }
          figure.attachment-card { margin: 0; }
          .image-card img { height: 140px; }
          .image-card figcaption,
          .file-label {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            word-break: normal;
          }

          /* --- Una sola hoja A4 --- */
          @page { size: A4; margin: 10mm; }
          html, body { margin: 0; padding: 0; }
          .print-shell { width: 190mm; max-width: 190mm; margin: 0 auto; }
          .print-header { margin-bottom: 10px; padding-bottom: 10px; }
          .print-logo { width: 90px; }
          .patient-title { font-size: 26px; }
          .sidebar { margin-bottom: 10px; gap: 10px; }
          .sidebar-card { padding: 10px 14px; }
          .sidebar-card:first-child .field,
          .sidebar-card:first-child .field:last-child { margin-bottom: 4px; padding-bottom: 4px; }
          .session-card { margin-bottom: 8px; break-inside: avoid; }
          .session-card__body h2 { font-size: 18px; margin: 6px 0; }
          .evolution-block { font-size: 12px; line-height: 1.45; }
          .session-card__header { padding: 6px 18px; }
          .session-date { padding: 4px 12px; font-size: 11px; }
          .session-card__body { padding: 12px 18px; }
          .signature { margin-top: 8px; padding-top: 6px; }

          @media print {
            body { padding: 0; }
            .print-shell { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-shell">
          <header class="print-header">
            <div class="print-header__text">
              <div class="eyebrow">Kareh · Historia Clínica</div>
              <div class="record-badge">${patientSummary.recordNumber}</div>
              <h1 class="patient-title">${patientSummary.fullName}</h1>
            </div>
            <img class="print-logo" src="${window.location.origin}/kareh-login-logo.png" alt="Kareh" />
          </header>

          <div class="layout">
            <aside class="sidebar">
              <section class="sidebar-card">
                <h2 class="sidebar-title">Ficha Base</h2>
                <div class="field">
                  <div class="field-label">Historia Clínica</div>
                  <div class="field-value">${patientSummary.recordNumber}</div>
                </div>
                <div class="field">
                  <div class="field-label">DNI</div>
                  <div class="field-value">${patientSummary.dni}</div>
                </div>
                <div class="field">
                  <div class="field-label">Fecha Nacimiento</div>
                  <div class="field-value">${patientSummary.birthDate}</div>
                </div>
                <div class="field">
                  <div class="field-label">Edad</div>
                  <div class="field-value"><span class="age-badge">${patientSummary.age}</span></div>
                </div>
                <div class="field">
                  <div class="field-label">OS</div>
                  <div class="field-value ${patientSummary.coverageClass}">${patientSummary.coverage}</div>
                </div>
                <div class="field">
                  <div class="field-label">N° Afiliado</div>
                  <div class="field-value">${patientSummary.affiliateNumber}</div>
                </div>
                <div class="field">
                  <div class="field-label">Folio</div>
                  <div class="field-value">${patientSummary.folio}</div>
                </div>
                <div class="field">
                  <div class="field-label">Teléfono</div>
                  <div class="field-value">${patientSummary.phone}</div>
                </div>
                <div class="field">
                  <div class="field-label">Domicilio</div>
                  <div class="field-value">${patientSummary.address}</div>
                </div>
              </section>

              <section class="sidebar-card risk-card">
                <h2 class="sidebar-title" style="color:#d97706;">Antecedentes</h2>
                <div class="risk-list">
                  ${patientSummary.risks.map((risk) => `
                    <div class="risk-item">
                      <span>${risk.label}</span>
                      <span class="risk-check ${risk.active ? 'active' : ''}">✓</span>
                    </div>
                  `).join('')}
                </div>
              </section>
            </aside>

            <main class="sessions">
              ${entryMarkup}
            </main>
          </div>
        </div>

        <script>
          const imagePromises = Array.from(document.images).map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          });

          // Si el contenido no entra en una hoja A4 (277 mm útiles), se achica todo
          // proporcionalmente para que salga en una sola hoja. Mínimo 50% para que siga
          // siendo legible: si ni así entra, se imprime en más hojas.
          const fitToOnePage = () => {
            const shell = document.querySelector('.print-shell');
            if (!shell) return;
            shell.style.zoom = '';
            const mmToPx = 96 / 25.4;
            const pageHeight = 277 * mmToPx - 4;
            // Al achicar, el texto se reacomoda: se repite hasta que entre (margen del 3%).
            let zoom = 1;
            for (let attempt = 0; attempt < 6; attempt += 1) {
              const height = shell.getBoundingClientRect().height;
              if (height <= pageHeight) break;
              zoom = Math.max(0.5, zoom * (pageHeight / height) * 0.97);
              shell.style.zoom = String(zoom);
              if (zoom === 0.5) break;
            }
          };

          Promise.all(imagePromises).then(() => {
            fitToOnePage();
            setTimeout(() => {
              window.focus();
              window.print();
            }, 150);
          });

          window.onafterprint = () => {
            window.close();
          };
        </script>
      </body>
    </html>
  `;
};
