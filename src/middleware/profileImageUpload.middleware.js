import multer from "multer";

import AppError from "../utils/AppError.js";

const MAX_PROFILE_IMAGE_SIZE =
  5 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const multerUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_PROFILE_IMAGE_SIZE,
    files: 1,
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {
    if (
      !allowedMimeTypes.has(
        file.mimetype
      )
    ) {
      return callback(
        new AppError(
          "Only JPEG, PNG, and WebP profile images are allowed.",
          415
        )
      );
    }

    return callback(null, true);
  },
});

export const uploadProfileImageFile = (
  req,
  res,
  next
) => {
  multerUpload.single("avatar")(
    req,
    res,
    (error) => {
      if (!error) {
        return next();
      }

      if (
        error instanceof
        multer.MulterError
      ) {
        if (
          error.code ===
          "LIMIT_FILE_SIZE"
        ) {
          return next(
            new AppError(
              "Profile image must be 5 MB or smaller.",
              413
            )
          );
        }

        if (
          error.code ===
          "LIMIT_UNEXPECTED_FILE"
        ) {
          return next(
            new AppError(
              'Upload the profile image using the form-data field name "avatar".',
              400
            )
          );
        }

        return next(
          new AppError(
            "The profile image upload could not be processed.",
            400
          )
        );
      }

      return next(error);
    }
  );
};