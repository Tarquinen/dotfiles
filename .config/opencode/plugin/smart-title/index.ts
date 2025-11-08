/**
 * Smart Title Plugin for OpenCode
 * 
 * Automatically generates meaningful session titles based on conversation content.
 * Uses GitHub Copilot GPT-5 mini model via copilot-api proxy.
 * 
 * REQUIREMENTS:
 * 1. Active GitHub Copilot subscription
 * 2. One-time authentication: npx copilot-api auth
 */

import type { Plugin } from "@opencode-ai/plugin"
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { spawn } from "child_process"

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

const PROXY_BASE_URL = process.env.COPILOT_API_URL || 'http://localhost:4141'
const PROXY_HEALTH_URL = `${PROXY_BASE_URL}/v1/models`

// Configure GitHub Copilot provider via copilot-api proxy
const copilotProvider = createOpenAICompatible({
    name: 'github-copilot',
    baseURL: `${PROXY_BASE_URL}/v1`,
    apiKey: 'dummy', // copilot-api handles auth internally
})

// Track proxy startup state
let proxyStartupAttempted = false
let proxyHealthy = false
let proxyStartupInProgress = false

// Track processed user messages to avoid duplicate triggers
const processedUserMessages = new Set<string>()

/**
 * Check if copilot-api proxy is responding
 */
async function checkProxyHealth(): Promise<boolean> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        const response = await fetch(PROXY_HEALTH_URL, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        return response.ok
    } catch (error) {
        return false
    }
}

/**
 * Start copilot-api proxy in background
 */
async function startProxy(): Promise<boolean> {
    try {
        // Start proxy in detached mode so it survives plugin restarts
        const child = spawn('npx', ['copilot-api', 'start'], {
            detached: true,
            stdio: 'ignore',
            shell: true
        })

        // Unref so parent process doesn't wait
        child.unref()

        // Wait for proxy to be ready (max 10 seconds)
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 500))
            if (await checkProxyHealth()) {
                return true
            }
        }

        return false

    } catch (error) {
        return false
    }
}

/**
 * Ensure proxy is running, start it if needed
 */
async function ensureProxyRunning(): Promise<boolean> {
    // Only attempt startup once per plugin session
    if (proxyStartupAttempted) {
        return proxyHealthy
    }

    // If another instance is already starting the proxy, wait for it
    if (proxyStartupInProgress) {
        // Wait up to 15 seconds for the other startup to complete
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 500))
            if (proxyStartupAttempted) {
                return proxyHealthy
            }
        }
        // Timeout - proceed anyway
    }

    proxyStartupInProgress = true
    proxyStartupAttempted = true

    // Check if already running
    if (await checkProxyHealth()) {
        proxyHealthy = true
        proxyStartupInProgress = false
        return true
    }

    // Try to start it
    proxyHealthy = await startProxy()
    proxyStartupInProgress = false
    return proxyHealthy
}

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
        return title

    } catch (error) {
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
        // Ensure proxy is running before attempting title generation
        if (!await ensureProxyRunning()) {
            return
        }

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
        // Silent failure
    }
}

/**
 * Smart Title Plugin
 * Automatically updates session titles on each user message using smart context selection
 */
const SmartTitlePlugin: Plugin = async ({ client }) => {
    // Initialize proxy on plugin startup (runs in background)
    ensureProxyRunning()

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

                // Don't await - let it run in background
                updateSessionTitle(client, sessionId).catch(() => {
                    // Silent failure
                })
            }
        }
    }
}

export default SmartTitlePlugin
