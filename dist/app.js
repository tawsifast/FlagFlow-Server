import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import router from "./routes/routes.js";
dotenv.config();
const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
// Mount Better Auth handler before express.json()
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());
app.use("/api", router);
app.get("/", (_req, res) => {
    res.json({
        success: true,
        message: "Welcome to FlagFlow API",
    });
});
export default app;
