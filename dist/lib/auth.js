import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import prisma from "./prisma.js";
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET || "flagflow-dev-secret-key-32-chars-long!",
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "USER",
                input: false,
            },
        },
    },
    trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],
});
