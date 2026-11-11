import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { showErrorToast, showSuccessToast } from '../toastHelpers';
import { formatCurrencyAR } from '../../utils/documents/printDocument';

/**
 * Eliminar un comprobante no fiscal con confirmación.
 * Renderizar `ConfirmModalComponent` en el componente que lo use.
 */
export default function useDeleteReceipt(onDeleted) {
  const { ConfirmModalComponent, openModal } = useConfirmModal();

  const requestDelete = useCallback((receipt) => {
    openModal({
      title: 'Eliminar comprobante',
      message: `Se eliminará el comprobante N° ${receipt.displayNumber} de ${receipt.patientName} por ${formatCurrencyAR(receipt.amount)}. El número no se vuelve a usar: queda el hueco registrado en la auditoría.`,
      confirmText: 'Eliminar',
      danger: true,
      icon: Trash2,
      onConfirm: async () => {
        try {
          await api.delete(`/receipts/${receipt.id}`);
          showSuccessToast(`Comprobante ${receipt.displayNumber} eliminado`);
          onDeleted?.(receipt);
        } catch (error) {
          showErrorToast(error?.friendlyMessage || 'No se pudo eliminar el comprobante.');
        }
      },
    });
  }, [onDeleted, openModal]);

  return { ConfirmModalComponent, requestDelete };
}
