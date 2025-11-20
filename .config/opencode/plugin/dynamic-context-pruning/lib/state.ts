// lib/state.ts

export class StateManager {
    private state: Map<string, string[]> = new Map()

    async get(sessionID: string): Promise<string[]> {
        return this.state.get(sessionID) ?? []
    }

    async set(sessionID: string, prunedIds: string[]): Promise<void> {
        this.state.set(sessionID, prunedIds)
    }
}
