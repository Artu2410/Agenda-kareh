import csrf from 'csurf';
import { getCookieSameSite, shouldUseSecureCookies } from '../utils/auth.js';

export const csrfProtection = csrf({
  cookie: {
    key: 'csrf_secret',
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: getCookieSameSite(),
    path: '/',
  },
});

export const getCsrfToken = (req, res) => {
  return res.json({ token: req.csrfToken() });
};
