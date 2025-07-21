#!/usr/bin/env node

/**
 * ClaudePoint Entry Point
 * Detects if running via Claude Code MCP or as CLI
 */

// Check if this is running as an MCP server
// MCP servers communicate via stdin/stdout, so we check for TTY
// CLI mode: both stdin and stdout are TTY
// MCP mode: neither stdin nor stdout are TTY (pipes)
// Also check for CLI arguments to force CLI mode
const hasCliArgs = process.argv.length > 2;

// Improved MCP detection for Windows compatibility
// Windows PowerShell pipes behave differently than Unix shells
const stdinPiped = !process.stdin.isTTY;
const stdoutPiped = !process.stdout.isTTY;

// MCP detection logic:
// 1. If we have CLI arguments, it's definitely CLI mode
// 2. If stdin is piped (common for MCP), assume MCP mode
// 3. Fallback to original logic for edge cases
let isMCPServer = false;
if (!hasCliArgs) {
  // Primary indicator: stdin is piped (input is coming from somewhere)
  // This works reliably on both Unix and Windows
  isMCPServer = stdinPiped;
}

// Debug info for troubleshooting
if (process.env.DEBUG) {
  console.error('ClaudePoint Debug Info:');
  console.error('process.stdin.isTTY:', process.stdin.isTTY);
  console.error('process.stdout.isTTY:', process.stdout.isTTY);
  console.error('stdinPiped:', stdinPiped);
  console.error('stdoutPiped:', stdoutPiped);
  console.error('hasCliArgs:', hasCliArgs);
  console.error('isMCPServer:', isMCPServer);
  console.error('process.argv:', process.argv);
  console.error('process.platform:', process.platform);
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