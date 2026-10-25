import prisma from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.service.js";
export async function listEnvironments(projectId) {
    return await prisma.environment.findMany({
        where: projectId ? { projectId } : undefined,
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
}
export async function getEnvironmentById(id) {
    return await prisma.environment.findUnique({
        where: { id },
        include: {
            project: true,
            featureFlags: true,
        },
    });
}
export async function createEnvironment(userId, userName, data) {
    const project = await prisma.project.findUnique({
        where: { id: data.projectId },
    });
    if (!project) {
        throw new Error("Project not found.");
    }
    const existing = await prisma.environment.findUnique({
        where: {
            projectId_name: {
                projectId: data.projectId,
                name: data.name,
            },
        },
    });
    if (existing) {
        throw new Error(`Environment "${data.name}" already exists for this project.`);
    }
    const env = await prisma.environment.create({
        data: {
            name: data.name,
            projectId: data.projectId,
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
        userId,
        userName,
    });
    return env;
}
export async function updateEnvironment(id, userId, userName, data) {
    const existing = await prisma.environment.findUnique({
        where: { id },
        include: { project: true },
    });
    if (!existing) {
        throw new Error("Environment not found.");
    }
    const duplicate = await prisma.environment.findFirst({
        where: {
            projectId: existing.projectId,
            name: data.name,
            NOT: { id },
        },
    });
    if (duplicate) {
        throw new Error(`An environment named "${data.name}" already exists in this project.`);
    }
    const updated = await prisma.environment.update({
        where: { id },
        data: { name: data.name },
    });
    await recordAuditLog({
        action: "environment_updated",
        target: updated.name,
        environment: updated.name.toLowerCase(),
        projectName: existing.project.name,
        userId,
        userName,
    });
    return updated;
}
export async function deleteEnvironment(id, userId, userName) {
    const existing = await prisma.environment.findUnique({
        where: { id },
        include: { project: true },
    });
    if (!existing) {
        throw new Error("Environment not found.");
    }
    await prisma.environment.delete({
        where: { id },
    });
    await recordAuditLog({
        action: "environment_deleted",
        target: existing.name,
        environment: existing.name.toLowerCase(),
        projectName: existing.project.name,
        userId,
        userName,
    });
    return existing;
}
