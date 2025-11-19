import { generateObject } from "ai"
import { createShadowModel } from "./factory"
import { z } from "zod"
import type { Logger } from "./logger"
import type { StateManager } from "./state"

export class Janitor {
    constructor(
        private client: any,
        private stateManager: StateManager,
        private logger: Logger
    ) { }

    async run(sessionID: string) {
        this.logger.info("janitor", "Starting analysis", { sessionID })

        try {
            // Fetch session history from OpenCode API
            this.logger.debug("janitor", "Fetching session messages", { sessionID })
            const response = await this.client.session.messages({
                path: { id: sessionID },
                query: { limit: 100 }
            })

            // Handle the response format - it should be { data: Array<{info, parts}> } or just the array
            const messages = response.data || response

            this.logger.debug("janitor", "Retrieved messages", {
                sessionID,
                messageCount: messages.length
            })

            // If there are no messages or very few, skip analysis
            if (!messages || messages.length < 3) {
                this.logger.debug("janitor", "Too few messages to analyze, skipping", {
                    sessionID,
                    messageCount: messages?.length || 0
                })
                return
            }

            // Extract tool call IDs from the session and track their output sizes
            // Also track batch tool relationships
            const toolCallIds: string[] = []
            const toolOutputs = new Map<string, string>()
            const batchToolChildren = new Map<string, string[]>() // batchID -> [childIDs]
            let currentBatchId: string | null = null
            
            for (const msg of messages) {
                if (msg.parts) {
                    for (const part of msg.parts) {
                        if (part.type === "tool" && part.callID) {
                            toolCallIds.push(part.callID)
                            
                            // Track the output content for size calculation
                            if (part.state?.status === "completed" && part.state.output) {
                                toolOutputs.set(part.callID, part.state.output)
                            }
                            
                            // Check if this is a batch tool by looking at the tool name
                            if (part.tool === "batch") {
                                currentBatchId = part.callID
                                batchToolChildren.set(currentBatchId, [])
                                this.logger.debug("janitor", "Found batch tool", {
                                    sessionID,
                                    batchID: currentBatchId
                                })
                            } 
                            // If we're inside a batch and this is a prt_ (parallel) tool call, it's a child
                            else if (currentBatchId && part.callID.startsWith('prt_')) {
                                const children = batchToolChildren.get(currentBatchId)!
                                children.push(part.callID)
                                this.logger.debug("janitor", "Added child to batch tool", {
                                    sessionID,
                                    batchID: currentBatchId,
                                    childID: part.callID,
                                    totalChildren: children.length
                                })
                            }
                            // If we hit a non-batch, non-prt_ tool, we're out of the batch
                            else if (currentBatchId && !part.callID.startsWith('prt_')) {
                                this.logger.debug("janitor", "Batch tool ended", {
                                    sessionID,
                                    batchID: currentBatchId,
                                    totalChildren: batchToolChildren.get(currentBatchId)!.length
                                })
                                currentBatchId = null
                            }
                        }
                    }
                }
            }
            
            // Log summary of batch tools found
            if (batchToolChildren.size > 0) {
                this.logger.debug("janitor", "Batch tool summary", {
                    sessionID,
                    batchCount: batchToolChildren.size,
                    batches: Array.from(batchToolChildren.entries()).map(([id, children]) => ({
                        batchID: id,
                        childCount: children.length,
                        childIDs: children
                    }))
                })
            }

            // Get already pruned IDs to filter them out
            const alreadyPrunedIds = await this.stateManager.get(sessionID)
            const unprunedToolCallIds = toolCallIds.filter(id => !alreadyPrunedIds.includes(id))

            this.logger.debug("janitor", "Found tool calls in session", {
                sessionID,
                toolCallCount: toolCallIds.length,
                toolCallIds,
                alreadyPrunedCount: alreadyPrunedIds.length,
                unprunedCount: unprunedToolCallIds.length
            })

            // If there are no unpruned tool calls, skip analysis
            if (unprunedToolCallIds.length === 0) {
                this.logger.debug("janitor", "No unpruned tool calls found, skipping analysis", { sessionID })
                return
            }

            // Use big-pickle model - no auth needed!
            const model = createShadowModel()

            this.logger.debug("janitor", "Starting shadow inference", { sessionID })

            // Analyze which tool calls are obsolete
            const result = await generateObject({
                model,
                mode: "json", // Use JSON mode instead of native structured outputs
                schema: z.object({
                    pruned_tool_call_ids: z.array(z.string()),
                    reasoning: z.string(),
                }),
                prompt: `You are a conversation analyzer that identifies obsolete tool outputs in a coding session.

Your task: Analyze the session history and identify tool call IDs whose outputs are NO LONGER RELEVANT to the current conversation context.

Guidelines for identifying obsolete tool calls:
1. Tool outputs that were superseded by newer reads of the same file/resource
2. Exploratory reads that didn't lead to actual edits or meaningful discussion
3. Tool calls from >10 turns ago that are no longer referenced
4. Error outputs that were subsequently fixed
5. Tool calls whose information has been replaced by more recent operations

                DO NOT prune:
- Recent tool calls (within last 5 turns)
- Tool calls that modified state (edits, writes, etc.)
- Tool calls whose outputs are actively being discussed
- Tool calls that produced errors still being debugged

Available tool call IDs in this session (not yet pruned): ${unprunedToolCallIds.join(", ")}

Session history:
${JSON.stringify(messages, null, 2)}

You MUST respond with valid JSON matching this exact schema:
{
  "pruned_tool_call_ids": ["id1", "id2", ...],
  "reasoning": "explanation of why these IDs were selected"
}

Return ONLY the tool call IDs that should be pruned (removed from future LLM requests).`
            })

            // Expand batch tool IDs to include their children
            const expandedPrunedIds = new Set<string>()
            for (const prunedId of result.object.pruned_tool_call_ids) {
                expandedPrunedIds.add(prunedId)
                
                // If this is a batch tool, add all its children
                const children = batchToolChildren.get(prunedId)
                if (children) {
                    this.logger.debug("janitor", "Expanding batch tool to include children", {
                        sessionID,
                        batchID: prunedId,
                        childCount: children.length,
                        childIDs: children
                    })
                    children.forEach(childId => expandedPrunedIds.add(childId))
                }
            }
            
            const finalPrunedIds = Array.from(expandedPrunedIds)

            this.logger.info("janitor", "Analysis complete", {
                sessionID,
                prunedCount: finalPrunedIds.length,
                originalPrunedCount: result.object.pruned_tool_call_ids.length,
                prunedIds: finalPrunedIds,
                reasoning: result.object.reasoning
            })

            // Calculate approximate size saved from newly pruned tool outputs (using expanded IDs)
            let totalCharsSaved = 0
            for (const prunedId of finalPrunedIds) {
                const output = toolOutputs.get(prunedId)
                if (output) {
                    totalCharsSaved += output.length
                }
            }

            // Rough token estimate (1 token ≈ 4 characters for English text)
            const estimatedTokensSaved = Math.round(totalCharsSaved / 4)

            // Merge newly pruned IDs with existing ones (using expanded IDs)
            const allPrunedIds = [...new Set([...alreadyPrunedIds, ...finalPrunedIds])]
            await this.stateManager.set(sessionID, allPrunedIds)
            this.logger.debug("janitor", "Updated state manager", {
                sessionID,
                totalPrunedCount: allPrunedIds.length,
                newlyPrunedCount: finalPrunedIds.length
            })

            // Show toast notification if we pruned anything
            if (finalPrunedIds.length > 0) {
                try {
                    await this.client.tui.showToast({
                        body: {
                            title: "Context Pruned",
                            message: `Removed ${finalPrunedIds.length} tool output${finalPrunedIds.length > 1 ? 's' : ''} (~${estimatedTokensSaved.toLocaleString()} tokens saved)`,
                            variant: "success",
                            duration: 5000
                        }
                    })

                    this.logger.info("janitor", "Toast notification shown", {
                        sessionID,
                        prunedCount: finalPrunedIds.length,
                        estimatedTokensSaved,
                        totalCharsSaved
                    })
                } catch (toastError: any) {
                    this.logger.error("janitor", "Failed to show toast notification", {
                        sessionID,
                        error: toastError.message
                    })
                    // Don't fail the whole pruning operation if toast fails
                }
            }

        } catch (error: any) {
            this.logger.error("janitor", "Analysis failed", {
                sessionID,
                error: error.message,
                stack: error.stack
            })
            // Don't throw - this is a fire-and-forget background process
            // Silently fail and try again on next idle event
        }
    }
}
