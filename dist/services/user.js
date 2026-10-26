import prisma from "../lib/prisma.js";
/**
 * GET /api/user/me
 * Retrieves current authenticated user's profile and summary
 */
export async function getCurrentUser(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
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
                    },
                },
            },
        });
        if (!dbUser) {
            res.status(404).json({ success: false, message: "User not found." });
            return;
        }
        res.status(200).json({
            success: true,
            data: dbUser,
        });
    }
    catch (error) {
        console.error("Get current user error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve user profile.",
        });
    }
}
/**
 * PUT /api/user/profile
 * Updates the authenticated user's profile details
 */
export async function updateUserProfile(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const { name, image } = req.body;
        if (name !== undefined && (typeof name !== "string" || name.trim().length < 2)) {
            res.status(400).json({
                success: false,
                message: "Name must be at least 2 characters long.",
            });
            return;
        }
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                name: name ? name.trim() : undefined,
                image: image !== undefined ? image : undefined,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                image: true,
                updatedAt: true,
            },
        });
        res.status(200).json({
            success: true,
            data: updated,
            message: "Profile updated successfully.",
        });
    }
    catch (error) {
        console.error("Update user profile error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to update user profile.",
        });
    }
}
/**
 * GET /api/user/projects
 * Lists all projects owned by the authenticated user
 */
export async function getUserProjects(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const projects = await prisma.project.findMany({
            where: { userId: user.id },
            include: {
                environments: {
                    select: { id: true, name: true, createdAt: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json({
            success: true,
            data: projects,
        });
    }
    catch (error) {
        console.error("Get user projects error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve user projects.",
        });
    }
}
