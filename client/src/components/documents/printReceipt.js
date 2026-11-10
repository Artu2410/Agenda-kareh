import { showErrorToast } from '../toastHelpers';
import { buildPatientReceiptHtml } from '../../utils/documents/patientReceiptHtml';
import { openPrintWindow } from '../../utils/documents/printDocument';

/** Abre el comprobante listo para imprimir (también sirve para reimprimir). */
export const printPatientReceipt = (receipt) => {
  if (!openPrintWindow(buildPatientReceiptHtml(receipt))) {
    showErrorToast('El navegador bloqueó la ventana del comprobante. Permití ventanas emergentes para este sitio.');
    return false;
  }
  return true;
};
