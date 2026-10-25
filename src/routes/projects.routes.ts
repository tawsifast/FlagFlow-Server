import { Router } from "express";
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from "../services/projects.service.js";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth-middleware.js";

const router = Router();

// GET /api/projects
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await listProjects();
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
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id as string;
    const project = await getProjectById(id);
    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    console.error("Get project error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve project.",
    });
  }
});

// POST /api/projects
router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, key, description } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Project name is required and must be at least 2 characters.",
      });
      return;
    }

    const projectKey = (key || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();

    const userId = req.user!.id;
    const userName = req.user!.name || "User";

    const project = await createProject(userId, userName, {
      name: name.trim(),
      key: projectKey,
      description: description?.trim(),
    });

    res.status(201).json({
      success: true,
      data: project,
      message: "Project created successfully with default environments.",
    });
  } catch (error: any) {
    console.error("Create project error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create project.",
    });
  }
});

// PUT /api/projects/:id
router.put("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, key, description } = req.body;
    const userId = req.user!.id;
    const userName = req.user!.name || "User";

    const updated = await updateProject(id, userId, userName, {
      name: name?.trim(),
      key: key?.trim(),
      description: description?.trim(),
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
});

// DELETE /api/projects/:id
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const userName = req.user!.name || "User";

    const deleted = await deleteProject(id, userId, userName);

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
});

export default router;
