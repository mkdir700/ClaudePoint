@echo off
REM Windows batch file wrapper for ClaudePoint
REM This ensures proper Node.js execution on Windows systems

REM Find Node.js executable
set NODE_EXE=node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js not found in PATH
    echo Please install Node.js or add it to your PATH environment variable
    exit /b 1
)

REM Get the directory of this batch file
set SCRIPT_DIR=%~dp0

REM Execute the main ClaudePoint script with proper path resolution
"%NODE_EXE%" "%SCRIPT_DIR%claudepoint.js" %*