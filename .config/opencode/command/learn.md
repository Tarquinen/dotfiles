---
description: Deep dive into the codebase to understand how it works
---

# Learn the Codebase

You are tasked with deeply understanding the codebase structure, data flow, and how different components interact. Your goal is to build comprehensive knowledge that will help you assist with future tasks.

**Focus Area:** $ARGUMENTS

## Instructions

### If a specific focus area is provided above:
Concentrate your investigation on that particular aspect. For example:
- If given a directory path, understand how that plugin/module works
- If given a feature name, trace how that feature is implemented end-to-end
- If given a concept, find all related code and understand the patterns used

### If no focus area is provided:
Perform a comprehensive codebase overview covering the sections below.

## Investigation Process

### 1. Project Structure
- Identify the main directories and their purposes
- Understand the build system and configuration files
- Note any monorepo structure, workspaces, or package relationships

### 2. Entry Points & Architecture
- Find the main entry points (CLI, server, API routes, etc.)
- Map out the high-level architecture and major components
- Identify design patterns in use (MVC, event-driven, plugin architecture, etc.)

### 3. Data Flow
- Trace how data flows through the system
- Identify state management approaches
- Understand how different modules communicate

### 4. Key Abstractions
- Identify core types, interfaces, and base classes
- Understand the domain model
- Note any important conventions or patterns

### 5. Dependencies & Integrations
- Review external dependencies and why they're used
- Identify integration points with external services
- Note any important configuration requirements

## Output

Provide a clear, structured summary of your findings. Include:

1. **Overview** - What the codebase does and its main purpose
2. **Architecture Summary** - High-level structure and patterns
3. **Key Components** - Most important files/modules and their roles
4. **Data Flow** - How information moves through the system
5. **Notable Patterns** - Conventions, idioms, or patterns to follow
6. **Entry Points** - Where to start when working on specific features

If investigating a specific focus area, tailor your output to explain that aspect thoroughly, including:
- How it connects to the rest of the codebase
- Key files and functions involved
- Any gotchas or important details to know

## Guidelines

- Read key files directly rather than making assumptions
- Follow imports and function calls to understand relationships
- Look at tests to understand expected behavior
- Check configuration files for important settings
- Be thorough but focus on what's most important for understanding the system
- Do not use subagents for this task; rely on your own analysis skills
