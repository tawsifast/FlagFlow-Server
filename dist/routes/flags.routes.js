import { Router } from "express";
import { listFlags, getFlagById, createFlag, updateFlag, toggleFlag, deleteFlag, } from "../services/flags.service.js";
import { requireAuth } from "../lib/auth-middleware.js";
const router = Router();
// GET /api/flags
router.get("/", async (req, res) => {
    try {
        const { projectId, environmentId, enabled, search } = req.query;
        const flags = await listFlags({
            projectId: projectId,
            environmentId: environmentId,
            enabled: enabled !== undefined ? enabled === "true" : undefined,
            search: search,
        });
        res.status(200).json({
            success: true,
            data: flags,
        });
    }
    catch (error) {
        console.error("List flags error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch feature flags.",
        });
    }
});
// GET /api/flags/:id
router.get("/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const flag = await getFlagById(id);
        if (!flag) {
            res.status(404).json({
                success: false,
                message: "Feature flag not found.",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: flag,
        });
    }
    catch (error) {
        console.error("Get flag error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve feature flag.",
        });
    }
});
// POST /api/flags
router.post("/", requireAuth, async (req, res) => {
    try {
        const { name, key, description, environmentId, enabled } = req.body;
        if (!name || !key || !environmentId) {
            res.status(400).json({
                success: false,
                message: "Name, key, and environmentId are required.",
            });
            return;
        }
        const userId = req.user.id;
        const userName = req.user.name || "User";
        const flag = await createFlag(userId, userName, {
            name: name.trim(),
            key: key.trim().toLowerCase(),
            description: description?.trim(),
            environmentId,
            enabled: Boolean(enabled),
        });
        res.status(201).json({
            success: true,
            data: flag,
            message: "Feature flag created successfully.",
        });
    }
    catch (error) {
        console.error("Create flag error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to create feature flag.",
        });
    }
});
// PUT /api/flags/:id
router.put("/:id", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { name, key, description } = req.body;
        const userId = req.user.id;
        const userName = req.user.name || "User";
        const updated = await updateFlag(id, userId, userName, {
            name: name?.trim(),
            key: key?.trim().toLowerCase(),
            description: description?.trim(),
        });
        res.status(200).json({
            success: true,
            data: updated,
            message: "Feature flag updated successfully.",
        });
    }
    catch (error) {
        console.error("Update flag error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to update feature flag.",
        });
    }
});
// PATCH /api/flags/:id/toggle
router.patch("/:id/toggle", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const userName = req.user.name || "User";
        const toggled = await toggleFlag(id, userId, userName);
        res.status(200).json({
            success: true,
            data: toggled,
            message: `${toggled.name} is now ${toggled.enabled ? "enabled" : "disabled"}.`,
        });
    }
    catch (error) {
        console.error("Toggle flag error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to toggle feature flag.",
        });
    }
});
// DELETE /api/flags/:id
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const userName = req.user.name || "User";
        const deleted = await deleteFlag(id, userId, userName);
        res.status(200).json({
            success: true,
            data: deleted,
            message: `Feature flag "${deleted.name}" deleted successfully.`,
        });
    }
    catch (error) {
        console.error("Delete flag error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to delete feature flag.",
        });
    }
});
export default router;
