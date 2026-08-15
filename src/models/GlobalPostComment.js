import mongoose from "mongoose";

const globalPostCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GlobalPost",
      required: [true, "Post is required"],
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
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment content cannot be empty"],
      maxlength: [1000, "Comment content cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

globalPostCommentSchema.index({ post: 1, createdAt: 1 });

globalPostCommentSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    post: this.post,
    author: this.author,
    content: this.content,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const GlobalPostComment = mongoose.model(
  "GlobalPostComment",
  globalPostCommentSchema
);

export default GlobalPostComment;
