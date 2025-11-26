#!/usr/bin/env bun
import path from "path"
import os from "os"

function getXdgDataDir(): string {
    return process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
}

const AUTH_FILE = path.join(getXdgDataDir(), "opencode", "auth.json")

const HEADERS = {
    "User-Agent": "GitHubCopilotChat/0.32.4",
    "Editor-Version": "vscode/1.105.1",
    "Editor-Plugin-Version": "copilot-chat/0.32.4",
    "Copilot-Integration-Id": "vscode-chat",
}

interface OAuthInfo {
    type: "oauth"
    refresh: string
    access: string
    expires: number
    enterpriseUrl?: string
}

async function getAuth(): Promise<OAuthInfo | null> {
    try {
        const file = Bun.file(AUTH_FILE)
        const data = await file.json()
        const auth = data["github-copilot"] || data["github-copilot-enterprise"]
        if (!auth || auth.type !== "oauth") return null
        return auth as OAuthInfo
    } catch {
        return null
    }
}

async function refreshTokenIfNeeded(info: OAuthInfo): Promise<string> {
    if (info.access && info.expires > Date.now()) return info.access
    const domain = info.enterpriseUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "github.com"
    const response = await fetch(`https://api.${domain}/copilot_internal/v2/token`, {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${info.refresh}`,
            ...HEADERS,
        },
    })
    if (!response.ok) throw new Error(`Token refresh failed`)
    const tokenData = await response.json()
    return tokenData.token
}

async function main() {
    const authInfo = await getAuth()
    if (!authInfo) {
        console.error("No auth found")
        process.exit(1)
    }

    const accessToken = await refreshTokenIfNeeded(authInfo)
    const response = await fetch("https://api.githubcopilot.com/models", {
        headers: {
            ...HEADERS,
            Authorization: `Bearer ${accessToken}`,
        },
    })

    const data = await response.json()

    // Pretty print the entire JSON response
    console.log(JSON.stringify(data, null, 2))
}

main().catch(console.error)
