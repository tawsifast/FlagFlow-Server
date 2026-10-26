import prisma from "../lib/prisma.js";
/**
 * GET /api/developer/overview
 * Provides overview statistics for the developer's authorized projects
 */
export async function getDeveloperOverview(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const whereProject = user.role === "ADMIN" ? {} : { userId: user.id };
        const [projects, environments, flags, recentLogs] = await Promise.all([
            prisma.project.count({ where: whereProject }),
            prisma.environment.count({
                where: { project: whereProject },
            }),
            prisma.featureFlag.findMany({
                where: { environment: { project: whereProject } },
                select: { id: true, enabled: true },
            }),
            prisma.auditLog.findMany({
                where: user.role === "ADMIN" ? {} : { userId: user.id },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
        ]);
        const enabledCount = flags.filter((f) => f.enabled).length;
        res.status(200).json({
            success: true,
            data: {
                totalProjects: projects,
                totalEnvironments: environments,
                totalFlags: flags.length,
                enabledFlags: enabledCount,
                disabledFlags: flags.length - enabledCount,
                recentActivity: recentLogs,
            },
        });
    }
    catch (error) {
        console.error("Developer overview error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch developer overview.",
        });
    }
}
