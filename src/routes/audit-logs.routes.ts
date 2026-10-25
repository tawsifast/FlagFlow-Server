import { Router } from "express";
import { getAuditLogs } from "../services/audit-logs.service.js";

const router = Router();

// GET /api/audit-logs
router.get("/", async (req, res) => {
  try {
    const { action, environment, userName, range } = req.query;

    const logs = await getAuditLogs({
      action: action as string | undefined,
      environment: environment as string | undefined,
      userName: userName as string | undefined,
      range: range as "24h" | "7d" | "all" | undefined,
    });

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error("List audit logs error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch audit logs.",
    });
  }
});

export default router;

