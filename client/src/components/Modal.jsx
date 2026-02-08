import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  canClose = true,
}) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
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
      scale: 0.95,
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
            onClick={() => canClose && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal con glassmorphism */}
          <motion.div
            className={`relative w-full ${sizeClasses[size]} mx-auto rounded-2xl shadow-2xl overflow-hidden bg-white/95 backdrop-blur-xl border border-white/20`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            {title && (
              <div className="px-6 sm:px-8 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-50/50 flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {title}
                </h2>
                {showCloseButton && canClose && (
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 hover:bg-slate-200/50 rounded-lg transition-colors text-slate-600"
                  >
                    <X size={20} />
                  </motion.button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="px-6 sm:px-8 py-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook para usar el modal fácilmente
export const useModal = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return {
    isOpen,
    openModal,
    closeModal,
  };
};
