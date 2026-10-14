import asyncHandler from "../utils/asyncHandler.js";

import {
  generateCommentSuggestions,
} from "../services/commentSuggestion.service.js";

export const createCommentSuggestions = asyncHandler(
  async (req, res) => {
    const suggestions = await generateCommentSuggestions({
      postContent: req.body.postContent.trim(),
      tone: req.body.tone,
    });

    return res.status(200).json({
      success: true,
      message: "Comment suggestions generated successfully.",
      data: {
        suggestions,
      },
    });
  }
);
