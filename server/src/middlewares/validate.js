export const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      message: 'Datos inválidos',
      details: error.details.map((detail) => detail.message),
    });
  }

  req.body = value;
  return next();
};
