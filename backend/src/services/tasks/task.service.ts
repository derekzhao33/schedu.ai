import prisma from "../../shared/prisma.js";
import { type Task } from "../../generated/prisma/client.js";
import { type User } from "../../generated/prisma/client.js";
import { googleCalendarService } from "../google-calendar/google-calendar.service.js";

async function getUserTokens(userId: number) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            google_access_token: true,
            google_refresh_token: true,
            google_token_expiry: true
        }
    });
    return user;
}

async function syncCreateToGoogleCalendar(task: Task) {
    try {
        console.log('Starting Google Calendar sync for task:', task.id);
        const user = await getUserTokens(task.user_id);
        
        if (!user?.google_access_token || !user?.google_refresh_token) {
            console.log('User not connected to Google Calendar, skipping sync. Access token:', !!user?.google_access_token, 'Refresh token:', !!user?.google_refresh_token);
            return;
        }
        
        console.log('User has Google Calendar tokens, proceeding with sync');

        // Check if token is expired
        let accessToken = user.google_access_token;
        if (user.google_token_expiry && new Date() > user.google_token_expiry) {
            const newTokens = await googleCalendarService.refreshAccessToken(user.google_refresh_token);
            accessToken = newTokens.access_token!;
            
            // Update tokens in database
            await prisma.user.update({
                where: { id: task.user_id },
                data: {
                    google_access_token: newTokens.access_token,
                    google_token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
                }
            });
        }

        const googleEvent = await googleCalendarService.createEvent(
            accessToken,
            user.google_refresh_token,
            {
                name: task.name || 'Untitled Task',
                description: task.description || '',
                startTime: task.start_time,
                endTime: task.end_time
            }
        );

        // Update task with Google event ID
        await prisma.task.update({
            where: { id: task.id },
            data: { google_event_id: googleEvent.id }
        });

        console.log('Task synced to Google Calendar:', googleEvent.id);
    } catch (error) {
        console.error('Error syncing task to Google Calendar:', error);
        // Don't fail the task creation if Google sync fails
    }
}

async function syncUpdateToGoogleCalendar(task: Task) {
    try {
        if (!task.google_event_id) {
            console.log('Task has no Google event ID, skipping sync');
            return;
        }

        const user = await getUserTokens(task.user_id);
        
        if (!user?.google_access_token || !user?.google_refresh_token) {
            console.log('User not connected to Google Calendar, skipping sync');
            return;
        }

        // Check if token is expired
        let accessToken = user.google_access_token;
        if (user.google_token_expiry && new Date() > user.google_token_expiry) {
            const newTokens = await googleCalendarService.refreshAccessToken(user.google_refresh_token);
            accessToken = newTokens.access_token!;
            
            await prisma.user.update({
                where: { id: task.user_id },
                data: {
                    google_access_token: newTokens.access_token,
                    google_token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
                }
            });
        }

        await googleCalendarService.updateEvent(
            accessToken,
            user.google_refresh_token,
            task.google_event_id,
            {
                name: task.name || 'Untitled Task',
                description: task.description || '',
                startTime: task.start_time,
                endTime: task.end_time
            }
        );

        console.log('Task updated in Google Calendar:', task.google_event_id);
    } catch (error) {
        console.error('Error updating task in Google Calendar:', error);
    }
}

async function syncDeleteToGoogleCalendar(task: Task) {
    try {
        if (!task.google_event_id) {
            console.log('Task has no Google event ID, skipping sync');
            return;
        }

        const user = await getUserTokens(task.user_id);
        
        if (!user?.google_access_token || !user?.google_refresh_token) {
            console.log('User not connected to Google Calendar, skipping sync');
            return;
        }

        // Check if token is expired
        let accessToken = user.google_access_token;
        if (user.google_token_expiry && new Date() > user.google_token_expiry) {
            const newTokens = await googleCalendarService.refreshAccessToken(user.google_refresh_token);
            accessToken = newTokens.access_token!;
            
            await prisma.user.update({
                where: { id: task.user_id },
                data: {
                    google_access_token: newTokens.access_token,
                    google_token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null
                }
            });
        }

        await googleCalendarService.deleteEvent(
            accessToken,
            user.google_refresh_token,
            task.google_event_id
        );

        console.log('Task deleted from Google Calendar:', task.google_event_id);
    } catch (error) {
        console.error('Error deleting task from Google Calendar:', error);
    }
}

export async function createTask(
    start_time: Date,
    end_time: Date,
    user_id: number,
    name?: string,
    description?: string,
    priority?: string,
    color?: string
): Promise<Task> {
    const task = await prisma.task.create({
        data: { 
            start_time, 
            end_time, 
            user_id,
            name,
            description,
            priority,
            color
        }
    });

    // Sync to Google Calendar asynchronously
    syncCreateToGoogleCalendar(task);

    return task;
}

export async function updateTask(
    id: number,
    data: Partial<Omit<Task, "id">>,
    skipGoogleSync: boolean = false
): Promise<Task | null> {
    const task = await prisma.task.update({
        where: { id },
        data
    });

    // Sync to Google Calendar asynchronously (unless skipGoogleSync is true)
    if (task && !skipGoogleSync) {
        syncUpdateToGoogleCalendar(task);
    }

    return task;
}

export async function deleteTask(id: number): Promise<Task | null> {
    const task = await prisma.task.findUnique({
        where: { id }
    });
    
    if (task) {
        // Sync deletion to Google Calendar before deleting from database
        await syncDeleteToGoogleCalendar(task);
        
        return await prisma.task.delete({ where: { id } });
    }
    
    return null;
}