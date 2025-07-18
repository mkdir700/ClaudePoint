#!/usr/bin/env node

/**
 * ClaudePoint Entry Point
 * Detects if running via Claude Code MCP or as CLI
 */

// Check if this is running as an MCP server
// MCP servers communicate via stdin/stdout, so we check for TTY
const isMCPServer = !process.stdin.isTTY && !process.stdout.isTTY;

if (isMCPServer) {
  // Running as MCP server via Claude Code
  import('../src/mcp-server.js');
} else {
  // Running as CLI
  import('../src/cli.js');
}