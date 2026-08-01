const SEGMENTS = ['params', 'query', 'body'];

const formatPath = (segment, path = []) => {
  if (!Array.isArray(path) || path.length === 0) {
    return segment;
  }

  const suffix = path.reduce((result, part) => (
    typeof part === 'number'
      ? `${result}[${part}]`
      : `${result}.${part}`
  ), '');

  return `${segment}${suffix}`;
};

const normalizeIssueMessage = (issue) => {
  if (issue?.code === 'invalid_type') {
    return 'Tipo de dato inválido';
  }

  if (issue?.code === 'invalid_value') {
    return 'Valor inválido';
  }

  return issue?.message || 'Valor inválido';
};

const isZodSchema = (value) => Boolean(value?.safeParse);

export const validate = (schema = {}) => {
  const normalizedSchema = isZodSchema(schema) ? { body: schema } : (schema || {});

  return (req, res, next) => {
    const parsedSegments = {};
    const errors = [];

    SEGMENTS.forEach((segment) => {
      const segmentSchema = normalizedSchema[segment];
      if (!segmentSchema) {
        return;
      }

      const result = segmentSchema.safeParse(req[segment] ?? {});
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          errors.push({
            path: formatPath(segment, issue.path),
            message: normalizeIssueMessage(issue),
          });
        });
        return;
      }

      parsedSegments[segment] = result.data;
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    Object.assign(req, parsedSegments);
    return next();
  };
};

export const validateBody = (bodySchema) => validate({ body: bodySchema });
export const validateParams = (paramsSchema) => validate({ params: paramsSchema });
export const validateQuery = (querySchema) => validate({ query: querySchema });
