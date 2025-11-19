// index.ts - Main plugin entry point for Dynamic Context Pruning
import type { Plugin } from "@opencode-ai/plugin"
import { getConfig } from "./lib/config"
import { Logger } from "./lib/logger"
import { StateManager } from "./lib/state"
import { Janitor } from "./lib/janitor"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

export default (async (ctx) => {
    const config = getConfig()

    // Suppress AI SDK warnings about responseFormat (harmless for our use case)
    if (typeof globalThis !== 'undefined') {
        (globalThis as any).AI_SDK_LOG_WARNINGS = false
    }

    // Get the plugin's own directory (not ctx.directory which is the main OpenCode config dir)
    const pluginDir = dirname(fileURLToPath(import.meta.url))

    const logger = new Logger(config.debug, pluginDir)
    const stateManager = new StateManager()
    const janitor = new Janitor(ctx.client, stateManager, logger)

    // Track pruned counts per session for this request
    const requestPrunedCounts = new Map<string, number>()

    // Store the original global fetch
    const originalGlobalFetch = globalThis.fetch

    // Wrap globalThis.fetch to intercept ALL fetch calls
    // This works because even if auth providers set a custom fetch,
    // they ultimately call fetch() which goes through globalThis.fetch
    globalThis.fetch = async (input: any, init?: any) => {
        // Check if this looks like an AI API request by examining the body
        if (init?.body && typeof init.body === 'string') {
            try {
                const body = JSON.parse(init.body)

                // Only process requests that have a messages array (AI requests)
                if (body.messages && Array.isArray(body.messages)) {
                    logger.info("global-fetch", "🔥 AI REQUEST INTERCEPTED via global fetch!", {
                        url: typeof input === 'string' ? input.substring(0, 80) : 'URL object',
                        messageCount: body.messages.length
                    })

                    // Try to extract session ID from the request (might be in headers or we track it)
                    // For now, we'll use a simpler approach: collect ALL pruned IDs from all sessions
                    // This is safe because tool_call_ids are globally unique

                    const toolMessages = body.messages.filter((m: any) => m.role === 'tool')

                    if (toolMessages.length > 0) {
                        logger.debug("global-fetch", "Found tool messages in request", {
                            toolMessageCount: toolMessages.length,
                            toolCallIds: toolMessages.map((m: any) => m.tool_call_id).slice(0, 5)
                        })

                        // Collect all pruned IDs across all sessions, excluding subagent sessions
                        const allSessions = await ctx.client.session.list()
                        const allPrunedIds = new Set<string>()

                        if (allSessions.data) {
                            for (const session of allSessions.data) {
                                // Skip subagent sessions (don't log - it's normal and would spam logs)
                                if (session.parentID) {
                                    continue
                                }
                                
                                const prunedIds = await stateManager.get(session.id)
                                prunedIds.forEach(id => allPrunedIds.add(id))
                            }
                        }

                        if (allPrunedIds.size > 0) {
                            let replacedCount = 0
                            body.messages = body.messages.map((m: any) => {
                                if (m.role === 'tool' && allPrunedIds.has(m.tool_call_id)) {
                                    replacedCount++
                                    return {
                                        ...m,
                                        content: '[Output removed to save context - information superseded or no longer needed]'
                                    }
                                }
                                return m
                            })

                            if (replacedCount > 0) {
                                logger.info("global-fetch", "✂️ Replaced pruned tool messages", {
                                    totalPrunedIds: allPrunedIds.size,
                                    replacedCount: replacedCount,
                                    totalMessages: body.messages.length
                                })

                                // Update the request body with modified messages
                                init.body = JSON.stringify(body)
                            }
                        }
                    }
                }
            } catch (e) {
                // Not a JSON body or not an AI request, ignore
            }
        }

        // Call the original fetch
        return originalGlobalFetch(input, init)
    }

    logger.info("plugin", "Dynamic Context Pruning plugin initialized", {
        debug: config.debug,
        pluginDirectory: pluginDir,
        opencodeDirectory: ctx.directory,
        globalFetchWrapped: true
    })

    return {
        /**
         * Event Hook: Triggers janitor analysis when session becomes idle
         */
        event: async ({ event }) => {
            if (event.type === "session.status" && event.properties.status.type === "idle") {
                // Get session info to check if it's a subagent
                const result = await ctx.client.session.get({ path: { id: event.properties.sessionID } })
                
                // Skip pruning for subagent sessions
                if (result.data?.parentID) {
                    logger.debug("event", "Skipping janitor for subagent session", {
                        sessionID: event.properties.sessionID,
                        parentID: result.data.parentID
                    })
                    return
                }

                logger.debug("event", "Session became idle, triggering janitor", {
                    sessionID: event.properties.sessionID
                })

                // Fire and forget the janitor - don't block the event handler
                janitor.run(event.properties.sessionID).catch(err => {
                    logger.error("event", "Janitor failed", {
                        sessionID: event.properties.sessionID,
                        error: err.message,
                        stack: err.stack
                    })
                })
            }
        },

        /**
         * Chat Params Hook: Wraps fetch function to filter pruned tool responses
         */
        "chat.params": async (input, output) => {
            const sessionId = input.sessionID

            // Get session info to check if it's a subagent
            const result = await ctx.client.session.get({ path: { id: sessionId } })
            
            // Skip pruning for subagent sessions
            if (result.data?.parentID) {
                logger.debug("chat.params", "Skipping context pruning for subagent session", {
                    sessionID: sessionId,
                    parentID: result.data.parentID
                })
                return  // Don't wrap fetch, let it pass through unchanged
            }

            logger.debug("chat.params", "Wrapping fetch for session", {
                sessionID: sessionId,
                hasFetch: !!output.options["fetch"],
                fetchType: output.options["fetch"] ? typeof output.options["fetch"] : "none"
            })

            // Get the existing fetch - this might be from auth provider or globalThis
            const existingFetch = output.options["fetch"] ?? globalThis.fetch

            logger.debug("chat.params", "Existing fetch captured", {
                sessionID: sessionId,
                isGlobalFetch: existingFetch === globalThis.fetch
            })

            // Wrap the existing fetch with our pruning logic
            output.options["fetch"] = async (fetchInput: any, init?: any) => {
                logger.info("pruning-fetch", "🔥 FETCH WRAPPER CALLED!", {
                    sessionId,
                    url: typeof fetchInput === 'string' ? fetchInput.substring(0, 100) : 'URL object'
                })
                logger.debug("pruning-fetch", "Request intercepted", { sessionId })

                // Retrieve the list of pruned tool call IDs from state
                const prunedIds = await stateManager.get(sessionId)
                logger.debug("pruning-fetch", "Retrieved pruned IDs", {
                    sessionId,
                    prunedCount: prunedIds.length,
                    prunedIds: prunedIds.length > 0 ? prunedIds : undefined
                })

                // Log request body details before filtering
                if (init?.body) {
                    try {
                        const bodyPreview = JSON.parse(init.body as string)
                        const toolMessages = bodyPreview.messages?.filter((m: any) => m.role === 'tool') || []
                        logger.debug("pruning-fetch", "Request body before filtering", {
                            sessionId,
                            totalMessages: bodyPreview.messages?.length || 0,
                            toolMessages: toolMessages.length,
                            toolCallIds: toolMessages.map((m: any) => m.tool_call_id)
                        })
                    } catch (e) {
                        // Ignore parse errors here
                    }
                }

                // Reset the count for this request
                let prunedThisRequest = 0

                // Only attempt filtering if there are pruned IDs and a request body exists
                if (prunedIds.length > 0 && init?.body) {
                    try {
                        // Parse the request body (expected to be JSON)
                        const body = JSON.parse(init.body as string)
                        const originalMessageCount = body.messages?.length || 0

                        if (body.messages && Array.isArray(body.messages)) {
                            // Replace tool response messages whose tool_call_id is in the pruned list
                            // with a short placeholder message instead of removing them entirely.
                            // This preserves the message structure and avoids API validation errors.
                            body.messages = body.messages.map((m: any) => {
                                if (m.role === 'tool' && prunedIds.includes(m.tool_call_id)) {
                                    prunedThisRequest++
                                    return {
                                        ...m,
                                        content: '[Output removed to save context - information superseded or no longer needed]'
                                    }
                                }
                                return m
                            })

                            if (prunedThisRequest > 0) {
                                logger.info("pruning-fetch", "Replaced pruned tool messages", {
                                    sessionId,
                                    totalMessages: originalMessageCount,
                                    replacedCount: prunedThisRequest,
                                    prunedIds
                                })

                                // Log remaining tool messages
                                const remainingToolMessages = body.messages.filter((m: any) => m.role === 'tool')
                                logger.debug("pruning-fetch", "Tool messages after replacement", {
                                    sessionId,
                                    totalToolCount: remainingToolMessages.length,
                                    toolCallIds: remainingToolMessages.map((m: any) => m.tool_call_id)
                                })

                                // Track how many were pruned for this request
                                requestPrunedCounts.set(sessionId, prunedThisRequest)

                                // Update the request body with modified messages
                                init.body = JSON.stringify(body)
                            } else {
                                logger.debug("pruning-fetch", "No messages replaced", {
                                    sessionId,
                                    messageCount: originalMessageCount
                                })
                            }
                        }
                    } catch (error: any) {
                        logger.error("pruning-fetch", "Failed to parse/filter request body", {
                            sessionId,
                            error: error.message,
                            stack: error.stack
                        })
                        // Continue with original request if parsing fails - don't break the request
                    }
                }

                // Call the EXISTING fetch (which might be from auth provider) with potentially modified body
                return existingFetch(fetchInput, init)
            }
        },
    }
}) satisfies Plugin
