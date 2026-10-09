import { Router } from "express";
import projects from "../services/projects.js";

const router = Router();

router.use("/projects", projects);

export default router;