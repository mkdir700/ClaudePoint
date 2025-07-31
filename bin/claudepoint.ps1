# PowerShell wrapper for ClaudePoint
# This ensures proper Node.js execution on Windows PowerShell

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "Using Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js not found. Please install Node.js and add it to your PATH."
    exit 1
}

# Get the directory of this script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Execute the main ClaudePoint script
$mainScript = Join-Path $scriptDir "claudepoint.js"

# Pass all arguments to the main script
& node $mainScript $args