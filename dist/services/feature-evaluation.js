import prisma from "../lib/prisma.js";
/**
 * GET /api/features/:key
 * Evaluates a feature flag state for external applications and SDKs.
 *
 * Security & Privacy:
 * - Never leaks internal database IDs, user accounts, or private configurations.
 * - Always returns a fail-safe boolean response.
 * - Resolves scope using project identifier (x-project-key header or ?project= query)
 *   and environment (x-environment header or ?environment= query).
 */
export async function evaluateFlag(req, res) {
    const flagKey = (req.params.key || "").trim().toLowerCase();
    try {
        const environmentHeader = req.headers["x-environment"];
        const environmentQuery = req.query.environment;
        const envName = (environmentHeader || environmentQuery || "production").trim().toLowerCase();
        const projectHeader = req.headers["x-project-key"];
        const projectQuery = req.query.project;
        const projectKey = (projectHeader || projectQuery || "").trim().toLowerCase();
        // Build the query scope
        const where = {
            key: flagKey,
            environment: {
                name: {
                    equals: envName,
                    mode: "insensitive",
                },
            },
        };
        if (projectKey) {
            where.environment.project = {
                key: {
                    equals: projectKey,
                    mode: "insensitive",
                },
            };
        }
        const flag = await prisma.featureFlag.findFirst({
            where,
            select: {
                key: true,
                enabled: true,
            },
        });
        // Fail-safe default: if not found, evaluate to disabled (false)
        if (!flag) {
            res.status(200).json({
                key: flagKey,
                enabled: false,
            });
            return;
        }
        // Return strictly the minimal evaluation payload
        res.status(200).json({
            key: flag.key,
            enabled: flag.enabled,
        });
    }
    catch (error) {
        console.error("Feature evaluation error:", error);
        // Even in case of error, fail safe to disabled without leaking stack traces
        res.status(200).json({
            key: flagKey,
            enabled: false,
        });
    }
}
