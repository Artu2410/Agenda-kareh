import React from 'react';
import toast, { ToastBar, Toaster } from 'react-hot-toast';
import { X } from 'lucide-react';

export const CustomToaster = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={12}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#ffffff',
          color: '#1e293b',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          borderRadius: '1.5rem',
          padding: '1rem 1.5rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          border: '1px solid #e2e8f0',
          backdropFilter: 'blur(10px)',
        },
        success: {
          style: {
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            color: '#065f46',
            borderColor: '#6ee7b7',
          },
          duration: 3000,
        },
        error: {
          style: {
            background: 'linear-gradient(135deg, #fef2f2 0%, #fef5f5 100%)',
            color: '#7f1d1d',
            borderColor: '#fca5a5',
          },
          duration: 4000,
        },
        loading: {
          style: {
            background: 'linear-gradient(135deg, #f0f9ff 0%, #f0fdf4 100%)',
            color: '#0c4a6e',
            borderColor: '#7dd3fc',
          },
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <div className="flex items-center gap-3 w-full">
              <div className="flex-shrink-0">{icon}</div>
              <div className="flex-1">{message}</div>
              {t.type !== 'loading' && (
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
};

// Funciones de notificación con estilos predefinidos
export const showSuccessToast = (message, duration = 3000) => {
  toast.success(message, { duration });
};

export const showErrorToast = (message, duration = 4000) => {
  toast.error(message, { duration });
};

export const showLoadingToast = (message, id = 'loading') => {
  toast.loading(message, { id });
};

export const updateToast = (id, message, type = 'success') => {
  toast.dismiss(id);
  if (type === 'success') {
    toast.success(message);
  } else if (type === 'error') {
    toast.error(message);
  }
};
