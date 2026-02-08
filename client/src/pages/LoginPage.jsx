import React, { useState, useEffect } from 'react';
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

// ✅ IMPORTACIÓN CORREGIDA: Usamos las funciones de tu api.js
import { requestOTP, verifyOTP } from '../services/api'; 

export default function LoginPage() {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpExpiry, setOtpExpiry] = useState(null);

  // Efecto para actualizar el contador visualmente cada segundo
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (step === 'otp') {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleRequestOTP = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');

    if (!email.trim()) {
      showErrorToast('Por favor ingresa tu email');
      return;
    }

    try {
      setLoading(true);
      showLoadingToast('Verificando email...');

      // ✅ CAMBIO: Usamos la función del servicio
      const response = await requestOTP(email.trim());

      if (response.data.success) {
        showSuccessToast('✅ Código enviado a tu email');
        setStep('otp');
        setOtpExpiry(Date.now() + 15 * 60 * 1000); 
        setOtp('');
      }
    } catch (err) {
      // ✅ CAMBIO: Usamos el friendlyMessage de nuestro interceptor
      const errorMsg = err.friendlyMessage || 'Error al solicitar código';
      setError(errorMsg);
      showErrorToast(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp.trim() || otp.length !== 6) {
      showErrorToast('El código debe tener 6 dígitos');
      return;
    }

    try {
      setLoading(true);
      showLoadingToast('Verificando código...');

      // ✅ CAMBIO: Usamos la función del servicio
      const response = await verifyOTP(email.trim(), otp.trim());

      if (response.data.token) {
        // Guardar sesión
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('userEmail', response.data.user.email);
        
        showSuccessToast('✅ ¡Acceso Concedido!');
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      }
    } catch (err) {
      const errorMsg = err.friendlyMessage || 'Error al verificar código';
      setError(errorMsg);
      showErrorToast(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!otpExpiry) return null;
    const remaining = Math.ceil((otpExpiry - now) / 1000);
    if (remaining <= 0) return null;
    return Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md"
      >
        <div className="backdrop-blur-xl bg-white/95 rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 mb-4 shadow-lg">
              <span className="text-2xl">🏥</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Kareh Salud</h1>
            <p className="text-slate-600 mt-2 font-medium">Centro de Kinesiología</p>
          </div>

          {step === 'email' ? (
            <motion.form
              key="email-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleRequestOTP}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">📧 Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 text-teal-600" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="centrokareh@gmail.com"
                    className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.includes('@')}
                className="w-full bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition-all shadow-md flex items-center justify-center gap-2"
              >
                {loading ? <Loader size={20} className="animate-spin" /> : <>Enviar Código <ArrowRight size={18}/></>}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="otp-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg flex items-center gap-3">
                <CheckCircle size={18} className="text-teal-600" />
                <span className="text-sm text-teal-800 font-medium">Enviado a {email}</span>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 text-teal-600" size={20} />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-slate-200 text-center text-2xl font-mono tracking-widest focus:border-teal-500 outline-none"
                    disabled={loading}
                  />
                </div>
                
                <p className="text-center text-xs text-slate-500">
                   {timeRemaining ? `Válido por ${timeRemaining}` : 'Código expirado'}
                </p>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || !timeRemaining}
                  className="w-full bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader size={20} className="animate-spin" /> : 'Acceder'}
                </button>
              </form>

              <div className="flex flex-col gap-2">
                <button onClick={() => handleRequestOTP()} className="text-teal-600 text-sm font-semibold hover:underline">Reenviar código</button>
                <button onClick={() => setStep('email')} className="text-slate-500 text-sm hover:underline">Cambiar correo</button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}