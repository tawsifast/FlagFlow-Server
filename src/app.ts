import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// import router from "./routes/routes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// app.use("/api", router);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Eventora API",
  });
});

export default app;