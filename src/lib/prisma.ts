import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import dotenv from "dotenv"
dotenv.config()

const DATABASE_URL=process.env.DATABASE_URL

if(!DATABASE_URL){
    throw new Error("Database url not found")
}
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma