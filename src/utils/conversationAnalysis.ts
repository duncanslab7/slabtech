/**
 * Conversation Analysis Service
 *
 * Categorizes conversations and detects objections using AI and rule-based logic
 * for door-to-door pest control sales training.
 */

import Anthropic from '@anthropic-ai/sdk'

export type ConversationCategory = 'interaction' | 'pitch' | 'sale' | 'uncategorized'

export type ObjectionType =
  | 'diy' // "I do it myself" / "I handle it myself"
  | 'spouse' // "Need to talk to my spouse/partner/wife/husband"
  | 'price' // Price is too high / too expensive
  | 'competitor' // "I use another company" / competitor mention
  | 'delay' // "Need to think about it" / "Can I get a card" / "Not right now"
  | 'not_interested' // "Not interested"
  | 'no_problem' // "Not seeing any bugs" / "Don't have a problem"
  | 'no_soliciting' // "No soliciting" / sign posted / immediate rejection

export interface ObjectionWithText {
  type: ObjectionType
  text: string // The specific phrase that triggered this objection
}

export interface ConversationAnalysis {
  category: ConversationCategory
  objections: ObjectionType[]
  objectionsWithText: ObjectionWithText[] // NEW: Includes the specific text snippets
  hasPriceMention: boolean
  piiRedactionCount: number
  analysisCompleted: boolean
  analysisError?: string
}

/**
 * Analyze a conversation to categorize it and detect objections
 *
 * @param conversationText - The full text of the conversation
 * @param piiRedactionCount - Number of PII redactions in the conversation timeframe
 * @param anthropicApiKey - Anthropic API key for Claude analysis
 * @returns Analysis results
 */
export async function analyzeConversation(
  conversationText: string,
  piiRedactionCount: number,
  anthropicApiKey?: string
): Promise<ConversationAnalysis> {
  try {
    // Step 1: Check for price mentions (rule-based)
    const hasPriceMention = detectPriceMention(conversationText)

    // Step 2: Categorize based on price + PII redactions
    const category = categorizeConversation(hasPriceMention, piiRedactionCount)

    // Step 3: Detect objections using AI
    let objections: ObjectionType[] = []
    let objectionsWithText: ObjectionWithText[] = []
    let analysisError: string | undefined

    if (anthropicApiKey) {
      try {
        const result = await detectObjections(conversationText, anthropicApiKey)
        objections = result.objections
        objectionsWithText = result.objectionsWithText
      } catch (error) {
        console.error('Objection detection failed:', error)
        analysisError = error instanceof Error ? error.message : 'Unknown error'
        // Continue with empty objections rather than failing completely
      }
    } else {
      analysisError = 'No Anthropic API key provided'
    }

    return {
      category,
      objections,
      objectionsWithText,
      hasPriceMention,
      piiRedactionCount,
      analysisCompleted: !analysisError,
      analysisError
    }
  } catch (error) {
    console.error('Conversation analysis failed:', error)
    return {
      category: 'uncategorized',
      objections: [],
      objectionsWithText: [],
      hasPriceMention: false,
      piiRedactionCount,
      analysisCompleted: false,
      analysisError: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Rule-based price mention detection
 *
 * Looks for common price indicators in the conversation text
 */
function detectPriceMention(text: string): boolean {
  const lowerText = text.toLowerCase()

  const priceIndicators = [
    '$',
    'dollar',
    'price',
    'cost',
    'fee',
    'payment',
    'per month',
    'monthly',
    'annual',
    'yearly',
    'subscription',
    'charge',
    'expensive',
    'cheap',
    'afford',
    'budget'
  ]

  return priceIndicators.some(indicator => lowerText.includes(indicator))
}

/**
 * Categorize conversation based on Duncan's rules:
 * - Interaction: No price mentioned
 * - Pitch: Price mentioned, but low/no PII redactions (no credit card)
 * - Sale: Price mentioned + high PII redactions (credit card collected)
 *
 * PII redaction threshold: 3+ redactions likely indicates credit card info
 */
function categorizeConversation(
  hasPriceMention: boolean,
  piiRedactionCount: number
): ConversationCategory {
  if (!hasPriceMention) {
    return 'interaction'
  }

  // Price was mentioned
  // High PII redaction count (3+) typically means credit card was given
  if (piiRedactionCount >= 3) {
    return 'sale'
  }

  // Price mentioned but no credit card = pitch
  return 'pitch'
}

/**
 * Use Claude AI to detect objections from conversation text
 * Now returns both the objection type AND the specific text snippet
 */
async function detectObjections(
  conversationText: string,
  anthropicApiKey: string
): Promise<{ objections: ObjectionType[], objectionsWithText: ObjectionWithText[] }> {
  const anthropic = new Anthropic({
    apiKey: anthropicApiKey
  })

  const prompt = `You are analyzing a door-to-door PEST CONTROL sales conversation to identify customer objections and the EXACT PHRASES where they occur.

IMPORTANT CONTEXT:
- This is a pest control service sales call
- The salesperson is selling ongoing pest treatment subscriptions
- Listen carefully for objections, even subtle ones

CONVERSATION TEXT:
${conversationText}

OBJECTION TYPES TO DETECT:

1. "diy" - DIY / Do It Themselves
   Examples: "I spray myself", "I handle it", "I do my own pest control", "I just use sprays from the store"

2. "spouse" - Needs to consult spouse/partner
   Examples: "I need to talk to my wife/husband/spouse/partner", "let me ask my significant other", "my wife handles this"

3. "price" - Price objection
   Examples: "too expensive", "can't afford it", "that's a lot", "too much money", "out of my budget", "more than I want to spend"

4. "competitor" - Already using another service
   Examples: "I already have someone", "I use another company", "I'm with [competitor name]", "someone already does this"

5. "delay" - Wants to delay/think about it
   Examples: "need to think about it", "not right now", "maybe later", "can I get a card", "call me back", "I'll think it over"

6. "not_interested" - Not interested/direct rejection
   Examples: "not interested", "no thanks", "we're good", "I'm all set", "we don't need that", "no thank you"

7. "no_problem" - Claims no pest problem
   Examples: "don't see any bugs", "don't have pests", "haven't seen anything", "no problem with bugs", "we don't have issues"

8. "no_soliciting" - No soliciting / immediate rejection
   Examples: "no soliciting", "we have a sign", "can't you read the sign", "no solicitors", "get off my property", "I said no soliciting"

INSTRUCTIONS:
- Return ONLY objections stated by THE CUSTOMER (not the sales rep)
- Include the exact phrase - verbatim quote (3-10 words)
- If a customer raises the same objection multiple times, only include it once
- If unsure, err on the side of including it

Return a JSON array of objects with:
- "type": the objection type
- "text": exact verbatim quote from customer (3-10 words)

If no objections found, return: []

Examples:
[{"type": "price", "text": "that's more than I want to pay"}, {"type": "spouse", "text": "I'd have to ask my wife"}]
[{"type": "diy", "text": "I just spray it myself"}]
[{"type": "not_interested", "text": "we're not interested"}]
[]`

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 300, // Increased for text snippets
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const responseText = message.content[0].type === 'text'
    ? message.content[0].text
    : ''

  try {
    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) {
      console.warn('No JSON array found in Claude response:', responseText)
      return { objections: [], objectionsWithText: [] }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ type: string, text: string }>

    const validObjections: ObjectionType[] = [
      'diy',
      'spouse',
      'price',
      'competitor',
      'delay',
      'not_interested',
      'no_problem',
      'no_soliciting'
    ]

    const objectionsWithText: ObjectionWithText[] = parsed
      .filter(obj => validObjections.includes(obj.type as ObjectionType))
      .map(obj => ({
        type: obj.type as ObjectionType,
        text: obj.text
      }))

    const objections = objectionsWithText.map(obj => obj.type)

    return { objections, objectionsWithText }
  } catch (error) {
    console.error('Failed to parse Claude response:', error)
    console.error('Response was:', responseText)
    return { objections: [], objectionsWithText: [] }
  }
}

/**
 * Format objection type for display
 */
export function formatObjectionType(objection: ObjectionType): string {
  const labels: Record<ObjectionType, string> = {
    diy: 'DIY / Do It Themselves',
    spouse: 'Spouse Objection',
    price: 'Price Concern',
    competitor: 'Competitor / Existing Service',
    delay: 'Need to Think / Not Right Now',
    not_interested: 'Not Interested',
    no_problem: 'No Problem / No Bugs',
    no_soliciting: 'No Soliciting'
  }

  return labels[objection] || objection
}

/**
 * Get a color class for objection type (for UI display)
 */
export function getObjectionColor(objection: ObjectionType): string {
  const colors: Record<ObjectionType, string> = {
    diy: 'bg-blue-100 text-blue-800',
    spouse: 'bg-purple-100 text-purple-800',
    price: 'bg-red-100 text-red-800',
    competitor: 'bg-orange-100 text-orange-800',
    delay: 'bg-yellow-100 text-yellow-800',
    not_interested: 'bg-gray-100 text-gray-800',
    no_problem: 'bg-green-100 text-green-800',
    no_soliciting: 'bg-pink-100 text-pink-800'
  }

  return colors[objection] || 'bg-gray-100 text-gray-800'
}

/**
 * Get a color class for conversation category (for UI display)
 */
export function getCategoryColor(category: ConversationCategory): string {
  const colors: Record<ConversationCategory, string> = {
    interaction: 'bg-blue-100 text-blue-800',
    pitch: 'bg-yellow-100 text-yellow-800',
    sale: 'bg-green-100 text-green-800',
    uncategorized: 'bg-gray-100 text-gray-800'
  }

  return colors[category] || 'bg-gray-100 text-gray-800'
}

/**
 * Format category for display
 */
export function formatCategory(category: ConversationCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}
