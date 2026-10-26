import type { Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../lib/auth-middleware.js";

export interface CreateAuditLogInput {
  action: string;
  target: string;
  environment?: string;
  projectName?: string;
  userId?: string;
  userName: string;
}

/**
 * Server-side audit log recorder.
 * Only invoked internally by authorized services to guarantee audit record integrity.
 */
export async function recordAuditLog(input: CreateAuditLogInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        action: input.action,
        target: input.target,
        environment: input.environment,
        projectName: input.projectName,
        userId: input.userId,
        userName: input.userName,
      },
    });
  } catch (error) {
    console.error("Failed to record audit log:", error);
    return null;
  }
}

/**
 * GET /api/audit-logs
 * Retrieves audit logs.
 * - ADMIN: Can view system-wide audit logs.
 * - Non-admin: Only sees audit logs for projects they own or actions they performed.
 */
export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { action, environment, userName, range } = req.query;
    const where: any = {};

    // Server-side authorization scoping
    if (user.role !== "ADMIN") {
      // Find projects owned by this user
      const ownedProjects = await prisma.project.findMany({
        where: { userId: user.id },
        select: { name: true },
      });
      const ownedProjectNames = ownedProjects.map((p) => p.name);

      where.OR = [
        { userId: user.id },
        { projectName: { in: ownedProjectNames } },
      ];
    }

    if (action && action !== "all" && typeof action === "string") {
      where.action = action;
    }

    if (environment && environment !== "all" && typeof environment === "string") {
      where.environment = environment;
    }

    if (userName && userName !== "all" && typeof userName === "string") {
      where.userName = userName;
    }

    if (range && range !== "all" && typeof range === "string") {
      const now = new Date();
      const pastTime = new Date(
        range === "24h"
          ? now.getTime() - 24 * 60 * 60 * 1000
          : now.getTime() - 7 * 24 * 60 * 60 * 1000
      );
      where.createdAt = { gte: pastTime };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch audit logs.",
    });
  }
}

