/**
 * Smart Title Plugin for OpenCode
 * 
 * Automatically generates meaningful session titles based on conversation content.
 * Supports multiple AI providers: OpenAI, Google Gemini, Anthropic Claude, and GitHub Copilot.
 * 
 * REQUIREMENTS (depending on provider):
 * - OpenAI: Set OPENAI_API_KEY in .env
 * - Gemini: Set GOOGLE_GENERATIVE_AI_API_KEY in .env
 * - Anthropic: Set ANTHROPIC_API_KEY in .env
 * - GitHub Copilot: Active subscription + npx copilot-api auth
 */

import type { Plugin } from "@opencode-ai/plugin"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { spawn } from "child_process"
import { appendFileSync } from "fs"
import { config } from "dotenv"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { TITLE_PROMPT } from "./prompt.js"

// Load .env file from plugin directory
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env') })

const DEBUG_LOG = '/tmp/opencode-smart-title-debug.log'

function log(message: string) {
    if (!DEBUG_ENABLED) return
    const timestamp = new Date().toISOString()
    appendFileSync(DEBUG_LOG, `${timestamp} ${message}\n`)
}

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

// Configuration from environment variables
const AI_PROVIDER = process.env.AI_PROVIDER || 'copilot' // openai, gemini, anthropic, or copilot
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini' // model name depends on provider
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const PROXY_BASE_URL = process.env.COPILOT_API_URL || 'http://localhost:4141'
const PROXY_HEALTH_URL = `${PROXY_BASE_URL}/v1/models`
const TITLE_UPDATE_THRESHOLD = parseInt(process.env.TITLE_UPDATE_THRESHOLD || '1', 10)
const DEBUG_ENABLED = process.env.DEBUG === 'true'

// Initialize providers based on configuration
let openaiProvider: ReturnType<typeof createOpenAI> | null = null
let geminiProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null
let anthropicProvider: ReturnType<typeof createAnthropic> | null = null
let copilotProvider: ReturnType<typeof createOpenAICompatible> | null = null

// Initialize the selected provider
function initializeProvider() {
    try {
        switch (AI_PROVIDER) {
            case 'openai':
                if (!OPENAI_API_KEY) {
                    log('[ERROR] OPENAI_API_KEY not set in .env')
                    return null
                }
                openaiProvider = createOpenAI({
                    apiKey: OPENAI_API_KEY,
                })
                log(`[INIT] OpenAI provider initialized with model: ${AI_MODEL}`)
                return openaiProvider
            
            case 'gemini':
                if (!GOOGLE_GENERATIVE_AI_API_KEY) {
                    log('[ERROR] GOOGLE_GENERATIVE_AI_API_KEY not set in .env')
                    return null
                }
                geminiProvider = createGoogleGenerativeAI({
                    apiKey: GOOGLE_GENERATIVE_AI_API_KEY,
                })
                log(`[INIT] Google Gemini provider initialized with model: ${AI_MODEL}`)
                return geminiProvider
            
            case 'anthropic':
                if (!ANTHROPIC_API_KEY) {
                    log('[ERROR] ANTHROPIC_API_KEY not set in .env')
                    return null
                }
                anthropicProvider = createAnthropic({
                    apiKey: ANTHROPIC_API_KEY,
                })
                log(`[INIT] Anthropic provider initialized with model: ${AI_MODEL}`)
                return anthropicProvider
            
            case 'copilot':
                copilotProvider = createOpenAICompatible({
                    name: 'github-copilot',
                    baseURL: `${PROXY_BASE_URL}/v1`,
                    apiKey: 'dummy', // copilot-api handles auth internally
                })
                log(`[INIT] GitHub Copilot provider initialized with model: ${AI_MODEL}`)
                return copilotProvider
            
            default:
                log(`[ERROR] Unknown AI_PROVIDER: ${AI_PROVIDER}`)
                return null
        }
    } catch (error) {
        log(`[ERROR] Failed to initialize provider: ${error}`)
        return null
    }
}

// Get the model instance for the current provider
function getModel(): any {
    const provider = initializeProvider()
    if (!provider) return null
    
    try {
        return provider(AI_MODEL)
    } catch (error) {
        log(`[ERROR] Failed to get model: ${error}`)
        return null
    }
}

// Track proxy startup state
let proxyStartupAttempted = false
let proxyHealthy = false
let proxyStartupInProgress = false

// Track processed user messages to avoid duplicate triggers
const processedUserMessages = new Set<string>()

// Track user message count per session for threshold-based updates
const sessionUserMessageCount = new Map<string, number>()

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
 * Ensure proxy is running, start it if needed (only for copilot provider)
 */
async function ensureProxyRunning(): Promise<boolean> {
    // Only needed for copilot provider
    if (AI_PROVIDER !== 'copilot') {
        return true
    }

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
 * Truncate text to specified length with ellipsis
 */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
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
 * Generate title from conversation context using configured AI provider
 */
async function generateTitleFromContext(context: string): Promise<string | null> {
    try {
        const model = getModel()
        if (!model) {
            log('[ERROR] Failed to get model instance')
            return null
        }

        const result = await generateText({
            model,
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
        log(`[ERROR] Failed to generate title: ${error}`)
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

        // Log truncated context for debugging
        log(`[Triggered] Session: ${sessionId}`)
        log('[Context]')
        for (const turn of turns) {
            log(`  User: ${truncate(turn.user.text, 100)}`)
            if (turn.assistant) {
                log(`  Assistant (first): ${truncate(turn.assistant.first, 100)}`)
                if (turn.assistant.first !== turn.assistant.last) {
                    log(`  Assistant (last): ${truncate(turn.assistant.last, 100)}`)
                }
            }
        }

        // Format context
        const context = formatContextForTitle(turns)

        // Generate title
        const newTitle = await generateTitleFromContext(context)

        if (!newTitle) {
            log('[Title] Generation failed')
            return
        }

        // Log the generated title
        log(`[Title] ${newTitle}`)

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
    // Initialize provider and ensure copilot proxy is running if needed
    if (AI_PROVIDER === 'copilot') {
        ensureProxyRunning()
    }

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

                // Increment user message count for this session
                const currentCount = (sessionUserMessageCount.get(sessionId) || 0) + 1
                sessionUserMessageCount.set(sessionId, currentCount)

                // Only update title if we've reached the threshold
                if (currentCount % TITLE_UPDATE_THRESHOLD !== 0) {
                    return
                }

                // Don't await - let it run in background
                updateSessionTitle(client, sessionId).catch(() => {
                    // Silent failure
                })
            }
        }
    }
}

export default SmartTitlePlugin
