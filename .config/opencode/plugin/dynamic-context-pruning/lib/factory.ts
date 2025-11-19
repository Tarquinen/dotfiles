// lib/factory.ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export function createShadowModel() {
    // No credentials needed - big-pickle is public and free
    const openai = createOpenAICompatible({
        baseURL: "https://opencode.ai/zen/v1",
        // No apiKey required - the endpoint is public
        name: "opencode",
    })

    return openai("big-pickle")
}
