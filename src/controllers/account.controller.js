import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";

import {
  deleteProfileImageFromCloudinary,
  uploadProfileImageToCloudinary,
} from "../services/profileImage.service.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const updateCurrentUserProfile =
  asyncHandler(
    async (req, res) => {
      const {
        fullName,
        avatarUrl,
      } = req.body;

      const user = req.user;

      if (
        fullName !== undefined
      ) {
        user.fullName =
          fullName;
      }

      if (
        avatarUrl !== undefined
      ) {
        user.avatarUrl =
          avatarUrl === null
            ? null
            : avatarUrl.trim();
      }

      await user.save();

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Profile updated successfully.",

          data: {
            user:
              user.toSafeObject(),
          },
        });
    }
  );

export const uploadCurrentUserAvatar =
  asyncHandler(
    async (req, res) => {
      if (!req.file) {
        throw new AppError(
          'Please select a profile image and upload it using the form-data field name "avatar".',
          400
        );
      }

      const user =
        await User.findById(
          req.user._id
        ).select(
          "+avatarPublicId"
        );

      if (!user) {
        throw new AppError(
          "User account was not found",
          404
        );
      }

      let uploadedImage =
        null;

      try {
        uploadedImage =
          await uploadProfileImageToCloudinary(
            req.file.buffer
          );
      } catch (error) {
        if (
          process.env
            .NODE_ENV ===
          "development"
        ) {
          console.error(
            "Profile image upload failed:",
            error.message
          );
        }

        throw new AppError(
          "Profile image upload failed. Please try again.",
          502
        );
      }

      const previousAvatarPublicId =
        user.avatarPublicId;

      user.avatarUrl =
        uploadedImage.secureUrl;

      user.avatarPublicId =
        uploadedImage.publicId;

      try {
        await user.save();
      } catch (error) {
        try {
          await deleteProfileImageFromCloudinary(
            uploadedImage.publicId
          );
        } catch (
          cleanupError
        ) {
          console.warn(
            "Unable to clean up newly uploaded profile image after database save failure:",
            cleanupError.message
          );
        }

        throw error;
      }

      if (
        previousAvatarPublicId &&
        previousAvatarPublicId !==
          uploadedImage.publicId
      ) {
        try {
          await deleteProfileImageFromCloudinary(
            previousAvatarPublicId
          );
        } catch (error) {
          console.warn(
            "Unable to remove previous profile image from Cloudinary:",
            error.message
          );
        }
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Profile picture updated successfully.",

          data: {
            user:
              user.toSafeObject(),
          },
        });
    }
  );

export const removeCurrentUserAvatar =
  asyncHandler(
    async (req, res) => {
      const user =
        await User.findById(
          req.user._id
        ).select(
          "+avatarPublicId"
        );

      if (!user) {
        throw new AppError(
          "User account was not found",
          404
        );
      }

      const previousAvatarPublicId =
        user.avatarPublicId;

      const alreadyRemoved =
        !user.avatarUrl &&
        !previousAvatarPublicId;

      if (alreadyRemoved) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Profile picture is already removed.",

            data: {
              user:
                user.toSafeObject(),
            },
          });
      }

      user.avatarUrl = null;

      user.avatarPublicId =
        null;

      await user.save();

      if (
        previousAvatarPublicId
      ) {
        try {
          await deleteProfileImageFromCloudinary(
            previousAvatarPublicId
          );
        } catch (error) {
          console.warn(
            "Unable to remove profile image from Cloudinary:",
            error.message
          );
        }
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Profile picture removed successfully.",

          data: {
            user:
              user.toSafeObject(),
          },
        });
    }
  );

export const changeCurrentUserPassword =
  asyncHandler(
    async (req, res) => {
      const {
        currentPassword,
        newPassword,
      } = req.body;

      const user =
        await User.findById(
          req.user._id
        ).select("+password");

      if (!user) {
        throw new AppError(
          "User account was not found",
          404
        );
      }

      /*
       * Google-only users do not initially have
       * a local password.
       */
      if (!user.password) {
        throw new AppError(
          "This account does not have a password yet. Use the forgot-password option to create one.",
          400
        );
      }

      const isCurrentPasswordCorrect =
        await user.comparePassword(
          currentPassword
        );

      if (
        !isCurrentPasswordCorrect
      ) {
        throw new AppError(
          "Current password is incorrect",
          401
        );
      }

      const isSamePassword =
        await user.comparePassword(
          newPassword
        );

      if (isSamePassword) {
        throw new AppError(
          "New password must be different from the current password",
          400
        );
      }

      /*
       * User model pre-save middleware hashes
       * the password automatically.
       */
      user.password =
        newPassword;

      await user.save();

      /*
       * Revoke all sessions after changing password.
       */
      await AuthSession.updateMany(
        {
          user: user._id,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt:
              new Date(),

            revocationReason:
              "PASSWORD_CHANGED",
          },
        }
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Password changed successfully. Please log in again using your new password.",
        });
    }
  );

export const logoutAllDevices =
  asyncHandler(
    async (req, res) => {
      const result =
        await AuthSession.updateMany(
          {
            user:
              req.user._id,

            revokedAt:
              null,
          },
          {
            $set: {
              revokedAt:
                new Date(),

              revocationReason:
                "USER_LOGOUT_ALL",
            },
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Logged out from all devices successfully.",

          data: {
            revokedSessionCount:
              result.modifiedCount,
          },
        });
    }
  );