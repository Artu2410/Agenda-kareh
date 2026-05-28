import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../tests/msw/server';
import { getApiUrl } from '../services/apiBase';
import LoginPage from './LoginPage';
import * as authStore from '../stores/auth';
import { APP_ROUTES } from '../utils/appRoutes';

const navigateMock = vi.hoisted(() => vi.fn());
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    form: ({ children, ...props }) => <form {...props}>{children}</form>,
  },
}));

vi.mock('../components/toastHelpers', () => ({
  showErrorToast: toastMocks.error,
  showLoadingToast: toastMocks.loading,
  showSuccessToast: toastMocks.success,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    authStore.clearAuth();
    localStorage.clear();
    sessionStorage.clear();
    navigateMock.mockReset();
    toastMocks.error.mockReset();
    toastMocks.loading.mockReset();
    toastMocks.success.mockReset();
  });

  it('envía OTP, verifica y navega al dashboard', async () => {
    server.use(
      http.post(getApiUrl('/auth/request-otp'), () => HttpResponse.json({
        success: true,
        devOtp: '123456',
      }, { status: 200 })),
      http.post(getApiUrl('/auth/verify-otp'), async ({ request }) => {
        const payload = await request.json();
        expect(payload).toEqual({ email: 'admin@kareh.com', otp: '123456' });

        return HttpResponse.json({
          success: true,
          user: {
            id: 'user-1',
            email: 'admin@kareh.com',
            name: 'Admin',
            role: 'ADMIN',
          },
        }, { status: 200 });
      })
    );

    const onLoginSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onLoginSuccess} />);

    fireEvent.change(screen.getByPlaceholderText('centrokareh@gmail.com'), {
      target: { value: 'admin@kareh.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar código/i }));

    await waitFor(() => expect(toastMocks.loading).toHaveBeenCalledWith('Verificando email...'));
    await waitFor(() => expect(screen.getByRole('button', { name: /acceder/i })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /acceder/i }));

    await waitFor(() => expect(toastMocks.loading).toHaveBeenCalledWith('Verificando código...'));
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(APP_ROUTES.dashboard, { replace: true }), { timeout: 3000 });

    expect(localStorage.getItem('userEmail')).toBe('admin@kareh.com');
    expect(authStore.getAccessToken()).toBeNull();
    expect(toastMocks.success).toHaveBeenCalledWith('✅ ¡Acceso Concedido!');
  });

  it('muestra error cuando request OTP falla', async () => {
    server.use(
      http.post(getApiUrl('/auth/request-otp'), () => HttpResponse.json({
        message: 'Credenciales inválidas',
      }, { status: 401 }))
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('centrokareh@gmail.com'), {
      target: { value: 'admin@kareh.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar código/i }));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith('❌ Credenciales inválidas'));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
