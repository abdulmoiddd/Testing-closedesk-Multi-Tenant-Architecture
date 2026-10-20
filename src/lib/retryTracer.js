// src/lib/retryTracer.js

/**
 * Wraps any promise/async function to automatically retry on failure 
 * and log the exact attempt lifecycle (Ticket 12).
 * 
 * @param {Object} apiLogger - The scoped logger from the API middleware
 * @param {string} operationName - Name of the process (e.g., "LLM_Execution_And_Parsing")
 * @param {Object} options - { maxAttempts: 3, delayMs: 1000 }
 * @param {Function} operationFn - The async function to execute. Receives `attemptNumber` as an argument.
 */
export async function withRetryTrace(apiLogger, operationName, options, operationFn) {
    const maxAttempts = options.maxAttempts || 3;
    const baseDelayMs = options.delayMs || 1000;
    let attempt = 1;
  
    while (attempt <= maxAttempts) {
      const startTime = Date.now();
      
      try {
        const result = await operationFn(attempt);
        
        // If it succeeded but required retries, log the recovery so it's not invisible
        if (attempt > 1) {
          apiLogger.info("retry_lifecycle", "operation_retry_success", {
            context: { 
              operation_name: operationName, 
              attempt_number: attempt, 
              max_attempts: maxAttempts,
              final_status: "recovered"
            },
            duration_ms: Date.now() - startTime
          });
        }
        
        return result;
  
      } catch (error) {
        const isFinal = attempt === maxAttempts;
        const failureReason = error.message || "Unknown error";
        const duration_ms = Date.now() - startTime;
  
        if (isFinal) {
          // 🚨 TICKET 12: Final failure produces CRITICAL event
          apiLogger.critical("retry_lifecycle", "operation_final_failure", {
            error,
            context: { 
              operation_name: operationName, 
              attempt_number: attempt, 
              max_attempts: maxAttempts, 
              failure_reason: failureReason,
              final_status: "failed" 
            },
            duration_ms
          });
          throw error; // Throw to the main handler to return a 500
          
        } else {
          // Calculate exponential backoff (1s, 2s, 4s...)
          const nextRetryMs = baseDelayMs * Math.pow(2, attempt - 1); 
          
          // 🚨 TICKET 12: Developer can see original failure and all retry attempts
          apiLogger.warn("retry_lifecycle", "operation_failed_retrying", {
            error,
            context: { 
              operation_name: operationName, 
              attempt_number: attempt, 
              max_attempts: maxAttempts, 
              failure_reason: failureReason,
              next_retry: `${nextRetryMs}ms`,
              final_status: "retrying" 
            },
            duration_ms
          });
  
          await new Promise(res => setTimeout(res, nextRetryMs));
          attempt++;
        }
      }
    }
  }