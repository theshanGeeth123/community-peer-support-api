import mongoose from "mongoose";

const globalPostLikeSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GlobalPost",
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

globalPostLikeSchema.index(
  { post: 1, user: 1 },
  { unique: true, name: "unique_global_post_like" }
);

const GlobalPostLike = mongoose.model("GlobalPostLike", globalPostLikeSchema);

export default GlobalPostLike;
