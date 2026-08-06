import {
  ACCOUNT_STATUS,
  USER_ROLES,
} from "../constants/auth.constants.js";

import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const escapeRegularExpression = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const revokeUserSessions = async ({
  userId,
  reason,
}) => {
  await AuthSession.updateMany(
    {
      user: userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    }
  );
};

const ensureAnotherActiveAdminExists = async (
  targetUserId
) => {
  const anotherActiveAdminCount =
    await User.countDocuments({
      _id: {
        $ne: targetUserId,
      },

      role: USER_ROLES.ADMIN,

      accountStatus: ACCOUNT_STATUS.ACTIVE,
    });

  if (anotherActiveAdminCount === 0) {
    throw new AppError(
      "This action would remove the final active administrator",
      409
    );
  }
};

export const getUsers = asyncHandler(
  async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const skip = (page - 1) * limit;

    const {
      search,
      role,
      status,
      provider,
    } = req.query;

    const filter = {};

    if (search) {
      const safeSearch =
        escapeRegularExpression(search);

      filter.$or = [
        {
          fullName: {
            $regex: safeSearch,
            $options: "i",
          },
        },
        {
          email: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (status) {
      filter.accountStatus = status;
    }

    if (provider) {
      filter.authProviders = provider;
    }

    const [users, totalUsers] =
      await Promise.all([
        User.find(filter)
          .select("+password +googleId")
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit),

        User.countDocuments(filter),
      ]);

    const totalPages = Math.max(
      1,
      Math.ceil(totalUsers / limit)
    );

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully.",

      data: {
        users: users.map((user) =>
          user.toAdminObject()
        ),

        pagination: {
          page,
          limit,
          totalUsers,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  }
);

export const getUserById = asyncHandler(
  async (req, res) => {
    const user = await User.findById(
      req.params.userId
    ).select("+password +googleId");

    if (!user) {
      throw new AppError(
        "User account was not found",
        404
      );
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully.",

      data: {
        user: user.toAdminObject(),
      },
    });
  }
);

export const updateUserRole = asyncHandler(
  async (req, res) => {
    const { role } = req.body;

    const targetUser = await User.findById(
      req.params.userId
    ).select("+password +googleId");

    if (!targetUser) {
      throw new AppError(
        "User account was not found",
        404
      );
    }

    if (
      targetUser._id.toString() ===
      req.user._id.toString()
    ) {
      throw new AppError(
        "You cannot change your own administrator role",
        400
      );
    }

    if (
      targetUser.role === USER_ROLES.ADMIN &&
      role !== USER_ROLES.ADMIN
    ) {
      await ensureAnotherActiveAdminExists(
        targetUser._id
      );
    }

    if (targetUser.role === role) {
      return res.status(200).json({
        success: true,
        message: "User already has this role.",

        data: {
          user: targetUser.toAdminObject(),
        },
      });
    }

    targetUser.role = role;

    await targetUser.save({
      validateBeforeSave: false,
    });

    await revokeUserSessions({
      userId: targetUser._id,
      reason: "ADMIN_ROLE_CHANGED",
    });

    return res.status(200).json({
      success: true,
      message: "User role updated successfully.",

      data: {
        user: targetUser.toAdminObject(),
      },
    });
  }
);

export const updateUserStatus = asyncHandler(
  async (req, res) => {
    const { accountStatus } = req.body;

    const targetUser = await User.findById(
      req.params.userId
    ).select("+password +googleId");

    if (!targetUser) {
      throw new AppError(
        "User account was not found",
        404
      );
    }

    if (
      targetUser._id.toString() ===
      req.user._id.toString()
    ) {
      throw new AppError(
        "You cannot change your own account status",
        400
      );
    }

    if (
      targetUser.role === USER_ROLES.ADMIN &&
      targetUser.accountStatus ===
        ACCOUNT_STATUS.ACTIVE &&
      accountStatus !== ACCOUNT_STATUS.ACTIVE
    ) {
      await ensureAnotherActiveAdminExists(
        targetUser._id
      );
    }

    if (
      targetUser.accountStatus === accountStatus
    ) {
      return res.status(200).json({
        success: true,
        message:
          "User already has this account status.",

        data: {
          user: targetUser.toAdminObject(),
        },
      });
    }

    targetUser.accountStatus = accountStatus;

    await targetUser.save({
      validateBeforeSave: false,
    });

    if (
      accountStatus !== ACCOUNT_STATUS.ACTIVE
    ) {
      await revokeUserSessions({
        userId: targetUser._id,
        reason: `ADMIN_ACCOUNT_${accountStatus}`,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "User account status updated successfully.",

      data: {
        user: targetUser.toAdminObject(),
      },
    });
  }
);

export const revokeAllUserSessions = asyncHandler(
  async (req, res) => {
    const targetUser = await User.findById(
      req.params.userId
    );

    if (!targetUser) {
      throw new AppError(
        "User account was not found",
        404
      );
    }

    if (
      targetUser._id.toString() ===
      req.user._id.toString()
    ) {
      throw new AppError(
        "Use the normal logout option for your own session",
        400
      );
    }

    const result = await AuthSession.updateMany(
      {
        user: targetUser._id,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revocationReason:
            "ADMIN_REVOKED_SESSIONS",
        },
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "User sessions revoked successfully.",

      data: {
        revokedSessionCount:
          result.modifiedCount,
      },
    });
  }
);