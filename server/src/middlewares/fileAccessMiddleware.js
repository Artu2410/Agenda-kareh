export const createFileAccessMiddleware = ({ handler, authMiddleware }) => (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return handler(req, res, next);
  }

  return authMiddleware(req, res, () => handler(req, res, next));
};
