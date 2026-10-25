import app from "./app.js";
import prisma from "./lib/prisma.js";
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 FlagFlow Server running on http://localhost:${PORT}`);
});
async function ensureTestUser() {
    try {
        const user = await prisma.user.upsert({
            where: {
                email: "test@flagflow.dev",
            },
            update: {},
            create: {
                name: "FlagFlow Test User",
                email: "test@flagflow.dev",
                emailVerified: true,
                password: "temporary-test-password",
                role: "ADMIN",
            },
        });
        console.log(`Seed admin user verified: ${user.email} (ID: ${user.id})`);
    }
    catch (error) {
        console.warn("Could not seed test user:", error);
    }
}
ensureTestUser();
