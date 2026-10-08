import prisma from "../lib/prisma.js";

export const createProject = async (
  name: string,
  description: string | undefined,
  userId: string
) => {
  const project = await prisma.project.create({
    data: {
      name,
      description,
      userId,
    },
  });

  return project;
};

export const getProjects = async () => {
  const projects = await prisma.project.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return projects;
};

export const getProjectById = async (id: string) => {
  const project = await prisma.project.findUnique({
    where: {
      id,
    },
  });

  return project;
};

export const updateProject = async (
  id: string,
  name: string,
  description: string | undefined
) => {
  const project = await prisma.project.update({
    where: {
      id,
    },
    data: {
      name,
      description,
    },
  });

  return project;
};

export const deleteProject = async (id: string) => {
  const project = await prisma.project.delete({
    where: {
      id,
    },
  });

  return project;
};