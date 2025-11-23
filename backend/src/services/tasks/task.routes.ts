import express from 'express';
import { type Task } from '../../generated/prisma/client.js'
import { Router } from 'express';
import {
    createTask,
    updateTask,
    deleteTask,
} from './task.service';

const router: Router = Router();

router.post('/', async (req: express.Request, res: express.Response) => {
    const { start_time, end_time, user_id }: Task = req.body;
    try {
        const task: Task = await createTask(new Date(start_time), new Date(end_time), user_id);
        res.status(201).json(JSON.stringify(task));
    } catch (error) {
        res.status(400).json({ error: '400: Bad Request' });
        console.log(error);
    }
});

router.put('/:id', async (req: express.Request, res: express.Response) => {
    const id: number = Number(req.params.id);
    const data: Task = req.body;
    try {
        const task: Task | null = await updateTask(id, data);
        if (task) {
            res.json(task);
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Task update failed' });
    }
});

router.delete('/:id', async (req: express.Request, res: express.Response) => {
    const id: number = Number(req.params.id);
    try {
        const task: Task | null = await deleteTask(id);
        if (task) {
            res.json({ message: 'Task deleted', task });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Task deletion failed' });
    }
});

export default router;