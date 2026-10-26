import type { Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../lib/auth-middleware.js";
import { recordAuditLog } from "./audit-logs.js";

/**
 * GET /api/flags
 * Lists feature flags. Scoped to projects accessible by the authenticated user.
 */
export async function getFlags(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { projectId, environmentId, enabled, search } = req.query;
    const where: any = {};

    // Authorization scoping: Non-admins can only see flags from their own projects
    if (user.role !== "ADMIN") {
      where.environment = {
        project: {
          userId: user.id,
        },
      };
    }

    if (environmentId && typeof environmentId === "string") {
      where.environmentId = environmentId;
    }

    if (projectId && typeof projectId === "string") {
      where.environment = {
        ...(where.environment || {}),
        projectId,
      };
    }

    if (enabled !== undefined) {
      where.enabled = enabled === "true";
    }

    if (search && typeof search === "string") {
      const term = search.trim().toLowerCase();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { key: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    const flags = await prisma.featureFlag.findMany({
      where,
      include: {
        environment: {
          include: {
            project: {
              select: { id: true, name: true, key: true },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: flags,
    });
  } catch (error: any) {
    console.error("List flags error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch feature flags.",
    });
  }
}

/**
 * GET /api/flags/:id
 * Retrieves a single feature flag (verifying project ownership)
 */
export async function getFlag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const flag = await prisma.featureFlag.findUnique({
      where: { id },
      include: {
        environment: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!flag) {
      res.status(404).json({ success: false, message: "Feature flag not found." });
      return;
    }

    if (user.role !== "ADMIN" && flag.environment.project.userId !== user.id) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have access to this feature flag." });
      return;
    }

    res.status(200).json({
      success: true,
      data: flag,
    });
  } catch (error: any) {
    console.error("Get flag error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve feature flag.",
    });
  }
}

/**
 * POST /api/flags
 * Creates a feature flag in an authorized project's environment
 */
export async function createFlag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { name, key, description, environmentId, enabled } = req.body;

    if (!name || !key || !environmentId) {
      res.status(400).json({
        success: false,
        message: "Name, key, and environmentId are required.",
      });
      return;
    }

    const env = await prisma.environment.findUnique({
      where: { id: environmentId },
      include: { project: true },
    });

    if (!env) {
      res.status(404).json({ success: false, message: "Target environment not found." });
      return;
    }

    if (user.role !== "ADMIN" && env.project.userId !== user.id) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have permission to add flags to this project." });
      return;
    }

    const flagKey = key.trim().toLowerCase();

    const existing = await prisma.featureFlag.findUnique({
      where: {
        environmentId_key: {
          environmentId,
          key: flagKey,
        },
      },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: `Flag with key "${flagKey}" already exists in environment "${env.name}".`,
      });
      return;
    }

    const flag = await prisma.featureFlag.create({
      data: {
        name: name.trim(),
        key: flagKey,
        description: description?.trim(),
        environmentId,
        enabled: Boolean(enabled),
      },
      include: {
        environment: {
          include: {
            project: true,
          },
        },
      },
    });

    await recordAuditLog({
      action: "flag_created",
      target: flag.name,
      environment: env.name.toLowerCase(),
      projectName: env.project.name,
      userId: user.id,
      userName: user.name || "User",
    });

    res.status(201).json({
      success: true,
      data: flag,
      message: "Feature flag created successfully.",
    });
  } catch (error: any) {
    console.error("Create flag error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create feature flag.",
    });
  }
}

/**
 * PUT /api/flags/:id
 * Updates feature flag details (owner or admin only)
 */
export async function updateFlag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const { name, key, description } = req.body;

    const existing = await prisma.featureFlag.findUnique({
      where: { id },
      include: { environment: { include: { project: true } } },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Feature flag not found." });
      return;
    }

    if (user.role !== "ADMIN" && existing.environment.project.userId !== user.id) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this flag." });
      return;
    }

    const flagKey = key ? key.trim().toLowerCase() : existing.key;

    if (key && flagKey !== existing.key) {
      const duplicate = await prisma.featureFlag.findUnique({
        where: {
          environmentId_key: {
            environmentId: existing.environmentId,
            key: flagKey,
          },
        },
      });

      if (duplicate) {
        res.status(400).json({
          success: false,
          message: `A flag with key "${flagKey}" already exists in environment "${existing.environment.name}".`,
        });
        return;
      }
    }

    const updated = await prisma.featureFlag.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        key: flagKey,
        description: description !== undefined ? description?.trim() : undefined,
      },
      include: {
        environment: {
          include: {
            project: true,
          },
        },
      },
    });

    await recordAuditLog({
      action: "flag_updated",
      target: updated.name,
      environment: existing.environment.name.toLowerCase(),
      projectName: existing.environment.project.name,
      userId: user.id,
      userName: user.name || "User",
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: "Feature flag updated successfully.",
    });
  } catch (error: any) {
    console.error("Update flag error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update feature flag.",
    });
  }
}

/**
 * PATCH /api/flags/:id/toggle
 * Atomically toggles a feature flag (owner or admin only)
 */
export async function toggleFlag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const existing = await prisma.featureFlag.findUnique({
      where: { id },
      include: { environment: { include: { project: true } } },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Feature flag not found." });
      return;
    }

    if (user.role !== "ADMIN" && existing.environment.project.userId !== user.id) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have permission to toggle this flag." });
      return;
    }

    const nextState = !existing.enabled;

    const updated = await prisma.featureFlag.update({
      where: { id },
      data: { enabled: nextState },
      include: {
        environment: {
          include: {
            project: true,
          },
        },
      },
    });

    await recordAuditLog({
      action: nextState ? "flag_enabled" : "flag_disabled",
      target: updated.name,
      environment: existing.environment.name.toLowerCase(),
      projectName: existing.environment.project.name,
      userId: user.id,
      userName: user.name || "User",
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: `${updated.name} is now ${updated.enabled ? "enabled" : "disabled"}.`,
    });
  } catch (error: any) {
    console.error("Toggle flag error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to toggle feature flag.",
    });
  }
}

/**
 * DELETE /api/flags/:id
 * Deletes a feature flag (owner or admin only)
 */
export async function deleteFlag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const existing = await prisma.featureFlag.findUnique({
      where: { id },
      include: { environment: { include: { project: true } } },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Feature flag not found." });
      return;
    }

    if (user.role !== "ADMIN" && existing.environment.project.userId !== user.id) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have permission to delete this flag." });
      return;
    }

    const deleted = await prisma.featureFlag.delete({
      where: { id },
    });

    await recordAuditLog({
      action: "flag_deleted",
      target: existing.name,
      environment: existing.environment.name.toLowerCase(),
      projectName: existing.environment.project.name,
      userId: user.id,
      userName: user.name || "User",
    });

    res.status(200).json({
      success: true,
      data: deleted,
      message: `Feature flag "${deleted.name}" deleted successfully.`,
    });
  } catch (error: any) {
    console.error("Delete flag error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete feature flag.",
    });
  }
}

