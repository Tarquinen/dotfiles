// lib/config.ts
export interface PluginConfig {
    debug: boolean
    protectedTools: string[]
}

const defaultConfig: PluginConfig = {
    debug: false, // Default to false, can be enabled via environment variable
    protectedTools: ['task'] // Tools that should never be pruned
}

export function getConfig(): PluginConfig {
    // Check for environment variable
    const debugEnv = process.env.OPENCODE_DCP_DEBUG
    
    return {
        debug: debugEnv === 'true' || debugEnv === '1' || defaultConfig.debug,
        protectedTools: defaultConfig.protectedTools
    }
}
