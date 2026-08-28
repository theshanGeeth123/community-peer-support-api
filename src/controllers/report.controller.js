import ModerationAction from "../models/ModerationAction.js";
import Report from "../models/Report.js";

import { REPORT_STATUS } from "../constants/moderation.constants.js";

import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

// ─── POST /reports ────────────────────────────────────────────────────────────

export const submitReport = asyncHandler(async (req, res) => {
  const { group, targetType, targetId, reason, additionalDetails } = req.body;

  // Duplicate guard: a user cannot report the same content twice in the same group
  const existingReport = await Report.findOne({
    reporter: req.user._id,
    group,
    targetType,
    targetId,
  });

  if (existingReport) {
    throw new AppError(
      "You have already submitted a report for this content",
      409
    );
  }

  const report = await Report.create({
    reporter: req.user._id,
    group,
    targetType,
    targetId,
    reason,
    additionalDetails: additionalDetails ?? null,
  });

  return res.status(201).json({
    success: true,
    message: "Report submitted successfully.",

    data: {
      report,
    },
  });
});

// ─── GET /reports ─────────────────────────────────────────────────────────────

export const getReports = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;

  const skip = (page - 1) * limit;

  const { status, group, targetType } = req.query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (group) {
    filter.group = group;
  }

  if (targetType) {
    filter.targetType = targetType;
  }

  const [reports, totalReports] = await Promise.all([
    Report.find(filter)
      .populate("reporter", "fullName email avatarUrl")
      .populate("reviewedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Report.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalReports / limit));

  return res.status(200).json({
    success: true,
    message: "Reports retrieved successfully.",

    data: {
      reports,

      pagination: {
        page,
        limit,
        totalReports,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  });
});

// ─── GET /reports/:reportId ───────────────────────────────────────────────────

export const getReportById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.reportId)
    .populate("reporter", "fullName email avatarUrl")
    .populate("reviewedBy", "fullName email");

  if (!report) {
    throw new AppError("Report was not found", 404);
  }

  return res.status(200).json({
    success: true,
    message: "Report retrieved successfully.",

    data: {
      report,
    },
  });
});

// ─── POST /reports/:reportId/review ──────────────────────────────────────────

export const reviewReport = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;

  const report = await Report.findById(req.params.reportId);

  if (!report) {
    throw new AppError("Report was not found", 404);
  }

  if (report.status === REPORT_STATUS.REVIEWED) {
    throw new AppError("This report has already been reviewed", 409);
  }

  // Atomically mark the report as reviewed and create a moderation action
  const now = new Date();

  report.status = REPORT_STATUS.REVIEWED;
  report.reviewedBy = req.user._id;
  report.reviewedAt = now;

  const [updatedReport, moderationAction] = await Promise.all([
    report.save({ validateBeforeSave: false }),

    ModerationAction.create({
      moderator: req.user._id,
      group: report.group,
      report: report._id,
      targetType: report.targetType,
      targetId: report.targetId,
      action,
      reason,
    }),
  ]);

  const populatedReport = await updatedReport.populate([
    { path: "reporter", select: "fullName email avatarUrl" },
    { path: "reviewedBy", select: "fullName email" },
  ]);

  return res.status(200).json({
    success: true,
    message: "Report reviewed successfully.",

    data: {
      report: populatedReport,
      moderationAction,
    },
  });
});
