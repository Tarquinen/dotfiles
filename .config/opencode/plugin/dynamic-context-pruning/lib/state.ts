// lib/state.ts

export interface PruningMetadata {
    prunedIds: string[]
    lastPruneCount: number // Number of messages pruned in the last operation
}

export class StateManager {
    private state: Map<string, PruningMetadata> = new Map()

    async get(sessionID: string): Promise<string[]> {
        return this.state.get(sessionID)?.prunedIds ?? []
    }

    async set(sessionID: string, prunedIds: string[]): Promise<void> {
        const existing = this.state.get(sessionID)
        const previousCount = existing?.prunedIds.length ?? 0
        const newCount = prunedIds.length - previousCount
        
        this.state.set(sessionID, {
            prunedIds,
            lastPruneCount: newCount
        })
    }

    async getLastPruneCount(sessionID: string): Promise<number> {
        return this.state.get(sessionID)?.lastPruneCount ?? 0
    }

    async resetLastPruneCount(sessionID: string): Promise<void> {
        const existing = this.state.get(sessionID)
        if (existing) {
            existing.lastPruneCount = 0
        }
    }

    async clear(sessionID: string): Promise<void> {
        this.state.delete(sessionID)
    }
}
