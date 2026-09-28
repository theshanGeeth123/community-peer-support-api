import multer from "multer";

import AppError from "../utils/AppError.js";

/*
|--------------------------------------------------------------------------
| COMMENT MEDIA UPLOAD CONFIGURATION
|--------------------------------------------------------------------------
|
| Comments and replies can contain:
| - Photos
| - Videos
|
| Files are temporarily stored in memory.
| The controller uploads them to Cloudinary.
|
|--------------------------------------------------------------------------
*/

const MAX_COMMENT_MEDIA_SIZE =
  50 * 1024 * 1024; // 50 MB per file

const MAX_COMMENT_MEDIA_FILES = 10;

const allowedMimeTypes = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // Videos
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
]);

const multerUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_COMMENT_MEDIA_SIZE,
    files: MAX_COMMENT_MEDIA_FILES,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new AppError(
          "Only image and video files are allowed.",
          415
        )
      );
    }

    return callback(null, true);
  },
});

/*
|--------------------------------------------------------------------------
| COMMENT MEDIA UPLOAD MIDDLEWARE
|--------------------------------------------------------------------------
|
| React Native sends files using:
|
| FormData
|   media -> file
|
| Multiple files can use the same "media" field name.
|
|--------------------------------------------------------------------------
*/

export const uploadCommentMediaFiles = (
  req,
  res,
  next
) => {
  if (!req.is("multipart/form-data")) {
    return next();
  }

  multerUpload.array(
    "media",
    MAX_COMMENT_MEDIA_FILES
  )(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(
            "Each comment photo or video must be 50 MB or smaller.",
            413
          )
        );
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return next(
          new AppError(
            "You can upload up to 10 photos or videos per comment.",
            400
          )
        );
      }

      if (
        error.code ===
        "LIMIT_UNEXPECTED_FILE"
      ) {
        return next(
          new AppError(
            'Upload comment media using the form-data field name "media".',
            400
          )
        );
      }

      return next(
        new AppError(
          "The comment media upload could not be processed.",
          400
        )
      );
    }

    return next(error);
  });
};