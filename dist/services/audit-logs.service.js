import prisma from "../lib/prisma.js";
export async function recordAuditLog(input) {
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
    }
    catch (error) {
        console.error("Failed to record audit log:", error);
        return null;
    }
}
export async function getAuditLogs(filter) {
    const where = {};
    if (filter?.action && filter.action !== "all") {
        where.action = filter.action;
    }
    if (filter?.environment && filter.environment !== "all") {
        where.environment = filter.environment;
    }
    if (filter?.userName && filter.userName !== "all") {
        where.userName = filter.userName;
    }
    if (filter?.range && filter.range !== "all") {
        const now = new Date();
        const pastTime = new Date(filter.range === "24h"
            ? now.getTime() - 24 * 60 * 60 * 1000
            : now.getTime() - 7 * 24 * 60 * 60 * 1000);
        where.createdAt = {
            gte: pastTime,
        };
    }
    return await prisma.auditLog.findMany({
        where,
        orderBy: {
            createdAt: "desc",
        },
        take: 100,
    });
}
