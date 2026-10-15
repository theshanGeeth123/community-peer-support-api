import mongoose from "mongoose";

const postCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Post is required"],
      index: true,
    },

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

    /*
    |--------------------------------------------------------------------------
    | REPLY SUPPORT
    |--------------------------------------------------------------------------
    |
    | null = normal/top-level comment
    | commentId = reply to that comment
    |
    */

    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostComment",
      default: null,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | COMMENT MEDIA
    |--------------------------------------------------------------------------
    |
    | Stores media uploaded to Cloudinary.
    | The actual photo/video is NOT stored in MongoDB.
    |
    */

    media: {
      type: [
        {
          type: {
            type: String,
            enum: ["image", "video"],
            required: true,
          },

          url: {
            type: String,
            required: true,
          },

          publicId: {
            type: String,
            required: true,
          },
        },
      ],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | COMMENT PIN
    |--------------------------------------------------------------------------
    |
    | true = comment is pinned
    | false = comment is not pinned
    |
    */

    isPinned: {
      type: Boolean,
      default: false,
    },

    /*
     * Set when a moderator removes the comment through a report.
     * Hidden from members, kept for Moderation History.
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

    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment content cannot be empty"],
      maxlength: [
        1000,
        "Comment content cannot exceed 1000 characters",
      ],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

postCommentSchema.index({
  post: 1,
  createdAt: 1,
});

postCommentSchema.index({
  parentComment: 1,
  createdAt: 1,
});

postCommentSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    post: this.post,
    group: this.group,
    author: this.author,
    content: this.content,

    // Cloudinary media
    media: this.media,

    // Comment pin status
    isPinned: this.isPinned,

    parentComment: this.parentComment,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const PostComment = mongoose.model(
  "PostComment",
  postCommentSchema
);

export default PostComment;