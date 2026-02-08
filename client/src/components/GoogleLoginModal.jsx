import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Modal } from './Modal';
import { motion } from 'framer-motion';
import { AlertCircle, LogIn } from 'lucide-react';
import { showErrorToast, showSuccessToast } from './Toast';

export const GoogleLoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [error, setError] = useState(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const isDevelopmentMode = clientId === 'tu_client_id_aqui' || !clientId;

  const handleDevModeLogi = async () => {
    try {
      // En modo desarrollo, crear un token JWT local sin validar Google OAuth
      const mockToken = 'dev_token_' + Date.now();
      localStorage.setItem('auth_token', mockToken);
      localStorage.setItem('userName', 'Usuario Demo');
      localStorage.setItem('userEmail', 'demo@example.com');
      showSuccessToast('✅ Acceso en modo desarrollo');
      onSuccess();
      onClose();
    } catch (err) {
      showErrorToast('Error en acceso rápido');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/google-callback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: credentialResponse.credential,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError(
            '❌ Acceso Denegado. Solo centrokareh@gmail.com puede acceder.'
          );
          showErrorToast('❌ Email no autorizado');
        } else {
          setError('Error en la autenticación. Intenta de nuevo.');
          showErrorToast('Error en la autenticación');
        }
        return;
      }

      // Guardar token y datos en localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('userName', data.userName || 'Usuario');
      localStorage.setItem('userEmail', data.userEmail || '');

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error en Google Login:', err);
      setError('Error de conexión. Intenta de nuevo.');
      showErrorToast('Error de conexión');
    }
  };

  const handleGoogleError = () => {
    setError('Error al iniciar sesión con Google.');
    showErrorToast('Error con Google Sign-In');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Acceder a Kareh Salud">
      <div className="space-y-6">
        {/* Bienvenida */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <p className="text-slate-600 text-sm leading-relaxed">
            Inicia sesión con tu cuenta de Google para acceder al sistema.
          </p>
          <p className="text-xs text-slate-500">
            Usa: <span className="font-semibold text-teal-600">centrokareh@gmail.com</span>
          </p>
        </motion.div>

        {/* Google Login Button o Modo Desarrollo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-3 justify-center"
        >
          {!isDevelopmentMode && (
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
          )}

          {isDevelopmentMode && (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-800 font-semibold">⚠️ Modo Desarrollo</p>
                <p className="text-xs text-amber-700 mt-1">
                  Google OAuth no está configurado. Usa el botón abajo para entrar en modo demo.
                </p>
              </div>
              <button
                onClick={handleDevModeLogi}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-teal-500/30 transition-all"
              >
                <LogIn size={18} /> Acceso Rápido (Desarrollo)
              </button>
            </div>
          )}
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start"
          >
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}

        {/* Info */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            🔒 Tu información está protegida. Usamos OAuth 2.0 de Google.
          </p>
        </div>
      </div>
    </Modal>
  );
};

