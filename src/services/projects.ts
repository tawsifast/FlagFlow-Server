import type { Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../lib/auth-middleware.js";
import { recordAuditLog } from "./audit-logs.js";

export const DEFAULT_ENVIRONMENTS = ["Development", "Staging", "Production"];

// Helper: verify user has permission to manage a project (must be owner or ADMIN)
export async function verifyProjectOwnership(projectId: string, userId: string, role: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return { authorized: false, notFound: true, project: null };
  }

  if (role === "ADMIN" || project.userId === userId) {
    return { authorized: true, notFound: false, project };
  }

  return { authorized: false, notFound: false, project };
}

/**
 * GET /api/projects
 * Lists projects accessible to the user:
 * - ADMIN: All projects
 * - Non-admin: Only projects owned by the user
 */
export async function getProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const where = user.role === "ADMIN" ? {} : { userId: user.id };

    const projects = await prisma.project.findMany({
      where,
      include: {
        environments: {
          include: {
            featureFlags: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error: any) {
    console.error("List projects error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch projects.",
    });
  }
}

/**
 * GET /api/projects/:id
 * Retrieves a single project if authorized
 */
export async function getProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const { authorized, notFound } = await verifyProjectOwnership(id, user.id, user.role);

    if (notFound) {
      res.status(404).json({ success: false, message: "Project not found." });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have access to this project." });
      return;
    }

    const fullProject = await prisma.project.findUnique({
      where: { id },
      include: {
        environments: {
          include: {
            featureFlags: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: fullProject,
    });
  } catch (error: any) {
    console.error("Get project error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve project.",
    });
  }
}

/**
 * POST /api/projects
 * Creates a project with default environments inside an atomic transaction
 */
export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { name, key, description } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Project name is required and must be at least 2 characters.",
      });
      return;
    }

    const projectKey = (key || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();

    const existingKey = await prisma.project.findUnique({
      where: { key: projectKey },
    });

    if (existingKey) {
      res.status(400).json({
        success: false,
        message: `A project with key "${projectKey}" already exists.`,
      });
      return;
    }

    // Atomic transaction: create project and its 3 default environments together
    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: name.trim(),
          key: projectKey,
          description: description?.trim(),
          userId: user.id,
          environments: {
            create: DEFAULT_ENVIRONMENTS.map((envName) => ({
              name: envName,
            })),
          },
        },
        include: {
          environments: true,
        },
      });

      return project;
    });

    await recordAuditLog({
      action: "project_created",
      target: newProject.name,
      projectName: newProject.name,
      userId: user.id,
      userName: user.name || "User",
    });

    res.status(201).json({
      success: true,
      data: newProject,
      message: "Project created successfully with default environments.",
    });
  } catch (error: any) {
    console.error("Create project error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create project.",
    });
  }
}

/**
 * PUT /api/projects/:id
 * Updates project details (owner or admin only)
 */
export async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const { authorized, notFound, project } = await verifyProjectOwnership(id, user.id, user.role);

    if (notFound) {
      res.status(404).json({ success: false, message: "Project not found." });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this project." });
      return;
    }

    const { name, key, description } = req.body;

    if (key && key !== project!.key) {
      const existingKey = await prisma.project.findFirst({
        where: {
          key: key.trim(),
          NOT: { id },
        },
      });

      if (existingKey) {
        res.status(400).json({
          success: false,
          message: `A project with key "${key.trim()}" already exists.`,
        });
        return;
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        key: key ? key.trim() : undefined,
        description: description !== undefined ? description?.trim() : undefined,
      },
      include: {
        environments: true,
      },
    });

    await recordAuditLog({
      action: "project_updated",
      target: updated.name,
      projectName: updated.name,
      userId: user.id,
      userName: user.name || "User",
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: "Project updated successfully.",
    });
  } catch (error: any) {
    console.error("Update project error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update project.",
    });
  }
}

/**
 * DELETE /api/projects/:id
 * Deletes a project (owner or admin only)
 */
export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const { authorized, notFound, project } = await verifyProjectOwnership(id, user.id, user.role);

    if (notFound) {
      res.status(404).json({ success: false, message: "Project not found." });
      return;
    }

    if (!authorized) {
      res.status(403).json({ success: false, message: "Forbidden: You do not have permission to delete this project." });
      return;
    }

    const deleted = await prisma.project.delete({
      where: { id },
    });

    await recordAuditLog({
      action: "project_deleted",
      target: deleted.name,
      projectName: deleted.name,
      userId: user.id,
      userName: user.name || "User",
    });

    res.status(200).json({
      success: true,
      data: deleted,
      message: `Project "${deleted.name}" deleted successfully.`,
    });
  } catch (error: any) {
    console.error("Delete project error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete project.",
    });
  }
}
