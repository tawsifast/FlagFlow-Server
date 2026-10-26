import prisma from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.js";
import { verifyProjectOwnership } from "./projects.js";
/**
 * GET /api/environments
 * Lists environments. Scoped to projects accessible by the user.
 */
export async function getEnvironments(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const projectId = req.query.projectId;
        if (projectId) {
            const { authorized, notFound } = await verifyProjectOwnership(projectId, user.id, user.role);
            if (notFound) {
                res.status(404).json({ success: false, message: "Project not found." });
                return;
            }
            if (!authorized) {
                res.status(403).json({ success: false, message: "Forbidden: You do not have access to this project's environments." });
                return;
            }
        }
        const where = {};
        if (projectId) {
            where.projectId = projectId;
        }
        else if (user.role !== "ADMIN") {
            // Non-admins only see environments from their own projects
            where.project = { userId: user.id };
        }
        const environments = await prisma.environment.findMany({
            where,
            include: {
                project: {
                    select: { id: true, name: true, key: true },
                },
                featureFlags: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        });
        res.status(200).json({
            success: true,
            data: environments,
        });
    }
    catch (error) {
        console.error("List environments error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch environments.",
        });
    }
}
/**
 * GET /api/environments/:id
 * Retrieves a single environment if user is authorized to access the parent project
 */
export async function getEnvironment(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const id = req.params.id;
        const env = await prisma.environment.findUnique({
            where: { id },
            include: {
                project: true,
                featureFlags: true,
            },
        });
        if (!env) {
            res.status(404).json({ success: false, message: "Environment not found." });
            return;
        }
        if (user.role !== "ADMIN" && env.project.userId !== user.id) {
            res.status(403).json({ success: false, message: "Forbidden: You do not have access to this environment." });
            return;
        }
        res.status(200).json({
            success: true,
            data: env,
        });
    }
    catch (error) {
        console.error("Get environment error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve environment.",
        });
    }
}
/**
 * POST /api/environments
 * Creates an environment in an authorized project
 */
export async function createEnvironment(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const { name, projectId } = req.body;
        if (!name || typeof name !== "string" || !projectId) {
            res.status(400).json({
                success: false,
                message: "Environment name and projectId are required.",
            });
            return;
        }
        const { authorized, notFound, project } = await verifyProjectOwnership(projectId, user.id, user.role);
        if (notFound) {
            res.status(404).json({ success: false, message: "Project not found." });
            return;
        }
        if (!authorized) {
            res.status(403).json({ success: false, message: "Forbidden: You do not have permission to add environments to this project." });
            return;
        }
        const existing = await prisma.environment.findUnique({
            where: {
                projectId_name: {
                    projectId,
                    name: name.trim(),
                },
            },
        });
        if (existing) {
            res.status(400).json({
                success: false,
                message: `Environment "${name.trim()}" already exists for this project.`,
            });
            return;
        }
        const env = await prisma.environment.create({
            data: {
                name: name.trim(),
                projectId,
            },
            include: {
                featureFlags: true,
            },
        });
        await recordAuditLog({
            action: "environment_created",
            target: env.name,
            environment: env.name.toLowerCase(),
            projectName: project.name,
            userId: user.id,
            userName: user.name || "User",
        });
        res.status(201).json({
            success: true,
            data: env,
            message: "Environment created successfully.",
        });
    }
    catch (error) {
        console.error("Create environment error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to create environment.",
        });
    }
}
/**
 * PUT /api/environments/:id
 * Updates environment name (owner or admin only)
 */
export async function updateEnvironment(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const id = req.params.id;
        const { name } = req.body;
        if (!name || typeof name !== "string") {
            res.status(400).json({ success: false, message: "Environment name is required." });
            return;
        }
        const existing = await prisma.environment.findUnique({
            where: { id },
            include: { project: true },
        });
        if (!existing) {
            res.status(404).json({ success: false, message: "Environment not found." });
            return;
        }
        if (user.role !== "ADMIN" && existing.project.userId !== user.id) {
            res.status(403).json({ success: false, message: "Forbidden: You do not have permission to update this environment." });
            return;
        }
        const duplicate = await prisma.environment.findFirst({
            where: {
                projectId: existing.projectId,
                name: name.trim(),
                NOT: { id },
            },
        });
        if (duplicate) {
            res.status(400).json({
                success: false,
                message: `An environment named "${name.trim()}" already exists in this project.`,
            });
            return;
        }
        const updated = await prisma.environment.update({
            where: { id },
            data: { name: name.trim() },
        });
        await recordAuditLog({
            action: "environment_updated",
            target: updated.name,
            environment: updated.name.toLowerCase(),
            projectName: existing.project.name,
            userId: user.id,
            userName: user.name || "User",
        });
        res.status(200).json({
            success: true,
            data: updated,
            message: "Environment updated successfully.",
        });
    }
    catch (error) {
        console.error("Update environment error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to update environment.",
        });
    }
}
/**
 * DELETE /api/environments/:id
 * Deletes an environment (owner or admin only)
 */
export async function deleteEnvironment(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const id = req.params.id;
        const existing = await prisma.environment.findUnique({
            where: { id },
            include: { project: true },
        });
        if (!existing) {
            res.status(404).json({ success: false, message: "Environment not found." });
            return;
        }
        if (user.role !== "ADMIN" && existing.project.userId !== user.id) {
            res.status(403).json({ success: false, message: "Forbidden: You do not have permission to delete this environment." });
            return;
        }
        const deleted = await prisma.environment.delete({
            where: { id },
        });
        await recordAuditLog({
            action: "environment_deleted",
            target: existing.name,
            environment: existing.name.toLowerCase(),
            projectName: existing.project.name,
            userId: user.id,
            userName: user.name || "User",
        });
        res.status(200).json({
            success: true,
            data: deleted,
            message: `Environment "${deleted.name}" deleted successfully.`,
        });
    }
    catch (error) {
        console.error("Delete environment error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to delete environment.",
        });
    }
}
