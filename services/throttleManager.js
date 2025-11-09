const Bottleneck = require('bottleneck');
const { SERVICE_LIMITS } = require('../config/serviceLimits');

const DEFAULT_LIMIT = { maxConcurrent: 5, minTime: 0 };

const limiters = new Map();

function getLimiter(serviceId) {
  const key = Number(serviceId) || 'default';

  if (!limiters.has(key)) {
    const limitConfig = SERVICE_LIMITS[key] || DEFAULT_LIMIT;
    const limiter = new Bottleneck({
      maxConcurrent: Math.max(1, limitConfig.maxConcurrent || DEFAULT_LIMIT.maxConcurrent),
      minTime: Math.max(0, limitConfig.minTime || DEFAULT_LIMIT.minTime)
    });

    limiters.set(key, limiter);
  }

  return limiters.get(key);
}

async function schedule(serviceId, task) {
  const limiter = getLimiter(serviceId);
  return limiter.schedule(task);
}

module.exports = {
  schedule
};

