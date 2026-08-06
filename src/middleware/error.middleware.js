import AppError from "../utils/AppError.js";

export const notFoundHandler = (req, res, next) => {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      404
    )
  );
};

export const globalErrorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "An unexpected server error occurred";
  let details = error.details || null;

  if (error.code === 11000) {
    statusCode = 409;

    const duplicatedField = Object.keys(error.keyValue || {})[0];

    message = duplicatedField
      ? `An account already exists with this ${duplicatedField}`
      : "A duplicate record already exists";
  }

  if (error.name === "ValidationError") {
    statusCode = 422;
    message = "Database validation failed";

    details = Object.values(error.errors).map((validationError) => ({
      field: validationError.path,
      message: validationError.message,
    }));
  }

  if (error.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${error.path}`;
  }

  const response = {
    success: false,
    message,
  };

  if (details) {
    response.errors = details;
  }

  if (process.env.NODE_ENV === "development") {
    response.debug = {
      errorName: error.name,
      stack: error.stack,
    };
  }

  res.status(statusCode).json(response);
};