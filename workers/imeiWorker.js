require('dotenv').config();

const { Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const { processOrder } = require('../services/orderProcessor');
const mongoose = require('mongoose');

const queueName = 'imei-verification';
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function createConnection() {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });

  connection.on('error', (err) => {
    console.error('[Worker Redis] Connection error:', err.message);
  });

  return connection;
}

const connection = createConnection();

const concurrency = parseInt(process.env.IMEI_WORKER_CONCURRENCY, 10) || 5;

async function connectMongo() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/imei-verification';

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    console.log('[Worker] Connected to MongoDB');
  } catch (err) {
    console.error('[Worker] MongoDB connection error:', err);
    process.exit(1);
  }
}

connectMongo();

const worker = new Worker(queueName, async (job) => {
  console.log(`[Worker] Processing job ${job.id} (order ${job.data.orderId})`);
  await processOrder(job.data);
}, {
  connection,
  concurrency,
  autorun: true
});

const events = new QueueEvents(queueName, { connection });

events.on('completed', ({ jobId }) => {
  console.log(`[Worker] Job ${jobId} completed`);
});

events.on('failed', ({ jobId, failedReason }) => {
  console.error(`[Worker] Job ${jobId} failed: ${failedReason}`);
});

worker.on('error', (err) => {
  console.error('[Worker] Unexpected error:', err);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err);
});

worker.on('active', (job) => {
  console.log(`[Worker] Job ${job.id} is active`);
});

console.log(`[Worker] IMEI verification worker started with concurrency ${concurrency}`);

