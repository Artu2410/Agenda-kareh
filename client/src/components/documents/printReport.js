import { showErrorToast } from '../toastHelpers';
import { buildKinesicReportHtml } from '../../utils/documents/kinesicReportHtml';
import { openPrintWindow } from '../../utils/documents/printDocument';

/** Reimprime un informe guardado exactamente como se emitió. */
export const reprintReport = (report) => {
  if (!report?.data || !openPrintWindow(buildKinesicReportHtml(report.data))) {
    showErrorToast('El navegador bloqueó la ventana del informe. Permití ventanas emergentes para este sitio.');
    return false;
  }
  return true;
};
