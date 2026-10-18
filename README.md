# Community Peer Support API

A RESTful backend API for the **Community Peer Support** mobile application — a platform that connects users with peer supporters and moderators within structured support groups. Built with Node.js, Express, and MongoDB.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Server](#running-the-server)
- [User Roles](#user-roles)
- [API Reference](#api-reference)
  - [Health](#health)
  - [Authentication & Account](#authentication--account)
  - [Groups](#groups)
  - [Group Memberships](#group-memberships)
  - [Posts](#posts)
  - [Comments & Reactions](#comments--reactions)
  - [Comment Suggestions (AI)](#comment-suggestions-ai)
  - [Global Community Posts](#global-community-posts)
  - [Reports & Moderation](#reports--moderation)
  - [Notifications](#notifications)
  - [Chatbot (AI)](#chatbot-ai)
  - [Admin](#admin)
- [Security](#security)
- [Testing](#testing)
  - [Running Tests](#running-tests)
  - [Test Structure](#test-structure)
  - [Coverage](#coverage)

---

## Overview

The Community Peer Support API powers a mobile application where users can:

- Register, verify their email, and log in (including via Google OAuth)
- Join **support groups** and post within them
- Receive AI-powered **safety screening** on posts (crisis detection, harmful content filtering)
- Interact with posts via likes, reactions, comments, replies, and media
- Translate posts into **English, Sinhala, or Tamil** using Gemini AI
- Report content; moderators and admins review reports with AI-assisted summaries
- Receive in-app notifications
- Use a public **AI chatbot** for peer support guidance

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v20 (ESM) |
| Framework | Express.js v5 |
| Database | MongoDB (Mongoose v9) |
| Authentication | JWT (HS256) + session tokens |
| Password Hashing | bcryptjs |
| Media Storage | Cloudinary |
| Email | Nodemailer |
| AI / LLM | Google Gemini API (`@google/genai`) |
| Google OAuth | google-auth-library |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |
| File Uploads | multer |
| Testing | Jest + Supertest |
| Dev Server | nodemon |

---

## Project Structure

```
community-peer-support-api/
├── src/
│   ├── app.js                  # Express app setup & route mounting
│   ├── server.js               # Server entry point (DB connection + listen)
│   ├── config/
│   │   ├── cloudinary.js       # Cloudinary SDK configuration
│   │   ├── database.js         # Mongoose connection
│   │   └── mailer.js           # Nodemailer transporter
│   ├── constants/
│   │   ├── auth.constants.js   # USER_ROLES, ACCOUNT_STATUS, AUTH_PROVIDERS
│   │   └── post.constants.js   # Post status, reaction types, etc.
│   ├── controllers/            # Route handler logic (one file per domain)
│   ├── middleware/
│   │   ├── auth.middleware.js         # JWT authentication + role authorization
│   │   ├── error.middleware.js        # Global error handler + 404 handler
│   │   ├── rateLimit.middleware.js    # Per-endpoint rate limiters
│   │   ├── validate.middleware.js     # express-validator result handler
│   │   ├── postImageUpload.middleware.js
│   │   ├── profileImageUpload.middleware.js
│   │   └── commentMediaUpload.middleware.js
│   ├── models/                 # Mongoose schemas & models
│   ├── routes/                 # Express routers (one file per domain)
│   ├── scripts/
│   │   └── promoteAdmin.js     # CLI script to promote a user to admin
│   ├── services/               # Business logic & external integrations
│   │   ├── aiSafety.service.js
│   │   ├── chatbot.service.js
│   │   ├── commentSuggestion.service.js
│   │   ├── email.service.js
│   │   ├── geminiClient.js
│   │   ├── notification.service.js
│   │   ├── postLanguage.service.js
│   │   ├── postSafetyReview.service.js
│   │   ├── postTranslation.service.js
│   │   ├── reportAiReview.service.js
│   │   └── ...
│   ├── tests/                  # Jest test suites
│   │   ├── utils/
│   │   ├── middleware/
│   │   └── integration/
│   ├── utils/
│   │   ├── AppError.js         # Operational error class
│   │   ├── asyncHandler.js     # Async route wrapper
│   │   ├── jwt.util.js         # Token creation & verification
│   │   └── token.util.js       # OTP generation, hashing, secure compare
│   └── validators/             # express-validator rule sets
├── .env                        # Environment variables (not committed)
├── .gitignore
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** v20+
- **npm** v9+
- A **MongoDB Atlas** cluster (or local MongoDB instance)
- A **Cloudinary** account (for image uploads)
- A **Google Cloud** project with OAuth 2.0 credentials
- A **Gemini API** key (Google AI Studio)
- An SMTP email account (e.g. Gmail App Password)

### Installation

```bash
# Clone the repository
git clone https://github.com/theshanGeeth123/community-peer-support-api.git
cd community-peer-support-api

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the project root. **Never commit this file.**

```env
# ─── Server ──────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=5000

# ─── Database ────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0

# ─── Email ───────────────────────────────────────────────────────────────────
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# ─── Google OAuth ────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ─── OTP Settings ────────────────────────────────────────────────────────────
OTP_EXPIRES_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60

# ─── Password Reset OTP ──────────────────────────────────────────────────────
PASSWORD_RESET_OTP_EXPIRES_MINUTES=10
PASSWORD_RESET_OTP_MAX_ATTEMPTS=5
PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS=60

# ─── JWT ─────────────────────────────────────────────────────────────────────
JWT_SECRET=your_strong_random_secret_here
JWT_EXPIRES_SECONDS=86400
JWT_ISSUER=community-peer-support-api
JWT_AUDIENCE=community-peer-support-mobile

# ─── Cloudinary ──────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ─── Gemini AI ───────────────────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-lite
```

### Running the Server

```bash
# Development (with auto-restart on file changes)
npm run dev

# Production
npm start

# Promote a user to admin role (run once)
npm run admin:promote
```

The server starts on `http://localhost:5000` by default.

---

## User Roles

| Role | Description |
|------|-------------|
| `user` | Regular member — can join groups, post, comment, react |
| `peer_supporter` | Reviews join requests; assigned to specific groups |
| `moderator` | Manages group members; reviews & acts on reports |
| `admin` | Full access — creates groups, assigns staff, manages platform |

---

## API Reference

All API routes are prefixed with `/api/v1`.

Authentication is via **Bearer token** in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/health` | None | Returns API status, DB state, and timestamp |

---

### Authentication & Account

**Base path:** `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | None | Register a new user (sends OTP email) |
| `POST` | `/verify-email` | None | Verify email with OTP |
| `POST` | `/resend-verification-otp` | None | Resend email verification OTP |
| `POST` | `/login` | None | Login with email & password |
| `POST` | `/google` | None | Login or register with Google ID token |
| `POST` | `/forgot-password` | None | Send password reset OTP |
| `POST` | `/reset-password` | None | Reset password using OTP |
| `GET` | `/me` | ✅ | Get current authenticated user |
| `PATCH` | `/me` | ✅ | Update profile (name, bio, etc.) |
| `POST` | `/me/avatar` | ✅ | Upload profile avatar image |
| `DELETE` | `/me/avatar` | ✅ | Remove profile avatar |
| `PATCH` | `/change-password` | ✅ | Change password |
| `POST` | `/logout` | ✅ | Logout current session |
| `POST` | `/logout-all` | ✅ | Logout all devices |

---

### Groups

**Base path:** `/api/v1/groups` — all routes require authentication.

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET` | `/` | Any | List all support groups (paginated) |
| `GET` | `/my-assigned` | peer_supporter, moderator | Get groups assigned to me |
| `POST` | `/` | admin | Create a new support group |
| `GET` | `/:groupId` | Any | Get group details |
| `PATCH` | `/:groupId` | admin | Update group details |
| `POST` | `/:groupId/peer-supporters/:userId` | admin | Assign a peer supporter to a group |
| `DELETE` | `/:groupId/peer-supporters/:userId` | admin | Remove a peer supporter from a group |
| `POST` | `/:groupId/moderators/:userId` | admin | Assign a moderator to a group |
| `DELETE` | `/:groupId/moderators/:userId` | admin | Remove a moderator from a group |

---

### Group Memberships

**Base path:** `/api/v1/group-memberships` — all routes require authentication.

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/groups/:groupId/join-request` | user | Submit a request to join a group |
| `GET` | `/my-requests` | user | View my join requests |
| `GET` | `/my-groups` | user | View groups I'm a member of |
| `GET` | `/groups/:groupId/join-requests` | peer_supporter | View pending join requests for a group |
| `PATCH` | `/join-requests/:requestId/approve` | peer_supporter | Approve a join request |
| `PATCH` | `/join-requests/:requestId/reject` | peer_supporter | Reject a join request |
| `GET` | `/groups/:groupId/members` | moderator | View all members of a group |
| `PATCH` | `/memberships/:membershipId/suspend` | moderator | Suspend a member |
| `PATCH` | `/memberships/:membershipId/reactivate` | moderator | Reactivate a suspended member |
| `PATCH` | `/memberships/:membershipId/remove` | moderator | Remove a member from a group |

---

### Posts

**Base path:** `/api/v1` — all routes require authentication.

> Posts are AI-screened on creation for safety (crisis detection, harmful content).

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/groups/:groupId/posts` | Any | Create a post in a group (supports image upload) |
| `GET` | `/groups/:groupId/posts` | Any | List posts in a group (paginated) |
| `GET` | `/posts/my-feed` | user | Get personalised feed from joined groups |
| `GET` | `/posts/crisis-alerts` | moderator, peer_supporter, admin | View posts flagged as crisis alerts |
| `GET` | `/posts/needs-response` | moderator, peer_supporter, admin | View posts needing a response |
| `GET` | `/posts/:postId` | Any | Get a single post |
| `DELETE` | `/posts/:postId` | Any | Delete a post (own, or staff) |
| `POST` | `/posts/:postId/like` | Any | Toggle like on a post |
| `POST` | `/posts/:postId/reaction` | Any | Toggle emoji reaction (like/love/haha/wow/sad/angry) |
| `POST` | `/posts/:postId/pin` | Any | Pin/unpin a post |
| `POST` | `/posts/:postId/translate` | Any | Translate post content (English/Sinhala/Tamil) |
| `GET` | `/posts/:postId/comments` | Any | Get comments for a post |
| `PATCH` | `/posts/:postId/crisis-flag/handle` | moderator, peer_supporter, admin | Mark a crisis alert as handled |

---

### Comments & Reactions

**Base path:** `/api/v1` — all routes require authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/posts/:postId/comments` | Add a comment (supports photo/video uploads) |
| `PATCH` | `/comments/:commentId` | Edit a comment |
| `DELETE` | `/comments/:commentId` | Delete a comment |
| `POST` | `/comments/:commentId/replies` | Reply to a comment (supports media) |
| `POST` | `/comments/:commentId/heart` | Toggle heart on a comment |
| `POST` | `/comments/:commentId/reaction` | Toggle emoji reaction on a comment |
| `PATCH` | `/comments/:commentId/pin` | Pin/unpin own comment |

---

### Comment Suggestions (AI)

**Base path:** `/api/v1` — requires authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/posts/:postId/comment-suggestions` | Get AI-generated empathetic comment suggestions for a post |

---

### Global Community Posts

**Base path:** `/api/v1/community` — requires authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Browse community-wide posts |
| `POST` | `/` | Create a global community post |
| `POST` | `/:postId/like` | Like/unlike a global post |
| `POST` | `/:postId/comments` | Comment on a global post |

---

### Reports & Moderation

**Base path:** `/api/v1/reports` — requires authentication.

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/` | Any | Submit a content report |
| `GET` | `/` | moderator, admin | List all reports (filterable) |
| `GET` | `/:reportId` | moderator, admin | Get report details |
| `POST` | `/:reportId/review` | moderator, admin | Review and action a report |
| `GET` | `/:reportId/ai-review` | moderator, admin | Get AI-generated review summary for a report |

---

### Notifications

**Base path:** `/api/v1/notifications` — requires authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get my notifications (paginated) |
| `GET` | `/unread-count` | Get count of unread notifications |
| `PATCH` | `/read-all` | Mark all notifications as read |
| `PATCH` | `/:notificationId/read` | Mark a specific notification as read |

---

### Chatbot (AI)

**Base path:** `/api/v1/chatbot` — **no authentication required**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/message` | Send a message to the AI peer support chatbot |

---

### Admin

**Base path:** `/api/v1/admin` — requires `admin` role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | List all users |
| `GET` | `/users/:userId` | Get a user's full admin profile |
| `PATCH` | `/users/:userId/status` | Update a user's account status |

---

## Security

The API implements the following security measures:

- **Helmet** — sets secure HTTP response headers
- **CORS** — configurable origin with credentials support
- **JWT session tokens** — tokens are hashed and stored server-side; revocation is fully supported
- **Rate limiting** — separate limiters per sensitive endpoint (login, registration, OTP, password reset)
- **Input validation** — all inputs validated with `express-validator` before reaching controllers
- **Password hashing** — bcryptjs with salt rounds of 12
- **Timing-safe token comparison** — `crypto.timingSafeEqual` used to prevent timing attacks on OTP/token checks
- **Account enumeration prevention** — generic responses on email lookup endpoints
- **Password-change token invalidation** — tokens issued before a password change are automatically rejected

---

## Testing

Tests are located in `src/tests/` and use **Jest** with **Supertest** for integration testing. The project uses ESM (`"type": "module"`), so tests are run via `node --experimental-vm-modules`.

### Running Tests

```bash
# Run all tests
npm test

# Run all tests with coverage report
npm run test:coverage

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run a single test file
node --experimental-vm-modules node_modules/jest-cli/bin/jest.js src/tests/utils/AppError.test.js

# Run a folder of tests
node --experimental-vm-modules node_modules/jest-cli/bin/jest.js src/tests/utils/
node --experimental-vm-modules node_modules/jest-cli/bin/jest.js src/tests/middleware/
node --experimental-vm-modules node_modules/jest-cli/bin/jest.js src/tests/integration/
```

> **Note:** The `ExperimentalWarning: VM Modules` message in the output is harmless — it's a Node.js notice and does not affect test execution.

### Test Structure

```
src/tests/
├── utils/
│   ├── AppError.test.js          # AppError class (5 tests)
│   ├── token.util.test.js        # OTP generation, hashing, secure compare (10 tests)
│   └── jwt.util.test.js          # JWT creation & verification (8 tests)
├── middleware/
│   ├── auth.middleware.test.js   # Header validation, bad tokens, role auth (10 tests)
│   └── error.middleware.test.js  # notFoundHandler + globalErrorHandler (8 tests)
└── integration/
    └── health.test.js            # GET /api/v1/health + 404 fallback (8 tests)
```

**Total: 6 test suites · 49 tests**

### Coverage

Run `npm run test:coverage` to generate a full coverage report.

| Area | Coverage |
|------|----------|
| `src/utils/` | ~91% statements |
| `src/constants/` | 100% |
| `src/middleware/` (error + auth headers) | ~46% |
| `src/routes/` | ~78% (route definitions) |
| `src/controllers/` | ~12% (no controller-level tests yet) |
| `src/services/` | ~19% (no service-level tests yet) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with nodemon |
| `npm start` | Start production server |
| `npm run admin:promote` | Promote a user to admin via CLI |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable production-ready code |
| `develop` | Integration branch for all features |
| `feature/*` | Individual feature branches |
| `feature/testing` | Test suite setup and CI configuration |

---

## License

ISC
