import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  Loader, 
  CheckCircle, 
  AlertCircle,
  ArrowRight 
} from 'lucide-react';
import { showErrorToast, showSuccessToast, showLoadingToast } from '../components/Toast';
import instance from '../api/axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function LoginPage() {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(null);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      showErrorToast('Por favor ingresa tu email');
      return;
    }

    try {
      setLoading(true);
      showLoadingToast('Verificando email...');

      const response = await instance.post(
        `/auth/request-otp`,
        { email: email.trim() }
      );

      if (response.status === 200) {
        showSuccessToast('✅ Código enviado a tu email');
        setStep('otp');
        setOtpExpiry(Date.now() + 15 * 60 * 1000); // 15 minutos
        setOtp('');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Error al solicitar código';
      const errorDetail = err.response?.data?.detail || '';
      const displayMsg = errorDetail ? `${errorMsg}\n\n${errorDetail}` : errorMsg;
      
      setError(errorMsg);
      showErrorToast(`❌ ${displayMsg}`);
      
      // Log detallado para debugging
      console.error('Error en requestOTP:', {
        status: err.response?.status,
        message: errorMsg,
        detail: errorDetail,
        fullError: err.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      showErrorToast('Por favor ingresa el código');
      return;
    }

    if (otp.length !== 6) {
      showErrorToast('El código debe tener 6 dígitos');
      return;
    }

    try {
      setLoading(true);
      showLoadingToast('Verificando código...');

      const response = await instance.post(
        `/auth/verify-otp`,
        { email: email.trim(), otp: otp.trim() }
      );

      if (response.status === 200 && response.data.token) {
        // Guardar token en localStorage
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('userEmail', response.data.user.email);
        localStorage.setItem('userName', response.data.user.name);

        showSuccessToast('✅ ¡Acceso Concedido!');
        
        // Redirigir al dashboard
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Error al verificar código';
      const attemptsRemaining = err.response?.data?.attemptsRemaining;

      if (attemptsRemaining !== undefined) {
        setError(`${errorMsg} (${attemptsRemaining} intentos restantes)`);
      } else {
        setError(errorMsg);
      }
      
      showErrorToast(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtp('');
    await handleRequestOTP({ preventDefault: () => {} });
  };

  // Timer para mostrar tiempo restante
  const getTimeRemaining = () => {
    if (!otpExpiry) return null;
    const remaining = Math.ceil((otpExpiry - Date.now()) / 1000);
    if (remaining <= 0) return null;
    return Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Card con glassmorphism */}
        <div className="backdrop-blur-xl bg-white/95 rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 mb-4">
              <span className="text-2xl">🏥</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Kareh Salud</h1>
            <p className="text-slate-600 mt-2">Centro de Kinesiología</p>
          </motion.div>

          {/* Email Step */}
          {step === 'email' && (
            <motion.form
              key="email-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleRequestOTP}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  📧 Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-teal-600" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="centrokareh@gmail.com"
                    className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  ℹ️ Ingresa tu correo para recibir el código de acceso
                </p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2"
                >
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg hover:shadow-teal-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Enviar Código
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </motion.form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <motion.div
              key="otp-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Confirmación de email */}
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-3">
                <CheckCircle size={20} className="text-teal-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-teal-900">Email Confirmado</p>
                  <p className="text-xs text-teal-700">{email}</p>
                </div>
              </div>

              {/* Campo OTP */}
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    🔐 Código de Verificación
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-teal-600" size={20} />
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength="6"
                      className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all text-center text-2xl font-mono tracking-widest text-slate-900 placeholder:text-slate-400"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    ⏱️ Válido por {timeRemaining || 'expirado'}
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2"
                  >
                    <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || !timeRemaining}
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg hover:shadow-teal-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Acceder
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>

              {/* Botón para reenviar */}
              <button
                onClick={handleResendOTP}
                disabled={loading}
                className="w-full text-teal-600 hover:text-teal-700 font-semibold py-2 rounded-lg hover:bg-teal-50 transition-all disabled:opacity-50"
              >
                🔄 Reenviar Código
              </button>

              {/* Volver atrás */}
              <button
                onClick={() => {
                  setStep('email');
                  setError('');
                  setOtp('');
                }}
                disabled={loading}
                className="w-full text-slate-600 hover:text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50 transition-all"
              >
                ← Cambiar Email
              </button>
            </motion.div>
          )}

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 pt-6 border-t border-slate-200 text-center"
          >
            <p className="text-xs text-slate-500">
              🔒 Tu seguridad es nuestra prioridad. Autenticación segura habilitada.
            </p>
          </motion.div>
        </div>

        {/* Indicador de paso */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 flex justify-center gap-2"
        >
          <div
            className={`h-2 w-8 rounded-full transition-all ${
              step === 'email' ? 'bg-teal-600' : 'bg-slate-300'
            }`}
          />
          <div
            className={`h-2 w-8 rounded-full transition-all ${
              step === 'otp' ? 'bg-teal-600' : 'bg-slate-300'
            }`}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
