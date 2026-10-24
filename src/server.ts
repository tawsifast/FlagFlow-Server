import app from "./app.js";


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Welcome to the server ${PORT}`);
});

import prisma from "./lib/prisma.js";

async function createTestUser() {
  const user = await prisma.user.upsert({
    where: {
      email: "test@flagflow.dev",
    },
    update: {},
    create: {
      name: "FlagFlow Test User",
      email: "test@flagflow.dev",
      password: "temporary-test-password",
      role: "USER",
    },
  });

  console.log("Test user ID:", user.id);
}

createTestUser().catch(console.error);