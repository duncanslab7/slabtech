/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts up.
 * Perfect for one-time initialization like environment validation.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { validateEnv, logEnvStatus } from '@/utils/validateEnv'

export async function register() {
  // Only run on Node.js runtime (server-side)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // Validate all required environment variables
      validateEnv()

      // Log configuration status (safe - doesn't expose secrets)
      if (process.env.NODE_ENV === 'development') {
        logEnvStatus()
      }

      console.log('✓ Environment validation passed')
    } catch (error) {
      // Log the error and exit - don't start the server with invalid config
      console.error(error)

      // In production, exit the process to prevent serving with bad config
      // In development, just warn but continue (for better DX)
      if (process.env.NODE_ENV === 'production') {
        console.error('\n❌ Server will not start with invalid configuration')
        process.exit(1)
      } else {
        console.warn('\n⚠️  Continuing in development mode with invalid config - some features may not work')
      }
    }
  }
}
