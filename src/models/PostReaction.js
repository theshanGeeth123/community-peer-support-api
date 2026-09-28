import mongoose from "mongoose";

const postReactionSchema = new mongoose.Schema(
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

    reactionType: {
      type: String,
      enum: {
        values: [
          "like",
          "love",
          "haha",
          "wow",
          "sad",
          "angry",
        ],
        message: "Invalid reaction type",
      },
      required: [true, "Reaction type is required"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/*
 * One user can have only one reaction
 * on a particular post.
 *
 * If the user selects another emoji,
 * their existing reaction will be changed.
 */
postReactionSchema.index(
  { post: 1, user: 1 },
  {
    unique: true,
    name: "unique_post_reaction",
  }
);

/*
 * Useful for getting reaction counts
 * for a post by reaction type.
 */
postReactionSchema.index({
  post: 1,
  reactionType: 1,
});

const PostReaction = mongoose.model(
  "PostReaction",
  postReactionSchema
);

export default PostReaction;