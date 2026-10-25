import prisma from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.service.js";
export const DEFAULT_ENVIRONMENTS = [
    "Development",
    "Staging",
    "Production",
];
export async function listProjects(userId) {
    return await prisma.project.findMany({
        where: userId ? { userId } : undefined,
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
}
export async function getProjectById(id) {
    return await prisma.project.findUnique({
        where: { id },
        include: {
            environments: {
                include: {
                    featureFlags: true,
                },
            },
        },
    });
}
export async function getProjectByKey(key) {
    return await prisma.project.findUnique({
        where: { key },
        include: {
            environments: {
                include: {
                    featureFlags: true,
                },
            },
        },
    });
}
export async function createProject(userId, userName, data) {
    const existingKey = await prisma.project.findUnique({
        where: { key: data.key },
    });
    if (existingKey) {
        throw new Error(`A project with key "${data.key}" already exists.`);
    }
    const project = await prisma.project.create({
        data: {
            name: data.name,
            key: data.key,
            description: data.description,
            userId,
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
    await recordAuditLog({
        action: "project_created",
        target: project.name,
        projectName: project.name,
        userId,
        userName,
    });
    return project;
}
export async function updateProject(id, userId, userName, data) {
    if (data.key) {
        const existingKey = await prisma.project.findFirst({
            where: {
                key: data.key,
                NOT: { id },
            },
        });
        if (existingKey) {
            throw new Error(`A project with key "${data.key}" already exists.`);
        }
    }
    const project = await prisma.project.update({
        where: { id },
        data,
        include: {
            environments: true,
        },
    });
    await recordAuditLog({
        action: "project_updated",
        target: project.name,
        projectName: project.name,
        userId,
        userName,
    });
    return project;
}
export async function deleteProject(id, userId, userName) {
    const existing = await prisma.project.findUnique({
        where: { id },
    });
    if (!existing) {
        throw new Error("Project not found.");
    }
    await prisma.project.delete({
        where: { id },
    });
    await recordAuditLog({
        action: "project_deleted",
        target: existing.name,
        projectName: existing.name,
        userId,
        userName,
    });
    return existing;
}
