import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Get projects error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
});

export default router;