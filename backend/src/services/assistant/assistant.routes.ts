import express, { Router } from 'express';
import { processNaturalLanguageInput } from './assistant.service.js';

const router: Router = Router();

router.post('/process', async (req: express.Request, res: express.Response) => {
  const { input, userId, userTimezone, conversationHistory } = req.body;

  // Validate input
  if (!input || typeof input !== 'string' || !input.trim()) {
    console.warn('Invalid input received:', input);
    return res.status(400).json({ 
      error: 'Invalid input. Please provide a task description.' 
    });
  }

  if (!userId || typeof userId !== 'number') {
    console.warn('Invalid userId received:', userId);
    return res.status(400).json({ 
      error: 'User ID is required.' 
    });
  }

  try {
    console.log('Processing AI request:', {
      input: input.substring(0, 100),
      userId,
      timezone: userTimezone || 'default',
      historyLength: conversationHistory?.length || 0
    });

    const result = await processNaturalLanguageInput(
      input.trim(), 
      userId, 
      userTimezone || 'America/Los_Angeles',
      conversationHistory
    );

    console.log('AI response success:', {
      status: result.status,
      tasksCreated: result.tasksCreated,
      hasConflicts: !!(result.conflicts && result.conflicts.length > 0),
      hasReschedule: !!(result.tasksToReschedule && result.tasksToReschedule.length > 0)
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error processing AI request:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    res.status(500).json({
      message: 'I encountered an error processing your request. Please try again.',
      tasks: [],
      tasksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
