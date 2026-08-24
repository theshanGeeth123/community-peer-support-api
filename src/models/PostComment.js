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