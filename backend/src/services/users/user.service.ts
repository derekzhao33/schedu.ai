import { type User } from "../../generated/prisma/client.js";
import { type Task } from "../../generated/prisma/client.js";
import prisma from "../../shared/prisma.js"

export async function getUser(
    id: number, 
): Promise<User | null> {
    const result: User | null =  await prisma.user.findUnique({
        where: {
            id,
        }
    });

    return result;
}

export async function getUserByEmail(
    email: string, 
): Promise<User | null> {
    const result: User | null =  await prisma.user.findUnique({
        where: {
            email,
        }
    });

    return result;
}

export async function getAllTasksForUser(
    userId: number,
): Promise<Task[] | null> {
    return await prisma.task.findMany({
        where: {
            user: {
                is: {
                    id: userId,
                }
            }
        }
    });
}

export async function getTaskForUser(
    userId: number,
    taskId: number,
): Promise<Task | null> {
    return await prisma.task.findUnique({
        where: {
            user: {
                is: {
                    id: userId,
                }
            },

            id: taskId,
        }
    });
}
 
// TODO: Add email validation (with zod?)

export async function createUser(
    firstName: string, 
    lastName: string, 
    email: string, 
    password: string,
): Promise<User> {
    const result: User = await prisma.user.create({
        data: {
            first_name: firstName,
            last_name: lastName,
            email,
            password,
        },
    });

    return result;
}

export async function updateUser(
    id: number,
    data: Partial<User>,
): Promise<User> {
    const updatedUser: User = await prisma.user.update({
        where: { id },
        data,
    });
    return updatedUser;
}