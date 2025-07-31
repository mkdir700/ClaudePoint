#!/usr/bin/env node

/**
 * ClaudePoint Entry Point
 * Detects if running via Claude Code MCP or as CLI
 * Windows-compatible MCP server startup
 */

// Check if this is running as an MCP server
// MCP servers communicate via stdin/stdout, so we check for TTY
// CLI mode: both stdin and stdout are TTY
// MCP mode: neither stdin nor stdout are TTY (pipes)
// Also check for CLI arguments to force CLI mode
const hasCliArgs = process.argv.length > 2;

// Enhanced MCP detection for Windows compatibility
// Windows PowerShell and Command Prompt handle pipes differently than Unix shells
// Also account for Git Bash on Windows which may have different TTY behavior
const stdinPiped = !process.stdin.isTTY;
const stdoutPiped = !process.stdout.isTTY;
const isWindows = process.platform === 'win32';

// MCP detection logic with Windows compatibility:
// 1. If we have CLI arguments, it's definitely CLI mode
// 2. For MCP mode: stdin is piped (most reliable indicator)
// 3. Special handling for Windows PowerShell and Git Bash
let isMCPServer = false;
if (!hasCliArgs) {
  // Primary MCP indicator: stdin is piped (data is coming from somewhere)
  // This is the most reliable cross-platform method
  isMCPServer = stdinPiped;
  
  // Windows-specific adjustments
  if (isWindows) {
    // On Windows, some shells (like PowerShell) may report TTY differently
    // Also check if we're in a non-interactive environment
    const nonInteractive = !process.stdout.isTTY && !process.stderr.isTTY;
    if (nonInteractive && !hasCliArgs) {
      isMCPServer = true;
    }
  }
  
  // However, if both stdin and stdout are not TTY but we have no input,
  // we might be in a test environment - wait briefly for input
  if (isMCPServer && process.stdin.readable === false) {
    // stdin is piped but no data available - might be interactive
    // Let the MCP server start anyway, it will handle no input gracefully
    isMCPServer = true;
  }
}

// Enhanced debug info for troubleshooting (especially useful for Windows issues)
if (process.env.DEBUG) {
  console.error('ClaudePoint Debug Info:');
  console.error('process.stdin.isTTY:', process.stdin.isTTY);
  console.error('process.stdout.isTTY:', process.stdout.isTTY);
  console.error('process.stderr.isTTY:', process.stderr.isTTY);
  console.error('process.stdin.readable:', process.stdin.readable);
  console.error('stdinPiped:', stdinPiped);
  console.error('stdoutPiped:', stdoutPiped);
  console.error('hasCliArgs:', hasCliArgs);
  console.error('isMCPServer:', isMCPServer);
  console.error('process.argv:', process.argv);
  console.error('process.platform:', process.platform);
  console.error('isWindows:', isWindows);
  console.error('NODE_ENV:', process.env.NODE_ENV);
  console.error('process.execPath:', process.execPath);
  console.error('__dirname equivalent:', import.meta.url);
}

async function main() {
  try {
    if (isMCPServer) {
      // Running as MCP server via Claude Code
      console.error('[claudepoint] Starting MCP server mode');
      await import('../src/mcp-server.js');
    } else {
      // Running as CLI
      console.error('[claudepoint] Starting CLI mode');
      await import('../src/cli.js');
    }
  } catch (error) {
    // Enhanced error reporting for Windows troubleshooting
    console.error('Failed to start ClaudePoint:', error.message);
    
    if (isWindows && error.message.includes('bash')) {
      console.error('');
      console.error('Windows-specific troubleshooting:');
      console.error('1. Make sure Node.js is properly installed and in your PATH');
      console.error('2. Try running from Command Prompt instead of Git Bash');
      console.error('3. Check that the MCP server configuration uses the correct Node.js path');
      console.error('4. Run with DEBUG=1 for more detailed information');
    }
    
    if (process.env.DEBUG) {
      console.error('Full error stack:', error.stack);
    }
    
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error in main():', error);
  if (process.env.DEBUG) {
    console.error('Error stack:', error.stack);
  }
  process.exit(1);
});