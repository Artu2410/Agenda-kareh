import csrf from 'csurf';

const isProduction = () => process.env.NODE_ENV === 'production';

export const csrfProtection = csrf({
  cookie: {
    key: 'csrf_secret',
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'None' : 'Lax',
    path: '/',
  },
});

export const getCsrfToken = (req, res) => {
  return res.json({ token: req.csrfToken() });
};
