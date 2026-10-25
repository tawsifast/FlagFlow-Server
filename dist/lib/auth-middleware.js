import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
export async function requireAuth(req, res, next) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        if (!session || !session.user) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: Please log in to continue.",
            });
            return;
        }
        req.user = session.user;
        req.session = session.session;
        next();
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({
            success: false,
            message: "Authentication failed.",
        });
    }
}
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: "Forbidden: Insufficient permissions for this action.",
            });
            return;
        }
        next();
    };
}
