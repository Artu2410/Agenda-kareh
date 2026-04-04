import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

const createInitialState = () => ({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  danger: false,
  icon: AlertCircle,
  onConfirm: null,
  onCancel: null,
  isLoading: false,
});

export const useConfirmModal = () => {
  const [state, setState] = React.useState(createInitialState);

  const openModal = React.useCallback((config) => {
    setState({
      ...createInitialState(),
      isOpen: true,
      ...config,
    });
  }, []);

  const closeModal = React.useCallback(() => {
    setState((previous) => ({
      ...previous,
      isOpen: false,
      isLoading: false,
    }));
  }, []);

  const setLoading = React.useCallback((isLoading) => {
    setState((previous) => ({
      ...previous,
      isLoading,
    }));
  }, []);

  const handleConfirm = React.useCallback(async () => {
    setLoading(true);

    try {
      await state.onConfirm?.();
    } finally {
      closeModal();
    }
  }, [closeModal, setLoading, state]);

  const handleCancel = React.useCallback(() => {
    state.onCancel?.();
    closeModal();
  }, [closeModal, state]);

  const ConfirmModalComponent = React.useMemo(() => React.createElement(ConfirmModal, {
    ...state,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  }), [handleCancel, handleConfirm, state]);

  return {
    ConfirmModalComponent,
    openModal,
    closeModal,
    setLoading,
  };
};

export default useConfirmModal;
