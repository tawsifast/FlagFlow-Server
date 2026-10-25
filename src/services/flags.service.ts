import prisma from "../lib/prisma.js";
import { recordAuditLog } from "./audit-logs.service.js";

export async function listFlags(filter?: {
  projectId?: string;
  environmentId?: string;
  enabled?: boolean;
  search?: string;
}) {
  const where: any = {};

  if (filter?.environmentId) {
    where.environmentId = filter.environmentId;
  }

  if (filter?.projectId) {
    where.environment = {
      projectId: filter.projectId,
    };
  }

  if (typeof filter?.enabled === "boolean") {
    where.enabled = filter.enabled;
  }

  if (filter?.search) {
    const term = filter.search.trim().toLowerCase();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { key: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  return await prisma.featureFlag.findMany({
    where,
    include: {
      environment: {
        include: {
          project: {
            select: { id: true, name: true, key: true },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getFlagById(id: string) {
  return await prisma.featureFlag.findUnique({
    where: { id },
    include: {
      environment: {
        include: {
          project: true,
        },
      },
    },
  });
}

export async function createFlag(
  userId: string,
  userName: string,
  data: {
    name: string;
    key: string;
    description?: string;
    environmentId: string;
    enabled?: boolean;
  }
) {
  const env = await prisma.environment.findUnique({
    where: { id: data.environmentId },
    include: { project: true },
  });

  if (!env) {
    throw new Error("Target environment not found.");
  }

  const existing = await prisma.featureFlag.findUnique({
    where: {
      environmentId_key: {
        environmentId: data.environmentId,
        key: data.key,
      },
    },
  });

  if (existing) {
    throw new Error(
      `Flag with key "${data.key}" already exists in environment "${env.name}".`
    );
  }

  const flag = await prisma.featureFlag.create({
    data: {
      name: data.name,
      key: data.key,
      description: data.description,
      enabled: data.enabled ?? false,
      environmentId: data.environmentId,
    },
    include: {
      environment: {
        include: {
          project: true,
        },
      },
    },
  });

  await recordAuditLog({
    action: "flag_created",
    target: flag.name,
    environment: env.name.toLowerCase(),
    projectName: env.project.name,
    userId,
    userName,
  });

  return flag;
}

export async function updateFlag(
  id: string,
  userId: string,
  userName: string,
  data: {
    name?: string;
    key?: string;
    description?: string;
  }
) {
  const existing = await prisma.featureFlag.findUnique({
    where: { id },
    include: { environment: { include: { project: true } } },
  });

  if (!existing) {
    throw new Error("Feature flag not found.");
  }

  if (data.key && data.key !== existing.key) {
    const duplicate = await prisma.featureFlag.findUnique({
      where: {
        environmentId_key: {
          environmentId: existing.environmentId,
          key: data.key,
        },
      },
    });

    if (duplicate) {
      throw new Error(
        `A flag with key "${data.key}" already exists in environment "${existing.environment.name}".`
      );
    }
  }

  const updated = await prisma.featureFlag.update({
    where: { id },
    data,
    include: {
      environment: {
        include: {
          project: true,
        },
      },
    },
  });

  await recordAuditLog({
    action: "flag_updated",
    target: updated.name,
    environment: existing.environment.name.toLowerCase(),
    projectName: existing.environment.project.name,
    userId,
    userName,
  });

  return updated;
}

export async function toggleFlag(id: string, userId: string, userName: string) {
  const existing = await prisma.featureFlag.findUnique({
    where: { id },
    include: { environment: { include: { project: true } } },
  });

  if (!existing) {
    throw new Error("Feature flag not found.");
  }

  const nextState = !existing.enabled;

  const updated = await prisma.featureFlag.update({
    where: { id },
    data: { enabled: nextState },
    include: {
      environment: {
        include: {
          project: true,
        },
      },
    },
  });

  await recordAuditLog({
    action: nextState ? "flag_enabled" : "flag_disabled",
    target: updated.name,
    environment: existing.environment.name.toLowerCase(),
    projectName: existing.environment.project.name,
    userId,
    userName,
  });

  return updated;
}

export async function deleteFlag(id: string, userId: string, userName: string) {
  const existing = await prisma.featureFlag.findUnique({
    where: { id },
    include: { environment: { include: { project: true } } },
  });

  if (!existing) {
    throw new Error("Feature flag not found.");
  }

  await prisma.featureFlag.delete({
    where: { id },
  });

  await recordAuditLog({
    action: "flag_deleted",
    target: existing.name,
    environment: existing.environment.name.toLowerCase(),
    projectName: existing.environment.project.name,
    userId,
    userName,
  });

  return existing;
}

export async function evaluateFlag(key: string, environment?: string, projectKey?: string) {
  const envName = (environment || "production").toLowerCase();

  const flag = await prisma.featureFlag.findFirst({
    where: {
      key,
      environment: {
        name: {
          equals: envName,
          mode: "insensitive",
        },
        project: projectKey
          ? {
              key: {
                equals: projectKey,
                mode: "insensitive",
              },
            }
          : undefined,
      },
    },
    include: {
      environment: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!flag) {
    return {
      found: false,
      key,
      enabled: false,
      environment: envName,
    };
  }

  return {
    found: true,
    key: flag.key,
    name: flag.name,
    enabled: flag.enabled,
    environment: flag.environment.name.toLowerCase(),
    project: flag.environment.project.key,
  };
}

