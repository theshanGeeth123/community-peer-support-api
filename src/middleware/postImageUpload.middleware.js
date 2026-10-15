import multer from "multer";

import AppError from "../utils/AppError.js";

const MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024;

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const multerUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_POST_IMAGE_SIZE,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new AppError("Only JPEG, PNG, and WebP images are allowed.", 415)
      );
    }

    return callback(null, true);
  },
});

/*
 * In multipart/form-data every field arrives as text, so turn the
 * fields back into the shapes the post validator expects.
 * contentWarnings may arrive as a JSON string, a single value, or
 * repeated fields.
 */
const normalizeMultipartPostBody = (body) => {
  if (typeof body.contentWarnings === "string") {
    const raw = body.contentWarnings.trim();

    if (raw.startsWith("[")) {
      try {
        body.contentWarnings = JSON.parse(raw);
      } catch {
        /*
         * Leave as-is; the validator reports it as invalid.
         */
      }
    } else {
      body.contentWarnings = raw ? [raw] : [];
    }
  }
};

/**
 * Optional single image upload for creating a post.
 * JSON requests (no image) pass straight through.
 * Form-data field name: "image".
 */
export const uploadPostImageFile = (req, res, next) => {
  if (!req.is("multipart/form-data")) {
    return next();
  }

  multerUpload.single("image")(req, res, (error) => {
    if (!error) {
      normalizeMultipartPostBody(req.body);
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("Image must be 5 MB or smaller.", 413));
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new AppError(
            'Upload one image using the form-data field name "image".',
            400
          )
        );
      }

      return next(
        new AppError("The image upload could not be processed.", 400)
      );
    }

    return next(error);
  });
};
