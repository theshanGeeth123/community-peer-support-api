import "dotenv/config";

import dns from "node:dns";
import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| DNS Configuration
|--------------------------------------------------------------------------
|
| Some networks/ISPs have problems resolving MongoDB Atlas SRV records.
| Defining reliable DNS servers here ensures that every database consumer
| (server, seed scripts, admin scripts, etc.) uses the same configuration.
|
*/

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

dns.setDefaultResultOrder(
  "ipv4first"
);

/*
|--------------------------------------------------------------------------
| Database Connection
|--------------------------------------------------------------------------
*/

const connectDatabase = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is not configured in the environment file"
      );
    }

    const connection =
      await mongoose.connect(
        process.env.MONGODB_URI,
        {
          serverSelectionTimeoutMS:
            10000,
        }
      );

    console.log(
      `MongoDB connected: ${connection.connection.host}`
    );

    return connection;
  } catch (error) {
    console.error(
      `MongoDB connection failed: ${error.message}`
    );

    throw error;
  }
};

export default connectDatabase;