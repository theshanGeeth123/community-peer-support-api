import { validationResult } from "express-validator";

import AppError from "../utils/AppError.js";

const validateRequest = (req, res, next) => {
  const validationErrors = validationResult(req);

  if (validationErrors.isEmpty()) {
    return next();
  }

  const details = validationErrors.array().map((error) => ({
    field: error.path,
    message: error.msg,
  }));

  return next(
    new AppError("Request validation failed", 422, details)
  );
};

export default validateRequest;