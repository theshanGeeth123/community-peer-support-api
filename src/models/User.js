import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import {
    ACCOUNT_STATUS,
    AUTH_PROVIDERS,
    USER_ROLES,
} from "../constants/auth.constants.js";

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            minlength: [2, "Full name must contain at least 2 characters"],
            maxlength: [80, "Full name cannot exceed 80 characters"],
        },

        email: {
            type: String,
            required: [true, "Email address is required"],
            trim: true,
            lowercase: true,
            maxlength: [254, "Email address is too long"],
        },

        password: {
            type: String,
            minlength: [8, "Password must contain at least 8 characters"],
            select: false,
        },

        googleId: {
            type: String,
            trim: true,
            select: false,
        },

        authProviders: {
            type: [
                {
                    type: String,
                    enum: Object.values(AUTH_PROVIDERS),
                },
            ],
            default: [AUTH_PROVIDERS.LOCAL],
        },

        role: {
            type: String,
            enum: Object.values(USER_ROLES),
            default: USER_ROLES.USER,
        },

        avatarUrl: {
            type: String,
            trim: true,
            default: null,
        },

        isEmailVerified: {
            type: Boolean,
            default: false,
        },

        accountStatus: {
            type: String,
            enum: Object.values(ACCOUNT_STATUS),
            default: ACCOUNT_STATUS.ACTIVE,
        },

        emailVerificationOtpHash: {
            type: String,
            select: false,
            default: null,
        },

        emailVerificationOtpExpiresAt: {
            type: Date,
            select: false,
            default: null,
        },

        emailVerificationOtpSentAt: {
            type: Date,
            select: false,
            default: null,
        },

        emailVerificationOtpAttemptCount: {
            type: Number,
            select: false,
            default: 0,
            min: 0,
        },

        passwordResetTokenHash: {
            type: String,
            select: false,
            default: null,
        },

        passwordResetExpiresAt: {
            type: Date,
            select: false,
            default: null,
        },

        passwordChangedAt: {
            type: Date,
            default: null,
        },

        lastLoginAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

userSchema.index(
    { email: 1 },
    {
        unique: true,
        name: "unique_user_email",
    }
);

userSchema.index(
    { googleId: 1 },
    {
        unique: true,
        sparse: true,
        name: "unique_google_id",
    }
);

userSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 12);

    if (!this.isNew) {
        this.passwordChangedAt = new Date();
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) {
        return false;
    }

    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
    return {
        id: this._id.toString(),
        fullName: this.fullName,
        email: this.email,
        role: this.role,
        avatarUrl: this.avatarUrl,
        authProviders: this.authProviders,
        isEmailVerified: this.isEmailVerified,
        accountStatus: this.accountStatus,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

const User = mongoose.model("User", userSchema);

export default User;