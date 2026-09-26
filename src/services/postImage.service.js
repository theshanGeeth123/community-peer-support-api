import cloudinary from "../config/cloudinary.js";

const POST_IMAGE_FOLDER = "community-peer-support/post-images";

/**
 * Uploads a post image buffer to Cloudinary.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ secureUrl: string, publicId: string }>}
 */
export const uploadPostImageToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: POST_IMAGE_FOLDER,
        resource_type: "image",
        unique_filename: true,
        overwrite: false,

        /*
         * Keeps feeds fast: never wider/taller than 1600px,
         * automatic quality.
         */
        transformation: [
          {
            width: 1600,
            height: 1600,
            crop: "limit",
            quality: "auto:good",
          },
        ],
      },

      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url || !result?.public_id) {
          reject(
            new Error(
              "Cloudinary did not return the expected upload information."
            )
          );
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Removes a post image from Cloudinary. Never throws — a leftover
 * image must not stop a post from being deleted.
 */
export const deletePostImageFromCloudinary = async (publicId) => {
  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (error) {
    console.error(
      "[post images] Failed to delete image from Cloudinary:",
      error?.message ?? error
    );
  }
};
