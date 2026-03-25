import PQueue from 'p-queue';

// Simple in-process queue for background jobs.
// In a production setup with multiple instances, consider using a persistent queue backend (Redis, RabbitMQ, etc.).

export const jobQueue = new PQueue({
  concurrency: 2,
  intervalCap: 5,
  interval: 1000,
});

export const enqueueJob = async (fn, options = {}) => {
  return jobQueue.add(fn, options);
};
