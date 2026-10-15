import mongoose from "mongoose";

const commentReactionSchema = new mongoose.Schema(
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
 * on a particular comment.
 *
 * If the user selects another emoji,
 * their existing reaction will be changed.
 */
commentReactionSchema.index(
  { comment: 1, user: 1 },
  {
    unique: true,
    name: "unique_comment_reaction",
  }
);

/*
 * Useful for getting reaction counts
 * for a comment by reaction type.
 */
commentReactionSchema.index({
  comment: 1,
  reactionType: 1,
});

const CommentReaction = mongoose.model(
  "CommentReaction",
  commentReactionSchema
);

export default CommentReaction;