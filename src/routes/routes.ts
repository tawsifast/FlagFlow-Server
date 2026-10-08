import { Router } from "express";

// import environments from "../services/environments.js";

import projects from "../services/projects.js";
// import featureFlags from "../services/feature-flags.js";

const router = Router();

router.use("/projects", projects);
// router.use("/environments", environments);
// router.use("/feature-flags", featureFlags);

export default router;