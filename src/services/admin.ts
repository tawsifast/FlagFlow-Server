import type { Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../lib/auth-middleware.js";
import { recordAuditLog } from "./audit-logs.js";

/**
 * GET /api/admin/stats
 * Platform-wide overview statistics for administrators
 */
export async function getAdminStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const [userCount, projectCount, envCount, flagCount, activeFlagCount, logCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.environment.count(),
        prisma.featureFlag.count(),
        prisma.featureFlag.count({ where: { enabled: true } }),
        prisma.auditLog.count(),
      ]);

    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: {
        role: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers: userCount,
        totalProjects: projectCount,
        totalEnvironments: envCount,
        totalFlags: flagCount,
        enabledFlags: activeFlagCount,
        disabledFlags: flagCount - activeFlagCount,
        totalAuditLogs: logCount,
        usersByRole: usersByRole.reduce((acc, curr) => {
          acc[curr.role] = curr._count.role;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error: any) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve system statistics.",
    });
  }
}

/**
 * GET /api/admin/users
 * Lists all users with account metadata and project counts
 */
export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            projects: true,
            auditLogs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve users.",
    });
  }
}

/**
 * PUT /api/admin/users/:id/role
 * Updates a user's role (USER, DEVELOPER, ADMIN)
 */
export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const adminUser = req.user!;
    const targetUserId = req.params.id as string;
    const { role } = req.body;

    if (!role || !["USER", "DEVELOPER", "ADMIN"].includes(role)) {
      res.status(400).json({
        success: false,
        message: "Invalid role. Allowed roles are: USER, DEVELOPER, ADMIN.",
      });
      return;
    }

    if (adminUser.id === targetUserId && role !== "ADMIN") {
      res.status(400).json({
        success: false,
        message: "Administrators cannot remove their own admin role.",
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await recordAuditLog({
      action: "user_role_updated",
      target: updated.email,
      userId: adminUser.id,
      userName: adminUser.name || "Administrator",
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: `User ${updated.email} role updated to ${updated.role}.`,
    });
  } catch (error: any) {
    console.error("Update user role error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update user role.",
    });
  }
}

/**
 * DELETE /api/admin/users/:id
 * Deletes a user (prevents self-deletion)
 */
export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const adminUser = req.user!;
    const targetUserId = req.params.id as string;

    if (adminUser.id === targetUserId) {
      res.status(400).json({
        success: false,
        message: "Administrators cannot delete their own account.",
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const deleted = await prisma.user.delete({
      where: { id: targetUserId },
    });

    await recordAuditLog({
      action: "user_deleted",
      target: deleted.email,
      userId: adminUser.id,
      userName: adminUser.name || "Administrator",
    });

    res.status(200).json({
      success: true,
      data: { id: deleted.id, email: deleted.email },
      message: `User ${deleted.email} deleted successfully.`,
    });
  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete user.",
    });
  }
}

