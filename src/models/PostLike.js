import mongoose from "mongoose";

const postLikeSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Post is required"],
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

postLikeSchema.index(
  { post: 1, user: 1 },
  { unique: true, name: "unique_post_like" }
);

const PostLike = mongoose.model("PostLike", postLikeSchema);

export default PostLike;
