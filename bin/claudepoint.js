#!/usr/bin/env node

/**
 * ClaudePoint Entry Point
 * Detects if running via Claude Code MCP or as CLI
 */

// Check if this is running as an MCP server
// MCP servers communicate via stdin/stdout, so we check for TTY
const isMCPServer = !process.stdin.isTTY && !process.stdout.isTTY;

// Debug info for troubleshooting
if (process.env.DEBUG) {
  console.error('ClaudePoint Debug Info:');
  console.error('process.stdin.isTTY:', process.stdin.isTTY);
  console.error('process.stdout.isTTY:', process.stdout.isTTY);
  console.error('isMCPServer:', isMCPServer);
  console.error('process.argv:', process.argv);
  console.error('process.env.NODE_ENV:', process.env.NODE_ENV);
}

async function main() {
  if (isMCPServer) {
    // Running as MCP server via Claude Code
    await import('../src/mcp-server.js');
  } else {
    // Running as CLI
    await import('../src/cli.js');
  }
}

main().catch(error => {
  console.error('Failed to start ClaudePoint:', error);
  process.exit(1);
});