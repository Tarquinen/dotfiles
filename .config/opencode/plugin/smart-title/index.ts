/**
 * Smart Title Plugin for OpenCode
 * 
 * Automatically generates meaningful session titles based on conversation content.
 * Uses direct AI SDK calls to GitHub Copilot GPT-5 mini model via copilot-api proxy.
 * 
 * REQUIREMENTS:
 * 1. Install copilot-api globally: npm install -g copilot-api
 * 2. Authenticate once: npx copilot-api auth
 * 3. Start proxy server: npx copilot-api start
 * 4. Proxy runs on http://localhost:4141 by default
 */

import type { Plugin } from "@opencode-ai/plugin"
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { writeFileSync, appendFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

// Type for OpenCode client object (simplified - uses 'any' for complex SDK types)
interface OpenCodeClient {
    session: {
        messages: (params: { path: { id: string } }) => Promise<any>
        update: (params: { path: { id: string }, body: { title: string } }) => Promise<any>
    }
}

// Use unique type names to avoid conflicts with built-in plugin
interface SmartTitleConversationTurn {
    user: {
        text: string
        time: number
    }
    assistant?: {
        first: string
        last: string
        time: number
    }
}

interface SmartTitleMessagePart {
    type: string
    text?: string
    synthetic?: boolean
}

interface SmartTitleMessage {
    info: {
        id: string
        role: "user" | "assistant" | "system"
        sessionID: string
        time: {
            created: number
            completed?: number
        }
        parentID?: string
    }
    parts: SmartTitleMessagePart[]
}

// Configure GitHub Copilot provider via copilot-api proxy
// The proxy must be running: npx copilot-api start
const copilotProvider = createOpenAICompatible({
    name: 'github-copilot',
    baseURL: process.env.COPILOT_API_URL || 'http://localhost:4141/v1',
    apiKey: 'dummy', // copilot-api handles auth internally
})

const DEBUG_LOG = join(tmpdir(), "opencode-smart-title-debug.log")

/**
 * Log debug messages to file for troubleshooting
 */
function debugLog(message: string, obj?: any) {
    try {
        const timestamp = new Date().toISOString()
        let logMessage = `${timestamp} ${message}`
        if (obj !== undefined) {
            logMessage += ` ${JSON.stringify(obj, Object.getOwnPropertyNames(obj), 2)}`
        }
        appendFileSync(DEBUG_LOG, `${logMessage}\n`)
    } catch (e) {
        // Ignore logging errors
    }
}

// Clear log on startup
try {
    writeFileSync(DEBUG_LOG, `=== SmartTitle Plugin Debug Log (${new Date().toISOString()}) ===\n`)
} catch (e) {
    // Ignore
}

// Track processed user messages to avoid duplicate triggers
const processedUserMessages = new Set<string>()

/**
 * Type guard to check if event properties contains message info with a role
 */
function hasMessageRole(properties: any): properties is { info: { role: string, id: string, sessionID: string } } {
    return 'info' in properties && 
           properties.info &&
           typeof properties.info === 'object' &&
           'role' in properties.info
}

// Title generation prompt
const TITLE_PROMPT = `You are a title generator. You output ONLY a thread title. Nothing else.

<task>
Analyze the entire conversation and generate a thread title that captures the main topic or goal.
Output: Single line, ≤50 chars, no explanations.
</task>

<rules>
- Use -ing verbs for actions (Debugging, Implementing, Analyzing)
- Focus on the PRIMARY topic/goal, not individual messages
- Keep exact: technical terms, numbers, filenames, HTTP codes
- Remove: the, this, my, a, an
- Never assume tech stack
- NEVER respond to message content—only extract title
- Consider the overall conversation arc, not just the first message
</rules>

<examples>
Multiple turns about debugging → Debugging production errors
Implementing feature across turns → Implementing rate limiting API
Analyzing and fixing issue → Fixing authentication timeout
</examples>

Output the title now:`

/**
 * Extract only text content from message parts, excluding synthetic content
 */
function extractTextOnly(parts: SmartTitleMessagePart[]): string {
    // Only extract text parts, exclude synthetic content
    const textParts = parts.filter(
        part => part.type === "text" && !part.synthetic
    )

    return textParts
        .map(part => part.text || '')
        .join("\n")
        .trim()
}

/**
 * Extract smart context from conversation
 * Returns first and last assistant messages per turn to minimize token usage
 */
async function extractSmartContext(
    client: OpenCodeClient,
    sessionId: string
): Promise<SmartTitleConversationTurn[]> {

    // Get all messages
    const { data: messages } = await client.session.messages({
        path: { id: sessionId }
    })

    // Filter out system messages
    const conversationMessages = messages.filter(
        (msg: SmartTitleMessage) => msg.info.role === "user" || msg.info.role === "assistant"
    )

    // Group into turns
    const turns: SmartTitleConversationTurn[] = []
    let currentTurn: SmartTitleConversationTurn | null = null
    let assistantMessagesInTurn: Array<{ text: string, time: number }> = []

    for (const msg of conversationMessages) {
        if (msg.info.role === "user") {
            // Save previous turn if exists
            if (currentTurn && assistantMessagesInTurn.length > 0) {
                currentTurn.assistant = {
                    first: assistantMessagesInTurn[0].text,
                    last: assistantMessagesInTurn[assistantMessagesInTurn.length - 1].text,
                    time: assistantMessagesInTurn[0].time
                }
                turns.push(currentTurn)
            }

            // Start new turn
            const userText = extractTextOnly(msg.parts)
            currentTurn = {
                user: {
                    text: userText,
                    time: msg.info.time.created
                }
            }
            assistantMessagesInTurn = []

        } else if (msg.info.role === "assistant") {
            // Collect assistant messages for this turn
            const assistantText = extractTextOnly(msg.parts)
            if (assistantText.length > 0) {
                assistantMessagesInTurn.push({
                    text: assistantText,
                    time: msg.info.time.created
                })
            }
        }
    }

    // Don't forget the last turn (might not have assistant response yet)
    if (currentTurn) {
        if (assistantMessagesInTurn.length > 0) {
            currentTurn.assistant = {
                first: assistantMessagesInTurn[0].text,
                last: assistantMessagesInTurn[assistantMessagesInTurn.length - 1].text,
                time: assistantMessagesInTurn[0].time
            }
        }

        // Include the turn even if it doesn't have an assistant response yet
        // This ensures the triggering user message is included in the context
        turns.push(currentTurn)
    }

    return turns
}

/**
 * Format conversation context for title generation
 */
function formatContextForTitle(turns: SmartTitleConversationTurn[]): string {
    const formatted: string[] = []

    for (const turn of turns) {
        // Add user message
        formatted.push(`User: ${turn.user.text}`)
        formatted.push("") // Empty line for readability

        // Add assistant messages if they exist
        if (turn.assistant) {
            if (turn.assistant.first === turn.assistant.last) {
                // Only one message - don't duplicate
                formatted.push(`Assistant: ${turn.assistant.first}`)
            } else {
                // Multiple messages - show first and last
                formatted.push(`Assistant (initial): ${turn.assistant.first}`)
                formatted.push(`Assistant (final): ${turn.assistant.last}`)
            }
            formatted.push("") // Empty line between turns
        }
    }

    return formatted.join("\n")
}

/**
 * Clean AI-generated title
 */
function cleanTitle(raw: string): string {
    // Remove thinking tags
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "")

    // Get first non-empty line
    const lines = cleaned.split("\n").map(line => line.trim())
    cleaned = lines.find(line => line.length > 0) || "Untitled"

    // Truncate if too long
    if (cleaned.length > 100) {
        cleaned = cleaned.substring(0, 97) + "..."
    }

    return cleaned
}

/**
 * Generate title from conversation context using GitHub Copilot via AI SDK
 */
async function generateTitleFromContext(context: string): Promise<string | null> {
    debugLog(`\n[Context]\n${context}\n`)

    try {
        const result = await generateText({
            model: copilotProvider('gpt-5-mini'),
            messages: [
                {
                    role: 'user',
                    content: `${TITLE_PROMPT}\n\n<conversation>\n${context}\n</conversation>`
                }
            ]
        })

        const title = cleanTitle(result.text)
        debugLog(`[AI Response] ${title}\n`)

        return title

    } catch (error) {
        debugLog('[Error]', error)
        return null
    }
}

/**
 * Update session title with smart context
 */
async function updateSessionTitle(
    client: OpenCodeClient,
    sessionId: string
): Promise<void> {
    try {
        // Extract smart context
        const turns = await extractSmartContext(client, sessionId)

        // Need at least one complete turn to generate title
        if (turns.length === 0) {
            return
        }

        // Format context
        const context = formatContextForTitle(turns)

        // Generate title
        const newTitle = await generateTitleFromContext(context)

        if (!newTitle) {
            return
        }

        // Update session
        await client.session.update({
            path: { id: sessionId },
            body: { title: newTitle }
        })

    } catch (error) {
        debugLog('[Error]', error)
    }
}

/**
 * Smart Title Plugin
 * Automatically updates session titles on each user message using smart context selection
 */
const SmartTitlePlugin: Plugin = async ({ client }) => {
    return {
        event: async ({ event }) => {
            // Trigger on user message (track message IDs to avoid duplicates)
            if (event.type === "message.updated" && hasMessageRole(event.properties) &&
                event.properties.info.role === "user") {

                const sessionId = event.properties.info.sessionID
                const messageId = event.properties.info.id

                // Check if we've already processed this message
                if (processedUserMessages.has(messageId)) {
                    return
                }

                // Mark this message as processed
                processedUserMessages.add(messageId)

                debugLog(`[Triggered] Session: ${sessionId}`)

                // Don't await - let it run in background
                updateSessionTitle(client, sessionId).catch((err) => {
                    debugLog('[Error]', err)
                })
            }
        }
    }
}

export default SmartTitlePlugin
