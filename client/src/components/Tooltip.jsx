import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Tooltip = ({ children, content, position = 'top', delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full mb-3 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-3 left-1/2 -translate-x-1/2',
    left: 'right-full mr-3 top-1/2 -translate-y-1/2',
    right: 'left-full ml-3 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full border-t-slate-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom:
      'bottom-full border-b-slate-700 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full border-l-slate-700 border-t-transparent border-b-transparent border-r-transparent',
    right:
      'right-full border-r-slate-700 border-t-transparent border-b-transparent border-l-transparent',
  };

  const originClasses = {
    top: 'origin-bottom',
    bottom: 'origin-top',
    left: 'origin-right',
    right: 'origin-left',
  };

  const variants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      pointerEvents: 'none',
    },
    visible: {
      opacity: 1,
      scale: 1,
      pointerEvents: 'auto',
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 300,
        delay,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      transition: {
        duration: 0.15,
      },
    },
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onTouchStart={() => setIsVisible(true)}
      onTouchEnd={() => setIsVisible(false)}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`absolute ${positionClasses[position]} ${originClasses[position]} z-50`}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Contenido del tooltip */}
            <div className="px-3 py-2 bg-slate-700 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-lg backdrop-blur-sm">
              {content}
              {/* Flecha */}
              <div
                className={`absolute w-0 h-0 border-4 ${arrowClasses[position]} -mx-4`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Tooltip específico para iconos de alertas médicas
export const MedicalAlertTooltip = ({ icon: Icon, alert, message }) => {
  return (
    <Tooltip content={message} position="top" delay={0.1}>
      <div
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg cursor-help transition-all duration-200 ${
          alert === 'oncologico'
            ? 'bg-purple-100 text-purple-600 hover:bg-purple-200 hover:shadow-lg hover:shadow-purple-300/30'
            : alert === 'marcapasos'
              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:shadow-lg hover:shadow-blue-300/30'
              : 'bg-orange-100 text-orange-600 hover:bg-orange-200 hover:shadow-lg hover:shadow-orange-300/30'
        }`}
      >
        <Icon size={18} />
      </div>
    </Tooltip>
  );
};
