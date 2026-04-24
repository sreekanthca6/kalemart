const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('kalemart-worker');

function logEvent(event, fields = {}) {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;
  console.log(JSON.stringify({
    event,
    ts: new Date().toISOString(),
    ...(traceId ? { traceId } : {}),
    ...fields,
  }));
}

logEvent('worker_started');

// Job loop stub — will process inventory reorder alerts, sync jobs, etc.
async function runLoop() {
  while (true) {
    try {
      await processJobs();
    } catch (err) {
      console.error('Worker loop error:', err);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function processJobs() {
  return tracer.startActiveSpan('worker.processJobs', async span => {
    try {
      // TODO: pull jobs from queue (Redis / BullMQ)
      span.setAttribute('jobs.queue', 'stub');
      span.setAttribute('jobs.available', 0);
      logEvent('worker_job_poll', { queue: 'stub', available: 0 });
    } finally {
      span.end();
    }
  });
}

runLoop();
