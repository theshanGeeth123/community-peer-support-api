import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import groupRoutes from "./routes/group.routes.js";
import groupMembershipRoutes from "./routes/groupMembership.routes.js";
import postRoutes from "./routes/post.routes.js";
import commentReactRoutes from "./routes/commentReact.routes.js";
import globalPostRoutes from "./routes/globalPost.routes.js";
import reportRoutes from "./routes/report.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

import {
  globalErrorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "100kb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10kb",
  })
);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

/*
|--------------------------------------------------------------------------
| API ROUTES
|--------------------------------------------------------------------------
*/

app.use(
  "/api/v1/health",
  healthRoutes
);

app.use(
  "/api/v1/auth",
  authRoutes
);

app.use(
  "/api/v1/admin",
  adminRoutes
);

app.use(
  "/api/v1/groups",
  groupRoutes
);

app.use(
  "/api/v1/group-memberships",
  groupMembershipRoutes
);

/*
|--------------------------------------------------------------------------
| PUBLIC CHATBOT
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This route MUST stay BEFORE:
|
|     app.use("/api/v1", postRoutes);
|
| postRoutes uses router.use(authenticate),
| so placing the chatbot after it would incorrectly
| require authentication for /api/v1/chatbot/message.
|
| No authentication is required for this chatbot.
|
*/

app.use(
  "/api/v1/chatbot",
  chatbotRoutes
);

/*
|--------------------------------------------------------------------------
| POST ROUTES
|--------------------------------------------------------------------------
|
| This router is mounted broadly on /api/v1
| and requires authentication.
| Keep public routes such as chatbot ABOVE this.
|
*/

app.use(
  "/api/v1",
  postRoutes
);

/*
|--------------------------------------------------------------------------
| COMMENT / REACTION / REPLY ROUTES
|--------------------------------------------------------------------------
|
| Handles:
| - View comments
| - Create comments
| - Edit comments
| - Delete comments
| - Replies
| - Comment hearts
| - Comment/reply reactions
|
*/

app.use(
  "/api/v1",
  commentReactRoutes
);

app.use(
  "/api/v1/community",
  globalPostRoutes
);

app.use(
  "/api/v1/reports",
  reportRoutes
);

app.use(
  "/api/v1/notifications",
  notificationRoutes
);

/*
|--------------------------------------------------------------------------
| ERROR HANDLING
|--------------------------------------------------------------------------
*/

app.use(notFoundHandler);

app.use(globalErrorHandler);

export default app;