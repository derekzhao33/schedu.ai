import { Router } from 'express';
import express from 'express';
import { type User } from "../../generated/prisma/client.js";
import { type Task } from "../../generated/prisma/client.js";
import { getUser, createUser, updateUser, getAllTasksForUser, getTaskForUser, getUserByEmail } from "./user.service.js";

const router: Router = Router();

router.post(
    '/login',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const { email, password }: {
            email: string;
            password: string;
        } = req.body;

        try {
            const user: User | null = await getUserByEmail(email);
            
            if (!user) {
                res.status(401).json({ error: 'Invalid email or password' });
                return;
            }

            // Simple password comparison (in production, use bcrypt)
            if (user.password !== password) {
                res.status(401).json({ error: 'Invalid email or password' });
                return;
            }

            // Return user without password
            const { password: _, ...userWithoutPassword } = user;
            res.status(200).json(userWithoutPassword);
        } catch (error) {
            res.status(400).json({ error: '400: Bad Request' });
            console.log(error);
        }
    }
);

router.get('/:id', async (req: express.Request, res: express.Response) => {
    const id: number = Number(req.params.id);
    const user: User | null = await getUser(id);

    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ error: '404: Not Found'});
    }
})

router.get('/:userId/tasks/:taskId', async (req: express.Request, res: express.Response) => {
    const userId: number = Number(req.params.userId);
    const taskId: number = Number(req.params.taskId);
    const task: Task | null = await getTaskForUser(userId, taskId);

    if (userId && taskId) {
        res.json(task);
    } else {
        res.status(404).json({ error: "404: Not found" });
    }
})

router.get('/:id/tasks', async (req: express.Request, res: express.Response) => {
    try {
        const tasks: Task[] | null = await getAllTasksForUser(Number(req.params.id));
        res.json(tasks);
    } catch (error) {
        res.status(404).json({ error: "400: Bad Request"});
        console.log(error);
    }
})

router.post(
    '/',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const { first_name, last_name, email, password }: {
            first_name: string;
            last_name: string;
            email: string;
            password: string;
        } = req.body;

        try {
            const user: User | null = await createUser(first_name, last_name, email, password);
            res.status(201).json(user);
        } catch (error) {
            res.status(400).json({ error: '400: Bad Request' });
            console.log(error);
        }
    }
);

router.put(
    '/:id',
    async (req: express.Request, res: express.Response): Promise<void> => {
        const id: number = Number(req.params.id);
        const data: Partial<User> = req.body;

        try {
            const user: User | null = await updateUser(id, data);
            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ error: '404: Not Found' });
            }
        } catch (error) {
            res.status(400).json({ error: '400: Bad Request' });
        }
    }
);

export default router;
