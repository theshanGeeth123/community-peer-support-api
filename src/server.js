import "dotenv/config";

import app from "./app.js";
import connectDatabase from "./config/database.js";

const PORT =
  process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(
      PORT,
      () => {
        console.log(
          `Server running on http://localhost:${PORT}`
        );

        console.log(
          `Environment: ${process.env.NODE_ENV}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Server startup failed."
    );

    process.exit(1);
  }
};

startServer();