import mongoose from "mongoose";

import { CONTENT_WARNING } from "../constants/post.constants.js";

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
    likeCount: this.likeCount,
    commentCount: this.commentCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Post = mongoose.model("Post", postSchema);

export default Post;
