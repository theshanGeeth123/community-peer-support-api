import cloudinary from "../config/cloudinary.js";

export const uploadProfileImageToCloudinary = (
  buffer
) => {
  return new Promise(
    (resolve, reject) => {
      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            folder:
              "community-peer-support/profile-pictures",

            resource_type: "image",

            unique_filename: true,

            overwrite: false,

            transformation: [
              {
                width: 800,
                height: 800,
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

            if (
              !result?.secure_url ||
              !result?.public_id
            ) {
              reject(
                new Error(
                  "Cloudinary did not return the expected upload information."
                )
              );

              return;
            }

            resolve({
              secureUrl:
                result.secure_url,

              publicId:
                result.public_id,
            });
          }
        );

      uploadStream.end(buffer);
    }
  );
};

export const deleteProfileImageFromCloudinary =
  async (publicId) => {
    if (!publicId) {
      return;
    }

    await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: "image",
        invalidate: true,
      }
    );
  };