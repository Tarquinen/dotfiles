// lib/config.ts
export interface PluginConfig {
    debug: boolean
}

const defaultConfig: PluginConfig = {
    debug: true // Set to true to enable debug logging
}

export function getConfig(): PluginConfig {
    // Could be extended to read from a config file or environment
    return defaultConfig
}
