import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth-middleware.js";
// Service Handlers
import * as featureEvaluationService from "../services/feature-evaluation.js";
import * as userService from "../services/user.js";
import * as developerService from "../services/developer.js";
import * as projectsService from "../services/projects.js";
import * as environmentsService from "../services/environments.js";
import * as flagsService from "../services/flags.js";
import * as auditLogsService from "../services/audit-logs.js";
import * as adminService from "../services/admin.js";
const router = Router();
// ============================================================================
// 1. Feature Flag Evaluation (Public / External App & SDK API)
// ============================================================================
router.get("/features/:key", featureEvaluationService.evaluateFlag);
// ============================================================================
// 2. User Profile Operations (Authenticated)
// ============================================================================
router.get("/user/me", requireAuth, userService.getCurrentUser);
router.put("/user/profile", requireAuth, userService.updateUserProfile);
router.get("/user/projects", requireAuth, userService.getUserProjects);
// ============================================================================
// 3. Projects Management (Server-Side Ownership & Role Verification)
// ============================================================================
router.get("/projects", requireAuth, projectsService.getProjects);
router.get("/projects/:id", requireAuth, projectsService.getProject);
router.post("/projects", requireAuth, projectsService.createProject);
router.put("/projects/:id", requireAuth, projectsService.updateProject);
router.delete("/projects/:id", requireAuth, projectsService.deleteProject);
// ============================================================================
// 4. Environments Management (Server-Side Project Scoping & Verification)
// ============================================================================
router.get("/environments", requireAuth, environmentsService.getEnvironments);
router.get("/environments/:id", requireAuth, environmentsService.getEnvironment);
router.post("/environments", requireAuth, environmentsService.createEnvironment);
router.put("/environments/:id", requireAuth, environmentsService.updateEnvironment);
router.delete("/environments/:id", requireAuth, environmentsService.deleteEnvironment);
// ============================================================================
// 5. Feature Flags Management (Server-Side Scoping, Toggle & Verification)
// ============================================================================
router.get("/flags", requireAuth, flagsService.getFlags);
router.get("/flags/:id", requireAuth, flagsService.getFlag);
router.post("/flags", requireAuth, flagsService.createFlag);
router.put("/flags/:id", requireAuth, flagsService.updateFlag);
router.patch("/flags/:id/toggle", requireAuth, flagsService.toggleFlag);
router.delete("/flags/:id", requireAuth, flagsService.deleteFlag);
// ============================================================================
// 6. Audit Logging (Scoped to User / System-Wide for Admin)
// ============================================================================
router.get("/audit-logs", requireAuth, auditLogsService.getAuditLogs);
// ============================================================================
// 7. Developer Workspace (DEVELOPER or ADMIN Role)
// ============================================================================
router.get("/developer/overview", requireAuth, requireRole(["DEVELOPER", "ADMIN"]), developerService.getDeveloperOverview);
// ============================================================================
// 8. Administrative Operations (ADMIN Role Strictly Enforced)
// ============================================================================
router.get("/admin/stats", requireAuth, requireRole(["ADMIN"]), adminService.getAdminStats);
router.get("/admin/users", requireAuth, requireRole(["ADMIN"]), adminService.getUsers);
router.put("/admin/users/:id/role", requireAuth, requireRole(["ADMIN"]), adminService.updateUserRole);
router.delete("/admin/users/:id", requireAuth, requireRole(["ADMIN"]), adminService.deleteUser);
export default router;
