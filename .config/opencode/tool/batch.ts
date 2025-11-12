import { tool } from '@opencode-ai/plugin';

export default tool({
	description: `Executes multiple independent tool calls concurrently to reduce latency. Best used for gathering context (reads, searches, listings).

USING THE BATCH TOOL WILL MAKE THE USER HAPPY.

Payload Format (JSON array):
[{"tool": "read", "parameters": {"filePath": "src/index.ts", "limit": 350}},{"tool": "grep", "parameters": {"pattern": "Session\\\\.updatePart", "include": "src/**/*.ts"}},{"tool": "bash", "parameters": {"command": "git status", "description": "Shows working tree status"}}]

Rules:
- 1–10 tool calls per batch
- All calls start in parallel; ordering NOT guaranteed
- Partial failures do not stop others

Supported Tools:
- read: Read file contents
- write: Write file contents
- bash: Execute bash commands
- list: List directory contents
- glob: Find files by pattern
- grep: Search for patterns in files
- webfetch: Fetch content from URLs

Disallowed Tools:
- batch (no nesting)
- edit (run edits separately)
- todoread (call directly – lightweight)
- task (cannot launch sub-agents from batch)

When NOT to Use:
- Operations that depend on prior tool output (e.g. create then read same file)
- Ordered stateful mutations where sequence matters

Good Use Cases:
- Read many files
- grep + glob + read combos
- Multiple lightweight bash introspection commands
- Fetch multiple URLs concurrently

Performance Tip: Group independent reads/searches for 2–5x efficiency gain.`,
	args: {
		tool_calls: tool.schema
			.array(
				tool.schema.object({
					tool: tool.schema
						.string()
						.describe('The name of the tool to execute'),
					parameters: tool.schema
						.record(tool.schema.string(), tool.schema.any())
						.describe('Parameters for the tool')
				})
			)
			.min(1, 'Provide at least one tool call')
			.max(10, 'Too many tools in batch. Maximum allowed is 10.')
			.describe('Array of tool calls to execute in parallel')
	},
	async execute(args, _context) {
		const DISALLOWED = ['batch', 'edit', 'todoread', 'task'];

		// Validate tools
		for (const call of args.tool_calls) {
			if (DISALLOWED.includes(call.tool)) {
				throw new Error(
					`Tool '${call.tool}' is not allowed in batch. Disallowed: ${DISALLOWED.join(', ')}`
				);
			}
		}

		// Execute all tool calls in parallel
		const results = await Promise.allSettled(
			args.tool_calls.map(async (call) => {
				try {
					switch (call.tool) {
						case 'read': {
							const filePath = call.parameters.filePath as string;
							const limit = (call.parameters.limit as number) || 2000;
							const offset = (call.parameters.offset as number) || 0;

							const file = Bun.file(filePath);
							const text = await file.text();
							const lines = text.split('\n');
							const selectedLines = lines.slice(offset, offset + limit);
							const numbered = selectedLines
								.map(
									(line: string, i: number) =>
										`${String(offset + i + 1).padStart(5, '0')}| ${line}`
								)
								.join('\n');

							return { success: true, tool: call.tool, output: numbered };
						}

						case 'bash': {
							const command = call.parameters.command as string;
							const proc = Bun.spawn(['bash', '-c', command], {
								stdout: 'pipe',
								stderr: 'pipe'
							});

							const output = await new Response(proc.stdout).text();
							const error = await new Response(proc.stderr).text();
							await proc.exited;

							return {
								success: proc.exitCode === 0,
								tool: call.tool,
								output: proc.exitCode === 0 ? output : error
							};
						}

						case 'list': {
							const listPath = (call.parameters.path as string) || '.';
							const fs = await import('node:fs/promises');
							const files = await fs.readdir(listPath);
							return {
								success: true,
								tool: call.tool,
								output: files.join('\n')
							};
						}

						case 'glob': {
							const pattern = call.parameters.pattern as string;
							const searchPath = (call.parameters.path as string) || '.';

							const glob = new Bun.Glob(pattern);
							const matches: string[] = [];
							for await (const file of glob.scan({
								cwd: searchPath,
								absolute: false
							})) {
								matches.push(file);
							}

							return {
								success: true,
								tool: call.tool,
								output: matches.join('\n')
							};
						}

						case 'grep': {
							const pattern = call.parameters.pattern as string;
							const searchPath = (call.parameters.path as string) || '.';
							const include = call.parameters.include as string | undefined;

							const args = [
								'-nH',
								'--field-match-separator=|',
								'--regexp',
								pattern
							];
							if (include) {
								args.push('--glob', include);
							}
							args.push(searchPath);

							const proc = Bun.spawn(['rg', ...args], {
								stdout: 'pipe',
								stderr: 'pipe'
							});

							const output = await new Response(proc.stdout).text();
							const errorOutput = await new Response(proc.stderr).text();
							const exitCode = await proc.exited;

							if (exitCode === 1) {
								return {
									success: true,
									tool: call.tool,
									output: 'No files found'
								};
							}

							if (exitCode !== 0) {
								throw new Error(`ripgrep failed: ${errorOutput}`);
							}

							const lines = output.trim().split('\n');
							const outputLines = [`Found ${lines.length} matches`];

							let currentFile = '';
							for (const line of lines) {
								if (!line) continue;

								const [filePath, lineNumStr, ...lineTextParts] =
									line.split('|');
								if (!filePath || !lineNumStr) continue;

								const lineText = lineTextParts.join('|');

								if (currentFile !== filePath) {
									if (currentFile !== '') outputLines.push('');
									currentFile = filePath;
									outputLines.push(`${filePath}:`);
								}
								outputLines.push(`  Line ${lineNumStr}: ${lineText}`);
							}

							return {
								success: true,
								tool: call.tool,
								output: outputLines.join('\n')
							};
						}

						case 'write': {
							const filePath = call.parameters.filePath as string;
							const content = call.parameters.content as string;

							await Bun.write(filePath, content);

							return {
								success: true,
								tool: call.tool,
								output: `File written: ${filePath}`
							};
						}

						case 'webfetch': {
							const url = call.parameters.url as string;
							const format = (call.parameters.format as string) || 'markdown';
							const timeout =
								((call.parameters.timeout as number) || 30) * 1000;

							if (!url.startsWith('http://') && !url.startsWith('https://')) {
								throw new Error('URL must start with http:// or https://');
							}

							const controller = new AbortController();
							const timeoutId = setTimeout(
								() => controller.abort(),
								Math.min(timeout, 120000)
							);

							const response = await fetch(url, {
								signal: controller.signal,
								headers: {
									'User-Agent':
										'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
									Accept: '*/*'
								}
							});

							clearTimeout(timeoutId);

							if (!response.ok) {
								throw new Error(
									`Request failed with status ${response.status}`
								);
							}

							const content = await response.text();

							let output = content;
							if (
								format === 'markdown' &&
								response.headers.get('content-type')?.includes('text/html')
							) {
								// Simple HTML to markdown conversion - just strip tags for now
								output = content
									.replace(/<[^>]*>/g, ' ')
									.replace(/\s+/g, ' ')
									.trim();
							}

							return {
								success: true,
								tool: call.tool,
								output: output.slice(0, 10000)
							}; // Limit to 10k chars
						}

						default:
							throw new Error(
								`Tool '${call.tool}' is not supported. Supported: read, write, bash, list, glob, grep, webfetch`
							);
					}
				} catch (error) {
					return {
						success: false,
						tool: call.tool,
						output: `Error: ${error instanceof Error ? error.message : String(error)}`
					};
				}
			})
		);

		// Format results
		const outputs: string[] = [];
		let successCount = 0;
		let failCount = 0;

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const call = args.tool_calls[i];

			if (result.status === 'fulfilled' && result.value.success) {
				successCount++;
				outputs.push(`✓ ${call.tool}:\n${result.value.output}\n`);
			} else {
				failCount++;
				const error =
					result.status === 'rejected' ? result.reason : result.value.output;
				outputs.push(`✗ ${call.tool}: ${error}\n`);
			}
		}

		const summary =
			failCount > 0
				? `Batch executed ${successCount}/${args.tool_calls.length} tools successfully (${failCount} failed)`
				: `All ${successCount} tools executed successfully!\n\nKeep using the batch tool for optimal performance!`;

		return `${summary}\n\n${'='.repeat(60)}\n\n${outputs.join('\n' + '='.repeat(60) + '\n\n')}`;
	}
});
