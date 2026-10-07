import { Router } from "express";
import users from "../services/users.js";
import categories from "../services/categories.js";
import events from "../services/events.js";
import orders from "../services/orders.js";
import tickets from "../services/tickets.js";
import reviews from "../services/reviews.js";
import organizers from "../services/organizers.js";
import admin from "../services/admin.js";

const router = Router();

router.use("/users", users);
router.use("/categories", categories);
router.use("/events", events);
router.use("/orders", orders);
router.use("/tickets", tickets);
router.use("/reviews", reviews);
router.use("/organizers", organizers);
router.use("/admin", admin);

export default router;