/**
 * Copilot Force Agent Header Plugin for OpenCode
 * 
 * This is a modified version of opencode-copilot-auth that ALWAYS sets X-Initiator to "agent".
 * It includes all the token refresh logic from the original plugin.
 * 
 * Based on: https://github.com/sst/opencode-copilot-auth/blob/main/index.mjs
 */

import type { Plugin } from "@opencode-ai/plugin"
import type { OAuth } from "@opencode-ai/sdk"
import { appendFileSync } from "fs"

const DEBUG_ENABLED = false // Set to true to enable debug logging
const DEBUG_LOG = '/tmp/opencode-copilot-agent-header-debug.log'

function log(message: string) {
    if (!DEBUG_ENABLED) return
    try {
        const timestamp = new Date().toISOString()
        appendFileSync(DEBUG_LOG, `${timestamp} ${message}\n`)
    } catch (error) {
        if (DEBUG_ENABLED) {
            console.error(`[PLUGIN_LOG_ERROR] Failed to write to ${DEBUG_LOG}:`, error)
        }
    }
}

const CopilotForceAgentHeader: Plugin = async ({ client }) => {
    log('[INIT] Copilot Force Agent Header plugin loaded (replaces copilot-auth)')
    log(`[INIT] OPENCODE_DISABLE_DEFAULT_PLUGINS = ${process.env.OPENCODE_DISABLE_DEFAULT_PLUGINS || 'NOT SET'}`)

    // Constants from copilot-auth
    const HEADERS = {
        "User-Agent": "GitHubCopilotChat/0.32.4",
        "Editor-Version": "vscode/1.105.1",
        "Editor-Plugin-Version": "copilot-chat/0.32.4",
        "Copilot-Integration-Id": "vscode-chat",
    }

    function normalizeDomain(url: string) {
        return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
    }

    function getUrls(domain: string) {
        return {
            COPILOT_API_KEY_URL: `https://api.${domain}/copilot_internal/v2/token`,
        }
    }

    return {
        auth: {
            provider: "github-copilot",
            loader: async (getAuth, provider) => {
                log('[AUTH_LOADER] Loading auth for github-copilot')

                const authInfo = await getAuth()
                if (!authInfo || authInfo.type !== "oauth") {
                    log('[AUTH_LOADER] No OAuth found')
                    return {}
                }

                // Type assertion after runtime check
                const info = authInfo as OAuth

                // Set model costs to 0 (from copilot-auth)
                if (provider && provider.models) {
                    for (const model of Object.values(provider.models)) {
                        model.cost = { input: 0, output: 0 }
                    }
                }

                // Determine baseURL
                const enterpriseUrl = info.enterpriseUrl
                const baseURL = enterpriseUrl
                    ? `https://copilot-api.${normalizeDomain(enterpriseUrl)}`
                    : "https://api.githubcopilot.com"

                log(`[AUTH_LOADER] baseURL: ${baseURL}`)

                const fetchWrapper = async (input: RequestInfo | URL, init?: RequestInit) => {
                    log('[FETCH] Fetch function called!')
                    const authInfo = await getAuth()
                    if (!authInfo || authInfo.type !== "oauth") return fetch(input, init)

                    // Type assertion after runtime check
                    const currentInfo = authInfo as OAuth

                    // Token refresh logic (from copilot-auth)
                    if (!currentInfo.access || currentInfo.expires < Date.now()) {
                        log('[FETCH] Token expired, refreshing...')

                        const domain = currentInfo.enterpriseUrl
                            ? normalizeDomain(currentInfo.enterpriseUrl)
                            : "github.com"
                        const urls = getUrls(domain)

                        const response = await fetch(urls.COPILOT_API_KEY_URL, {
                            headers: {
                                Accept: "application/json",
                                Authorization: `Bearer ${currentInfo.refresh}`,
                                ...HEADERS,
                            },
                        })

                        if (!response.ok) {
                            log('[FETCH] Token refresh failed')
                            return fetch(input, init)
                        }

                        const tokenData = await response.json()

                        const saveProviderID = currentInfo.enterpriseUrl
                            ? "github-copilot-enterprise"
                            : "github-copilot"

                        await client.auth.set({
                            path: { id: saveProviderID },
                            body: {
                                type: "oauth",
                                refresh: currentInfo.refresh,
                                access: tokenData.token,
                                expires: tokenData.expires_at * 1000,
                                ...(currentInfo.enterpriseUrl && {
                                    enterpriseUrl: currentInfo.enterpriseUrl,
                                }),
                            },
                        })

                        currentInfo.access = tokenData.token
                        log('[FETCH] Token refreshed')
                    }

                    // Check for vision request (from copilot-auth)
                    let isVisionRequest = false
                    try {
                        const body = typeof init?.body === "string"
                            ? JSON.parse(init.body)
                            : init?.body
                        if (body?.messages) {
                            isVisionRequest = body.messages.some(
                                (msg: any) =>
                                    Array.isArray(msg.content) &&
                                    msg.content.some((part: any) => part.type === "image_url"),
                            )
                        }
                    } catch { }

                    // Build headers
                    const url = typeof input === 'string' ? input : input.toString()
                    log(`[FETCH] Request to: ${url.substring(0, 60)}...`)

                    const headers: any = {
                        ...init?.headers,
                        ...HEADERS,
                        Authorization: `Bearer ${currentInfo.access}`,
                        "Openai-Intent": "conversation-edits",
                        "X-Initiator": "agent",
                    }

                    if (isVisionRequest) {
                        headers["Copilot-Vision-Request"] = "true"
                    }

                    delete headers["x-api-key"]

                    log('[FETCH] ✓ Forced X-Initiator: agent')

                    return fetch(input, {
                        ...init,
                        headers,
                    })
                }

                log('[AUTH_LOADER] Returning config with custom fetch')

                return {
                    baseURL,
                    apiKey: "",
                    fetch: fetchWrapper,
                }
            },
            methods: [],
        },
    }
}

export default CopilotForceAgentHeader
