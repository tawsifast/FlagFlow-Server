import { Router } from "express";
import { listEnvironments, getEnvironmentById, createEnvironment, updateEnvironment, deleteEnvironment, } from "../services/environments.service.js";
import { requireAuth } from "../lib/auth-middleware.js";
const router = Router();
// GET /api/environments
router.get("/", async (req, res) => {
    try {
        const projectId = req.query.projectId;
        const environments = await listEnvironments(projectId);
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
});
// GET /api/environments/:id
router.get("/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const env = await getEnvironmentById(id);
        if (!env) {
            res.status(404).json({
                success: false,
                message: "Environment not found.",
            });
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
});
// POST /api/environments
router.post("/", requireAuth, async (req, res) => {
    try {
        const { name, projectId } = req.body;
        if (!name || !projectId) {
            res.status(400).json({
                success: false,
                message: "Environment name and projectId are required.",
            });
            return;
        }
        const userId = req.user.id;
        const userName = req.user.name || "User";
        const env = await createEnvironment(userId, userName, {
            name: name.trim(),
            projectId,
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
});
// PUT /api/environments/:id
router.put("/:id", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { name } = req.body;
        if (!name || typeof name !== "string") {
            res.status(400).json({
                success: false,
                message: "Environment name is required.",
            });
            return;
        }
        const userId = req.user.id;
        const userName = req.user.name || "User";
        const updated = await updateEnvironment(id, userId, userName, {
            name: name.trim(),
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
});
// DELETE /api/environments/:id
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const userName = req.user.name || "User";
        const deleted = await deleteEnvironment(id, userId, userName);
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
});
export default router;
