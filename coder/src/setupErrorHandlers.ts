import process from 'process';
import { setTimeout } from 'timers/promises';

export function setupErrorHandlers(): void {
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');

  process.on('unhandledRejection', (reason: Error | unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    error.cause = {
      unhandledRejection: true, type: 'unhandledRejection',
      timestamp: new Date().toISOString(),
      processId: process.pid,
      nodeVersion: process.version
    };
    console.error('Unhandled Promise Rejection', error);
  });

  process.on('uncaughtException', (error: Error) => {
    error.cause = {
      uncaughtException: true,
      type: 'uncaughtException',
      timestamp: new Date().toISOString(),
      processId: process.pid,
      nodeVersion: process.version
    };
    console.error('Uncaught Exception', error);
    setTimeout(1000).then(() => process.exit(1));
  });
}
