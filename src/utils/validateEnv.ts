/**
 * Environment variable validation
 *
 * This module validates that all required environment variables are set.
 * It should be imported early in the application lifecycle to fail fast
 * if configuration is missing.
 */

interface EnvVar {
  key: string
  description: string
  required: boolean
  pattern?: RegExp
}

const ENV_VARS: EnvVar[] = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    required: true,
    pattern: /^https:\/\/.+\.supabase\.co$/,
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous (public) key',
    required: true,
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Supabase service role (admin) key',
    required: true,
    pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  },
  {
    key: 'ASSEMBLYAI_API_KEY',
    description: 'AssemblyAI API key for transcription',
    required: true,
  },
  {
    key: 'ANTHROPIC_API_KEY',
    description: 'Anthropic API key for conversation analysis',
    required: false, // Optional - conversation analysis can fail gracefully
  },
  {
    key: 'FFMPEG_PATH',
    description: 'Path to FFmpeg executable (optional if using ffmpeg-static)',
    required: false,
  },
]

interface ValidationError {
  key: string
  message: string
  suggestion?: string
}

class EnvironmentValidationError extends Error {
  constructor(public errors: ValidationError[]) {
    const errorMessages = errors
      .map(e => `  - ${e.key}: ${e.message}${e.suggestion ? `\n    → ${e.suggestion}` : ''}`)
      .join('\n')

    super(
      `\n\n❌ Environment variable validation failed:\n\n${errorMessages}\n\n` +
      `Please check your .env.local file and ensure all required variables are set.\n`
    )
    this.name = 'EnvironmentValidationError'
  }
}

/**
 * Validates all required environment variables
 *
 * @throws {EnvironmentValidationError} if any required variables are missing or invalid
 */
export function validateEnv(): void {
  const errors: ValidationError[] = []

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key]

    // Check if required variable is missing
    if (envVar.required && !value) {
      errors.push({
        key: envVar.key,
        message: `Missing required environment variable`,
        suggestion: `Add ${envVar.key}="${envVar.description}" to your .env.local file`,
      })
      continue
    }

    // Skip validation if optional and not set
    if (!envVar.required && !value) {
      continue
    }

    // Validate pattern if specified
    if (value && envVar.pattern && !envVar.pattern.test(value)) {
      errors.push({
        key: envVar.key,
        message: `Invalid format`,
        suggestion: `Expected format for ${envVar.description}`,
      })
    }
  }

  // Throw error if any validation failed
  if (errors.length > 0) {
    throw new EnvironmentValidationError(errors)
  }
}

/**
 * Logs environment configuration status (safe for production)
 * Does not log actual values to prevent leaking secrets
 */
export function logEnvStatus(): void {
  const status = ENV_VARS.map(envVar => {
    const value = process.env[envVar.key]
    const isSet = !!value
    const isValid = !envVar.pattern || (value && envVar.pattern.test(value))

    return {
      key: envVar.key,
      required: envVar.required,
      isSet,
      isValid: isSet ? isValid : null,
    }
  })

  console.log('\n📋 Environment Configuration:')
  status.forEach(({ key, required, isSet, isValid }) => {
    const requiredLabel = required ? '(required)' : '(optional)'
    const icon = isSet
      ? (isValid ? '✓' : '⚠️')
      : (required ? '✗' : '○')

    console.log(`  ${icon} ${key} ${requiredLabel}`)
  })
  console.log('')
}
