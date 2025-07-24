# Batch Processing System for Fill-Cache Operations

## Overview

The batch processing system allows you to efficiently cache historical data for thousands of tickers without hitting Vercel's 300-second timeout limit. The system breaks large operations into small, manageable batches that auto-continue until completion.

## Key Features

- **Micro-batches**: 5 tickers per batch (2-3 minutes each)
- **Auto-continuation**: Batches automatically chain together
- **Fault tolerance**: Resume from any failure point
- **Progress tracking**: Real-time progress updates via Redis
- **No timeout risk**: Each batch completes well under 300 seconds

## API Endpoints

### 1. Start Batch Processing

**Endpoint**: `POST /api/fill-cache-batch-start`

**Body**:
```json
{
  "tickerSource": "sp500" | "all" | "custom",
  "tickers": ["AAPL", "MSFT", "GOOGL"], // Required if tickerSource = "custom"
  "batchSize": 5, // Optional, default: 5
  "startImmediately": true // Optional, default: true
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "batch_job_12345",
  "message": "Batch job created with 1000 batches",
  "batchInfo": {
    "totalTickers": 5000,
    "tickersToProcess": 4500,
    "totalBatches": 900,
    "batchSize": 5,
    "estimatedTimeMinutes": 37
  },
  "progress": {
    "processed": 500,
    "total": 5000,
    "percentage": 10.0,
    "successful": 495,
    "failed": 5
  }
}
```

### 2. Check Batch Status

**Endpoint**: `GET /api/fill-cache-batch-status?jobId={jobId}&detailed=true`

**Response**:
```json
{
  "success": true,
  "jobId": "batch_job_12345",
  "status": "running",
  "progress": {
    "processed": 1250,
    "total": 5000,
    "percentage": 25.0,
    "successful": 1200,
    "failed": 50,
    "elapsedTime": 1800,
    "estimatedTimeRemaining": 5400
  },
  "batches": {
    "current": 250,
    "total": 1000,
    "completed": 250,
    "remaining": 750
  },
  "message": "Processing batch 251 of 1000. 750 batches remaining."
}
```

### 3. Continue Batch (Manual)

**Endpoint**: `POST /api/fill-cache-batch-continue`

**Body**:
```json
{
  "jobId": "batch_job_12345",
  "autoContinue": true
}
```

**Response**:
```json
{
  "success": true,
  "completed": false,
  "jobId": "batch_job_12345",
  "batchNumber": 251,
  "totalBatches": 1000,
  "batchResults": {
    "successful": 5,
    "failed": 0,
    "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
  },
  "progress": {
    "processed": 1255,
    "total": 5000,
    "percentage": 25.1
  },
  "message": "Batch completed - continuing to next batch automatically"
}
```

### 4. Enhanced Original Fill-Cache

**Endpoint**: `POST /api/fill-cache`

**Body**:
```json
{
  "tickers": ["AAPL", "MSFT", "GOOGL", "..."], // 100+ tickers
  "action": "fill",
  "useBatch": true // Optional, auto-enabled for 50+ tickers
}
```

**Response** (for large lists):
```json
{
  "success": true,
  "batchMode": true,
  "jobId": "batch_job_12345",
  "message": "Batch job created for 200 tickers",
  "nextSteps": {
    "checkStatus": "/api/fill-cache-batch-status?jobId=batch_job_12345",
    "startProcessing": "/api/fill-cache-batch-continue",
    "autoStart": "Job will start automatically in a few seconds"
  }
}
```

## Usage Examples

### Example 1: Cache All S&P 500 Stocks

```bash
curl -X POST https://your-app.vercel.app/api/fill-cache-batch-start \
  -H "Content-Type: application/json" \
  -d '{
    "tickerSource": "sp500",
    "startImmediately": true
  }'
```

### Example 2: Cache Custom Ticker List

```bash
curl -X POST https://your-app.vercel.app/api/fill-cache \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "..."],
    "action": "fill"
  }'
```

### Example 3: Monitor Progress

```bash
curl "https://your-app.vercel.app/api/fill-cache-batch-status?jobId=batch_job_12345&detailed=true"
```

## System Architecture

### Batch Processing Flow

1. **Job Creation**: Large ticker list → Create batch job → Store in Redis
2. **Auto-Start**: First batch starts automatically (if enabled)
3. **Batch Processing**: Process 5 tickers → Update progress → Auto-continue
4. **Fault Tolerance**: Job resumes from last successful batch on failure
5. **Completion**: All batches complete → Job marked as completed

### Redis Storage Structure

```json
{
  "batch_job:12345": {
    "jobId": "batch_job_12345",
    "totalTickers": 5000,
    "tickersToProcess": ["AAPL", "MSFT", ...],
    "processed": 1250,
    "successful": 1200,
    "failed": 50,
    "currentBatch": 250,
    "totalBatches": 1000,
    "status": "running",
    "startTime": "2025-01-24T10:00:00Z",
    "failedTickers": [
      {"ticker": "INVALID", "error": "Ticker not found", "batchNumber": 45}
    ],
    "successfulTickers": ["AAPL", "MSFT", ...]
  }
}
```

### Performance Characteristics

| Metric | Value |
|--------|-------|
| **Batch Size** | 5 tickers |
| **Batch Duration** | 2-3 minutes |
| **Safety Margin** | 60 seconds (240s effective timeout) |
| **Redis Commands per Ticker** | ~1.2 commands |
| **Daily Capacity** | 4,000+ tickers (Redis limit) |
| **Practical Capacity** | 2,000+ tickers/day (processing time) |

## Error Handling

### Automatic Recovery

- **Batch Failures**: Individual batches can fail without affecting the job
- **Network Issues**: Auto-continuation handles temporary network problems
- **Timeout Protection**: Each batch has built-in timeout protection
- **Resume Capability**: Jobs can be resumed from any point

### Manual Intervention

```bash
# Check failed job
curl "https://your-app.vercel.app/api/fill-cache-batch-status?jobId=failed_job_123"

# Manually continue if auto-continuation fails
curl -X POST https://your-app.vercel.app/api/fill-cache-batch-continue \
  -d '{"jobId": "failed_job_123", "autoContinue": true}'
```

## Best Practices

### For Large Operations (1000+ tickers)

1. **Use batch-start endpoint** instead of regular fill-cache
2. **Monitor progress** periodically with status endpoint
3. **Set up notifications** for job completion
4. **Run during off-peak hours** for better performance

### For Medium Operations (50-200 tickers)

1. **Use regular fill-cache** with `useBatch: true`
2. **Let auto-batching handle** the optimization
3. **Check results** after completion

### For Small Operations (<50 tickers)

1. **Use regular fill-cache** without batching
2. **Faster completion** with direct processing
3. **Immediate results** available

## Monitoring and Debugging

### Log Messages

```
🚀 Creating batch job batch_job_12345 for 5000 tickers
📦 Processing 4500 missing tickers in 900 batches of 5
🔄 Processing batch 251/900 for job batch_job_12345: [AAPL, MSFT, GOOGL, AMZN, TSLA]
✅ Completed batch 251/900 for job batch_job_12345 in 2.3s
🔄 Auto-continuing to next batch for job batch_job_12345...
🎉 Batch job batch_job_12345 completed! 4450 successful, 50 failed
```

### Redis Keys

- `batch_job:{jobId}`: Main job data
- `ticker-data:{TICKER}`: Cached ticker data (unchanged)
- `failed-tickers:{TICKER}`: Failed ticker markers (unchanged)

The batch processing system is now ready for production use and can handle the full 5,000 ticker dataset efficiently!