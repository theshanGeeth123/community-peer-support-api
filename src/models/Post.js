import mongoose from "mongoose";

import {
  AI_MOOD,
  AI_RISK_LEVEL,
  AI_SAFETY_STATUS,
  CONTENT_WARNING,
  CRISIS_FLAG_SOURCE,
  POST_LANGUAGE,
  TRANSLATION_LANGUAGE,
} from "../constants/post.constants.js";

const postSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportGroup",
      required: [true, "Support group is required"],
      index: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
      index: true,
    },

    content: {
      type: String,
      required: [true, "Post content is required"],
      trim: true,
      minlength: [1, "Post content cannot be empty"],
      maxlength: [3000, "Post content cannot exceed 3000 characters"],
    },

    imageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    /*
     * Cloudinary public ID, used to delete the image with the post.
     * Not sent to the app.
     */
    imagePublicId: {
      type: String,
      default: null,
    },

    isAnonymous: {
      type: Boolean,
      default: false,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },

    /*
     * Trigger warnings chosen by the author. When present, the app
     * hides the content behind a "Show post" overlay for other members.
     */
    contentWarnings: {
      type: [
        {
          type: String,
          enum: Object.values(CONTENT_WARNING),
        },
      ],
      default: [],
    },

    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | MODERATION REMOVAL
    |--------------------------------------------------------------------------
    |
    | Set when a moderator reviews a report with action REMOVE. The post
    | is hidden from members but kept so Moderation History can still
    | show what was removed. Its image is deleted from Cloudinary.
    |
    */

    isRemoved: {
      type: Boolean,
      default: false,
    },

    removedAt: {
      type: Date,
      default: null,
    },

    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    removalReason: {
      type: String,
      trim: true,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | CRISIS FLAG
    |--------------------------------------------------------------------------
    |
    | Set automatically when the post content matches crisis keywords.
    | Visible to group staff only.
    |
    */

    crisisFlag: {
      isFlagged: {
        type: Boolean,
        default: false,
      },

      matchedTerms: {
        type: [String],
        default: [],
      },

      flaggedAt: {
        type: Date,
        default: null,
      },

      handledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      handledAt: {
        type: Date,
        default: null,
      },

      /*
       * What raised the flag: keyword matching, the AI check, or both.
       * null on posts flagged before the AI check existed.
       */
      source: {
        type: String,
        enum: [...Object.values(CRISIS_FLAG_SOURCE), null],
        default: null,
      },
    },

    /*
    |--------------------------------------------------------------------------
    | LANGUAGE & TRANSLATIONS
    |--------------------------------------------------------------------------
    |
    | language     → what the post is written in. Set from its alphabet
    |                when created, then refined by the AI check (which can
    |                also recognise Sinhala typed in English letters).
    | translations → AI translations, saved the first time someone asks
    |                for that language and reused for everyone after.
    |
    */

    language: {
      type: String,
      enum: [...Object.values(POST_LANGUAGE), null],
      default: null,
    },

    translations: {
      type: [
        {
          _id: false,

          language: {
            type: String,
            enum: Object.values(TRANSLATION_LANGUAGE),
            required: true,
          },

          content: {
            type: String,
            required: true,
          },

          model: {
            type: String,
            default: null,
          },

          translatedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | AI SAFETY CHECK (Gemini)
    |--------------------------------------------------------------------------
    |
    | Result of the AI review of this post. Visible to group staff only.
    | status PENDING → the check is still running in the background.
    | FAILED / SKIPPED → no AI result; keyword detection still applied.
    |
    */

    aiSafety: {
      status: {
        type: String,
        enum: Object.values(AI_SAFETY_STATUS),
        default: AI_SAFETY_STATUS.SKIPPED,
      },

      riskLevel: {
        type: String,
        enum: [...Object.values(AI_RISK_LEVEL), null],
        default: null,
      },

      /*
       * Numeric rank of riskLevel, for "most serious first" sorting.
       */
      riskScore: {
        type: Number,
        default: 0,
      },

      mood: {
        type: String,
        enum: [...Object.values(AI_MOOD), null],
        default: null,
      },

      reason: {
        type: String,
        trim: true,
        default: null,
      },

      suggestedWarnings: {
        type: [String],
        default: [],
      },

      model: {
        type: String,
        default: null,
      },

      checkedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

postSchema.index({ group: 1, isPinned: -1, createdAt: -1 });

/*
 * Sort options: most supported / most discussed / unanswered
 */
postSchema.index({ group: 1, likeCount: -1, commentCount: -1, createdAt: -1 });
postSchema.index({ group: 1, commentCount: -1, likeCount: -1, createdAt: -1 });

postSchema.index({
  "crisisFlag.isFlagged": 1,
  "crisisFlag.handledAt": 1,
  group: 1,
  createdAt: -1,
});

/*
 * crisisFlag is intentionally left out — it is added only for
 * group staff in the post controller.
 */
postSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    group: this.group,
    author: this.author,
    content: this.content,
    imageUrl: this.imageUrl,
    isAnonymous: this.isAnonymous,
    isPinned: this.isPinned,
    contentWarnings: this.contentWarnings ?? [],
    isRemoved: Boolean(this.isRemoved),
    likeCount: this.likeCount,
    commentCount: this.commentCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Post = mongoose.model("Post", postSchema);

export default Post;
