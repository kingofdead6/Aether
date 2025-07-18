import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import chatRoute from "./Routes/chatRoute.js";
import notificationRoute from "./Routes/notificationRoute.js";
import setupSocket from "./sockets/socket.js";
import { createServer } from "http";
import authRoute from "./Routes/authRoute.js";
import postRoute from "./Routes/postRoute.js";
// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create HTTP server for Express and Socket.IO
const server = createServer(app);

// Set up Socket.IO
const io = setupSocket(server, app);
app.set("io", io);

// Enable CORS
app.use(cors());
app.use(express.json());

// Define API routes
app.use("/api/auth", authRoute);
app.use("/api/chats", chatRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/posts", postRoute);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, )
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("API is running");
});