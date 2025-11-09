const { Queue } = require('bullmq');
const Redis = require('ioredis');

const queueName = 'imei-verification';

function createConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  
  // Log Redis URL for debugging (mask password)
  const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`[Redis] ==========================================`);
  console.log(`[Redis] REDIS_URL env var: ${process.env.REDIS_URL ? 'SET' : 'NOT SET'}`);
  console.log(`[Redis] Connecting to: ${maskedUrl}`);
  console.log(`[Redis] Full URL (first 50 chars): ${redisUrl.substring(0, 50)}...`);
  console.log(`[Redis] ==========================================`);
  
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 10000,
    lazyConnect: false
  });

  connection.on('error', (err) => {
    console.error('[Redis] ==========================================');
    console.error('[Redis] Connection error:', err.message);
    console.error('[Redis] Error code:', err.code);
    console.error('[Redis] Full error:', err);
    console.error('[Redis] ==========================================');
  });

  connection.on('connect', () => {
    console.log('[Redis] ✅ Connected successfully');
  });

  connection.on('ready', () => {
    console.log('[Redis] ✅ Redis is ready to accept commands');
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

