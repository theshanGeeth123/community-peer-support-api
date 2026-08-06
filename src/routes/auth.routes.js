import express from "express";

import { registerUser } from "../controllers/auth.controller.js";
import validateRequest from "../middleware/validate.middleware.js";
import { registerValidator } from "../validators/auth.validator.js";

const router = express.Router();

router.post(
  "/register",
  registerValidator,
  validateRequest,
  registerUser
);

export default router;