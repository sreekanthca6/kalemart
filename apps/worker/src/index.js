console.log('Kalemart worker started');

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
  // TODO: pull jobs from queue (Redis / BullMQ)
  console.log(`[${new Date().toISOString()}] Checking for jobs...`);
}

runLoop();
