import { useState, useEffect } from 'react'

interface BatchJobStatus {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  progress: {
    processed: number
    total: number
    percentage: number
    successful: number
    failed: number
  }
  batches: {
    current: number
    total: number
    completed: number
    remaining: number
  }
  message: string
  startTime?: string
  processingStartTime?: string
  lastUpdate?: string
}

interface BatchJobManagerProps {
  isOpen: boolean
  onClose: () => void
}

export default function BatchJobManager({ isOpen, onClose }: BatchJobManagerProps) {
  const [jobId, setJobId] = useState('')
  const [jobStatus, setJobStatus] = useState<BatchJobStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [continuing, setContinuing] = useState(false)

  // Load job ID from localStorage when component opens
  useEffect(() => {
    if (isOpen) {
      const storedJobId = localStorage.getItem('lastBatchJobId')
      if (storedJobId && !jobId) {
        setJobId(storedJobId)
      }
    }
  }, [isOpen, jobId])

  const checkJobStatus = async () => {
    if (!jobId.trim()) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/fill-cache-batch-status?jobId=${encodeURIComponent(jobId.trim())}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setJobStatus(data)
    } catch (err: any) {
      setError(err.message)
      setJobStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const continueJob = async () => {
    if (!jobId.trim()) return
    
    setContinuing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/fill-cache-batch-orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobId.trim() })
      })
      
      // Check for authentication issues
      if (response.status === 401 || response.status === 403) {
        setError('Authentication required. Please refresh the page and try again.')
        return
      }
      
      // Check for other errors (but 504 is expected)
      if (response.status !== 504 && !response.ok) {
        const errorText = await response.text()
        setError(`HTTP ${response.status}: ${errorText}`)
        return
      }
      
      // Don't check response.ok because 504 is expected
      if (response.status !== 504) {
        const data = await response.json()
        console.log('Orchestrator response:', data)
      }
      
      // Show success message and refresh status
      alert('Batch processing continued! The job will run for ~5 minutes until Vercel timeout.')
      setTimeout(() => {
        checkJobStatus() // Refresh status after a moment
      }, 2000)
      
    } catch (err: any) {
      console.log('Expected error (likely 504 timeout):', err.message)
      alert('Batch processing started! The 504 timeout is expected - job continues in background.')
      setTimeout(() => {
        checkJobStatus() // Refresh status after a moment
      }, 2000)
    } finally {
      setContinuing(false)
    }
  }

  const formatPercentage = (percentage: number) => {
    return Math.round(percentage * 100) / 100
  }

  const canContinue = jobStatus && 
    jobStatus.status !== 'completed' && 
    jobStatus.status !== 'failed' &&
    jobStatus.progress.processed < jobStatus.progress.total

  useEffect(() => {
    // Auto-check status when job ID changes
    if (jobId.trim()) {
      const timeoutId = setTimeout(checkJobStatus, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [jobId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Batch Job Manager</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Job ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Batch Job ID
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="batch_job_mdi5saxn_2kxca"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
              <button
                onClick={checkJobStatus}
                disabled={loading || !jobId.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Job Status Display */}
          {jobStatus && (
            <div className="space-y-4">
              {/* Status Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Job Status</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  jobStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                  jobStatus.status === 'running' ? 'bg-blue-100 text-blue-800' :
                  jobStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {jobStatus.status.toUpperCase()}
                </span>
              </div>

              {/* Progress Overview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Ticker Progress</span>
                  <span className="text-sm text-gray-600">
                    {jobStatus.progress.processed}/{jobStatus.progress.total} 
                    ({formatPercentage(jobStatus.progress.percentage)}%)
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(jobStatus.progress.percentage, 100)}%` }}
                  />
                </div>

                {/* Success/Failure Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">✓ Successful:</span>
                    <span className="ml-1">{jobStatus.progress.successful}</span>
                  </div>
                  <div>
                    <span className="text-red-600 font-medium">✗ Failed:</span>
                    <span className="ml-1">{jobStatus.progress.failed}</span>
                  </div>
                </div>
              </div>

              {/* Batch Details */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Batch Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                  <div>
                    <span className="font-medium">Current Batch:</span>
                    <span className="ml-1">{jobStatus.batches.current}/{jobStatus.batches.total}</span>
                  </div>
                  <div>
                    <span className="font-medium">Remaining:</span>
                    <span className="ml-1">{jobStatus.batches.remaining} batches</span>
                  </div>
                </div>
              </div>

              {/* Timing Information */}
              {(jobStatus.startTime || jobStatus.processingStartTime) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Timing</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    {jobStatus.startTime && (
                      <div>
                        <span className="font-medium">Job Created:</span>
                        <span className="ml-2">{new Date(jobStatus.startTime).toLocaleString()}</span>
                      </div>
                    )}
                    {jobStatus.processingStartTime && (
                      <div>
                        <span className="font-medium text-green-800">Processing Started:</span>
                        <span className="ml-2 text-green-800">{new Date(jobStatus.processingStartTime).toLocaleString()}</span>
                      </div>
                    )}
                    {jobStatus.lastUpdate && (
                      <div>
                        <span className="font-medium">Last Update:</span>
                        <span className="ml-2">{new Date(jobStatus.lastUpdate).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Message */}
              {jobStatus.message && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <p className="text-sm text-yellow-800">{jobStatus.message}</p>
                </div>
              )}

              {/* Continue Button */}
              {canContinue && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={continueJob}
                    disabled={continuing}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
                  >
                    {continuing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Continuing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h7a2 2 0 002-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Continue Processing</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Help Text */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
            <h4 className="font-medium mb-2">How to use:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter your batch job ID (e.g., batch_job_mdi5saxn_2kxca)</li>
              <li>Click "Check Status" to see current progress</li>
              <li>If processing is incomplete, click "Continue Processing"</li>
              <li>The job will run for ~5 minutes until Vercel timeout, then you can continue again</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}