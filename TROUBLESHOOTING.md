# ClaudePoint Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

```bash
# Permission errors on global install
sudo npm install -g claudepoint

# Alternative: local install
npm install claudepoint
npx claudepoint setup
```

### Claude Code MCP Issues

```bash
# Run this diagnostic command
echo "Testing MCP server" | claudepoint

# Should show MCP initialization messages
# If not, check your Claude Code config
```

**Solution**: Ensure your `claude_code_config.json` has the correct path:
```json
{
  "mcpServers": {
    "claudepoint": {
      "command": "claudepoint"
    }
  }
}
```

### Claude Desktop Issues

1. Verify config file location and syntax
2. Check logs in Claude Desktop developer console
3. Ensure no trailing commas in JSON config
4. Restart Claude Desktop after config changes

#### Working Directory Issues (macOS)

If ClaudePoint tries to create checkpoints in the wrong directory (like root `/`), add the `CLAUDEPOINT_PROJECT_DIR` environment variable:

```json
{
  "mcpServers": {
    "claudepoint": {
      "command": "/usr/local/bin/node",
      "args": ["/usr/local/lib/node_modules/claudepoint/bin/claudepoint.js"],
      "env": {
        "CLAUDEPOINT_PROJECT_DIR": "/Users/YourName/Projects/YourProject"
      }
    }
  }
}
```

#### Multi-Project Setup

To manage multiple projects simultaneously, create separate MCP server entries:

```json
{
  "mcpServers": {
    "claudepoint-project1": {
      "command": "claudepoint",
      "env": {
        "CLAUDEPOINT_PROJECT_DIR": "/path/to/project1"
      }
    },
    "claudepoint-project2": {
      "command": "claudepoint",
      "env": {
        "CLAUDEPOINT_PROJECT_DIR": "/path/to/project2"
      }
    }
  }
}
```

### "No files found to checkpoint"

1. Run `claudepoint setup` first
2. Ensure you're in the correct directory
3. Check that files aren't all ignored by .gitignore

### Command Not Found

```bash
# Check npm global install path
npm list -g claudepoint

# Add npm global bin to PATH
export PATH="$PATH:$(npm bin -g)"

# Or use npx
npx claudepoint setup
```

## Windows-Specific Issues

### Issue 1: "bash not found" errors

If you're experiencing MCP server startup issues on Windows:

**Solution 1**: Use absolute paths in Claude Desktop config:
```json
{
  "claudepoint": {
    "command": "C:\\Program Files\\nodejs\\node.exe",
    "args": ["C:\\Users\\YourName\\AppData\\Roaming\\npm\\node_modules\\claudepoint\\bin\\claudepoint.js"]
  }
}
```

**Solution 2**: Use the Windows-specific wrapper scripts:
- For Command Prompt: Use `claudepoint.cmd`
- For PowerShell: Use `claudepoint.ps1`

**Solution 3**: Install Windows Subsystem for Linux (WSL) for full compatibility

### Issue 2: Wrong working directory (COMMON)

If ClaudePoint creates checkpoints in your home directory instead of the project directory:

**For Command Line (Recommended)**:
```bash
# Always navigate to your project first
cd C:\Projects\MyProject
claudepoint setup
```

**For Claude Desktop**:
```json
{
  "claudepoint": {
    "command": "claudepoint",
    "env": {
      "CLAUDEPOINT_PROJECT_DIR": "C:\\Projects\\MyProject"
    }
  }
}
```

**Alternative**: Create a batch file wrapper:
```batch
@echo off
cd /d "C:\Projects\MyProject"
claudepoint %*
```

### Issue 3: Path separator issues

Windows uses backslashes (`\`) for paths. In JSON config files, you must escape them:
- Wrong: `"C:\Projects\MyProject"`
- Right: `"C:\\Projects\\MyProject"`

Or use forward slashes (Node.js handles both):
- Also right: `"C:/Projects/MyProject"`

## Debug Mode

Enable debug output for troubleshooting:

```bash
# Unix/macOS
DEBUG=1 claudepoint setup

# Windows Command Prompt
set DEBUG=1 && claudepoint setup

# Windows PowerShell
$env:DEBUG=1; claudepoint setup
```

## Getting Help

If you're still experiencing issues:

1. Check existing [GitHub Issues](https://github.com/Andycufari/ClaudePoint/issues)
2. Create a new issue with:
   - Your operating system and version
   - Node.js version (`node --version`)
   - ClaudePoint version (`claudepoint --version`)
   - Complete error messages
   - Steps to reproduce the issue

## Known Limitations

- Symlinks are not followed during checkpoint creation
- Binary files larger than 100MB may cause performance issues
- Maximum path length limitations on Windows (260 characters)
- Some antivirus software may interfere with file operations

## Performance Tips

- Add large directories to `.checkpoints/config.json` ignore patterns
- Use incremental checkpoints (enabled by default)
- Regularly clean up old checkpoints
- Consider increasing Node.js memory limit for very large projects:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" claudepoint create
  ```