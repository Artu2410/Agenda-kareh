import { AppError, ConflictError, ValidationError, NotFoundError } from '../errors/AppError.js';

const errorHandler = (err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  } else if (err instanceof ConflictError) {
    return res.status(409).json({
      status: 'fail',
      message: err.message,
    });
  } else if (err instanceof NotFoundError) {
    return res.status(404).json({
      status: 'fail',
      message: err.message,
    });
  } else if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Catch-all for unexpected errors
    console.error('UNEXPECTED ERROR:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
};

export default errorHandler;
