const { Queue } = require('bullmq');
const Redis = require('ioredis');

const queueName = 'imei-verification';

function createConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });

  connection.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  return connection;
}

const connection = createConnection();
const queue = new Queue(queueName, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 500,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000
    }
  }
});

async function addVerificationJob(payload) {
  return queue.add('imei-check', payload, {
    jobId: `order-${payload.orderId.toString()}`,
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: payload.attempts || 5,
    backoff: {
      type: 'exponential',
      delay: 30000
    }
  });
}

module.exports = {
  queue,
  addVerificationJob
};

