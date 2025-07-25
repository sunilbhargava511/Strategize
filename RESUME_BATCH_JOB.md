# How to Resume Your Stalled Batch Job

Your batch job `batch_job_mdi5saxn_2kxca` has stalled. Here's how to resume it:

## Option 1: Use the New Orchestrator (Recommended)

Run this in your browser console:

```javascript
fetch('/api/fill-cache-batch-orchestrator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    jobId: 'batch_job_mdi5saxn_2kxca'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Orchestrator started:', data);
  if (data.success) {
    console.log(`Processing ${data.batchesProcessed} batches...`);
    console.log(`Progress: ${data.progress.processed}/${data.progress.total} tickers`);
  }
})
.catch(console.error)
```

The orchestrator will:
- Process batches continuously until Vercel's 5-minute timeout
- Automatically schedule the next orchestration if more batches remain
- Handle ~7-8 batches per run (35+ tickers)

## Option 2: Use the Legacy Continue (Not Recommended)

```javascript
fetch('/api/fill-cache-batch-continue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    jobId: 'batch_job_mdi5saxn_2kxca', 
    autoContinue: true 
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

Note: This only processes one batch and the auto-continuation often fails.

## Check Status First

```javascript
fetch('/api/fill-cache-batch-status?jobId=batch_job_mdi5saxn_2kxca')
  .then(r => r.json())
  .then(data => {
    console.log('Job Status:', data.status);
    console.log(`Progress: ${data.progress.processed}/${data.progress.total} (${data.progress.percentage}%)`);
    console.log(`Batches: ${data.batches.completed}/${data.batches.total}`);
    console.log('Time remaining:', Math.round(data.progress.estimatedTimeRemaining / 60), 'minutes');
  })
```

## Why the Orchestrator is Better

1. **Processes Multiple Batches**: Up to 10 batches per invocation
2. **More Reliable**: Doesn't rely on setTimeout callbacks
3. **Self-Scheduling**: Automatically continues until complete
4. **Better Error Handling**: Can recover from individual batch failures
5. **Efficient**: Processes within Vercel's 5-minute timeout limits