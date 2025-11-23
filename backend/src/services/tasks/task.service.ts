import prisma from "../../shared/prisma.js";
import { type Task } from "../../generated/prisma/client.js";
import { type User } from "../../generated/prisma/client.js";

export async function createTask(
    start_time: Date,
    end_time: Date,
    user_id: number
): Promise<Task> {
    return await prisma.task.create({
        data: { start_time, end_time, user_id }
    });
}

export async function updateTask(
    id: number,
    data: Partial<Omit<Task, "id">>
): Promise<Task | null> {
    return await prisma.task.update({
        where: { id },
        data
    });
}

export async function deleteTask(id: number): Promise<Task | null> {
    return await prisma.task.delete({ where: { id } });
}