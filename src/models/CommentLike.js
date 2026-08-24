import mongoose from "mongoose";

const commentLikeSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PostComment",
      required: [true, "Comment is required"],
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

commentLikeSchema.index(
  { comment: 1, user: 1 },
  {
    unique: true,
    name: "unique_comment_like",
  }
);

const CommentLike = mongoose.model(
  "CommentLike",
  commentLikeSchema
);

export default CommentLike;