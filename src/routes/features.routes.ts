import { Router } from "express";
import { evaluateFlag } from "../services/flags.service.js";

const router = Router();

// GET /api/features/:key
router.get("/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const environment = req.query.environment as string | undefined;
    const project = req.query.project as string | undefined;

    const result = await evaluateFlag(key, environment, project);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Evaluate flag error:", error);
    res.status(500).json({
      success: false,
      key: req.params.key,
      enabled: false,
      message: error.message || "Failed to evaluate feature flag.",
    });
  }
});

export default router;

