import mongoose from "mongoose";

const globalPostSchema = new mongoose.Schema(
  {
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

    postType: {
      type: String,
      enum: ["post", "announcement"],
      default: "post",
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

globalPostSchema.index({ isPinned: -1, createdAt: -1 });

globalPostSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    author: this.author,
    content: this.content,
    imageUrl: this.imageUrl,
    postType: this.postType,
    isPinned: this.isPinned,
    likeCount: this.likeCount,
    commentCount: this.commentCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const GlobalPost = mongoose.model("GlobalPost", globalPostSchema);

export default GlobalPost;
