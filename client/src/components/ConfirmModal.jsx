import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Trash2, LogOut, Check, X } from 'lucide-react';

export const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
  icon = AlertCircle,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const IconComponent = icon;

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.9,
      y: 20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 300,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transition: {
        duration: 0.2,
      },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Fondo oscuro con blur glassmorphism */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal con glassmorphism */}
          <motion.div
            className={`relative w-full max-w-sm mx-auto rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl border border-white/20 ${
              danger
                ? 'bg-red-50/95'
                : 'bg-white/95'
            }`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header con gradiente */}
            <div
              className={`px-6 py-4 flex items-center gap-3 border-b ${
                danger
                  ? 'bg-gradient-to-r from-red-100/80 to-red-50/50 border-red-200'
                  : 'bg-gradient-to-r from-slate-100/80 to-slate-50/50 border-slate-200'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  danger
                    ? 'bg-red-100/60 text-red-600'
                    : 'bg-slate-200/60 text-slate-600'
                }`}
              >
                <IconComponent size={20} />
              </div>
              <h2
                className={`text-lg font-bold ${
                  danger ? 'text-red-900' : 'text-slate-900'
                }`}
              >
                {title}
              </h2>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
            </div>

            {/* Footer con botones */}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                  isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-slate-200/50 active:scale-95'
                } text-slate-700 bg-slate-100`}
              >
                {cancelText}
              </button>
              <motion.button
                onClick={onConfirm}
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 text-white ${
                  danger
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg hover:shadow-red-500/30'
                    : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:shadow-lg hover:shadow-teal-500/30'
                } ${isLoading ? 'opacity-75 cursor-not-allowed' : 'active:scale-95'}`}
              >
                {isLoading && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-4 h-4"
                  >
                    ⏳
                  </motion.div>
                )}
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook personalizado para usar el modal
export const useConfirmModal = () => {
  const [state, setState] = React.useState({
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

  const openModal = (config) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      ...config,
    }));
  };

  const closeModal = () => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const setLoading = (isLoading) => {
    setState((prev) => ({
      ...prev,
      isLoading,
    }));
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (state.onConfirm) {
        await state.onConfirm();
      }
    } finally {
      setLoading(false);
      closeModal();
    }
  };

  const handleCancel = () => {
    if (state.onCancel) {
      state.onCancel();
    }
    closeModal();
  };

  return {
    ConfirmModalComponent: (
      <ConfirmModal
        {...state}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    openModal,
    closeModal,
    setLoading,
  };
};
