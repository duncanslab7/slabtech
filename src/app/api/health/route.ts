import { NextResponse } from 'next/server'

export async function GET() {
  const hasAssemblyAI = !!process.env.ASSEMBLYAI_API_KEY
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    assemblyai_configured: hasAssemblyAI,
    anthropic_configured: hasAnthropicKey,
    env: process.env.NODE_ENV,
  })
}
