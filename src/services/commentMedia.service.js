import cloudinary from "../config/cloudinary.js";

const COMMENT_MEDIA_FOLDER =
  "community-peer-support/comment-media";

/**
 * Uploads comment photo or video to Cloudinary.
 *
 * @param {Buffer} buffer
 * @param {"image" | "video"} mediaType
 * @returns {Promise<{ secureUrl: string, publicId: string, resourceType: string }>}
 */
export const uploadCommentMediaToCloudinary = (
  buffer,
  mediaType
) => {
  return new Promise((resolve, reject) => {
    if (!buffer) {
      return reject(new Error("Media buffer is required."));
    }

    if (!["image", "video"].includes(mediaType)) {
      return reject(
        new Error("Comment media must be an image or video.")
      );
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: COMMENT_MEDIA_FOLDER,
        resource_type: mediaType,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(
            new Error(
              "Cloudinary did not return the expected upload information."
            )
          );
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Deletes comment photo/video from Cloudinary.
 *
 * @param {string} publicId
 * @param {"image" | "video"} mediaType
 */
export const deleteCommentMediaFromCloudinary = async (
  publicId,
  mediaType
) => {
  if (!publicId) {
    return;
  }

  if (!["image", "video"].includes(mediaType)) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: mediaType,
    });
  } catch (error) {
    console.error(
      "Failed to delete comment media from Cloudinary:",
      error
    );
  }
};