import mongoose from "mongoose";

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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

postSchema.index({ group: 1, isPinned: -1, createdAt: -1 });

postSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    group: this.group,
    author: this.author,
    content: this.content,
    imageUrl: this.imageUrl,
    isAnonymous: this.isAnonymous,
    isPinned: this.isPinned,
    likeCount: this.likeCount,
    commentCount: this.commentCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Post = mongoose.model("Post", postSchema);

export default Post;
