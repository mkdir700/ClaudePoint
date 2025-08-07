# ClaudePoint MCP🎯

**The safest way to 'vive code' with Claude Code.** Create instant checkpoints of your codebase, experiment fearlessly, and restore instantly if things go wrong.

[![npm version](https://badge.fury.io/js/claudepoint.svg)](https://badge.fury.io/js/claudepoint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-18+-blue.svg)](https://nodejs.org/downloads/)

> *"The undo button your codebase deserves"*

## ✨ Features

- 🚀 **Global NPM package** - Install once, use everywhere
- 🤖 **Claude Code & Desktop integration** - Direct MCP support
- 📋 **Development history & changelog** - Track all activities with automatic logging
- 📝 **Custom changelog entries** - Claude Code can document its own changes
- 📦 **Smart compression** - Efficient tar.gz storage
- 🔍 **Gitignore aware** - Respects your .gitignore patterns
- 🛡️ **Safe restoration** - Auto-backup before every restore
- 🧹 **Auto cleanup** - Configurable checkpoint limits
- ⚡ **Fast operations** - Optimized for development workflows
- 🪝 **Claude Code Hooks** - Automatic safety checkpoints before major operations
- 💾 **Incremental Checkpoints** - Smart storage that saves only file changes

## 💾 Incremental Checkpoints (NEW!)

ClaudePoint now uses **incremental checkpoints by default**, dramatically reducing storage usage while maintaining full restoration capabilities.

### How It Works
- **First checkpoint**: Always creates a full snapshot
- **Subsequent checkpoints**: Only store changed files (added/modified/deleted)
- **Automatic detection**: ClaudePoint decides when to create full vs incremental checkpoints
- **Chain reconstruction**: Seamlessly rebuilds your project state from checkpoint chains

### Storage Savings
```
Traditional (Full) Checkpoints:
- Every checkpoint: 10MB project = 10MB storage
- 10 checkpoints = 100MB storage ❌

Incremental Checkpoints:
- First checkpoint: 10MB (full)
- Next 9 checkpoints: ~100KB each (only changes)
- 10 checkpoints = ~11MB storage ✅ (89% savings!)
```

### Visual Checkpoint Chain
```bash
claudepoint list --show-chain
```
```
📋 Available checkpoints (4):
  └─ 1. feature_complete_2025-01-15 [INC]
  └─    Feature implementation complete
  └─    1/15/2025 | 156 files | 2.1MB | 3 changes
  └─    ↳ based on: refactor_auth_2025-01-15

  ├─ 2. refactor_auth_2025-01-15 [INC]
  ├─    Refactored authentication
  ├─    1/15/2025 | 155 files | 2.1MB | 12 changes
  ├─    ↳ based on: initial_setup_2025-01-15

  3. initial_setup_2025-01-15 [FULL]
     Initial project setup
     1/15/2025 | 150 files | 2.0MB
```

### CLI Options
```bash
# Force a full checkpoint (useful for major milestones)
claudepoint create --full --description "Version 1.0 release"

# Normal usage (automatic incremental)
claudepoint create --description "Fixed login bug"

# View checkpoint relationships
claudepoint list --show-chain
```

### Configuration
Incremental checkpoints are enabled by default. You can customize in `.checkpoints/config.json`:
```json
{
  "incremental": {
    "enabled": true,                    // Enable/disable incremental mode
    "fullSnapshotInterval": 5,          // Create full snapshot every N checkpoints
    "maxChainLength": 20                // Maximum chain before forcing full snapshot
  }
}
```

## 🪝 Automatic Safety with Hooks (NEW!)

ClaudePoint integrates with Claude Code hooks to automatically create safety checkpoints before potentially destructive operations:

### Quick Setup
```bash
# Initialize hooks (creates local config + installs to Claude Code)
claudepoint init-hooks --install

# Check status and manage triggers
claudepoint hooks status
claudepoint hooks configure  # Interactive wizard
```

### Available Triggers
- **`before_bulk_edit`** - Safety checkpoint before MultiEdit operations (enabled by default)
- **`before_major_write`** - Safety checkpoint before Write operations (disabled by default)
- **`before_bash_commands`** - Safety checkpoint before Bash commands (disabled by default)
- **`before_file_operations`** - Safety checkpoint before any file changes (disabled by default)

### Management Commands
```bash
claudepoint hooks status                    # Show configuration and installation status
claudepoint hooks enable before_bash_commands   # Enable specific trigger
claudepoint hooks set-changelog true            # Enable automatic changelog entries
claudepoint hooks configure                     # Interactive configuration wizard
```

**Benefits**: Automatic safety without disrupting your workflow - hooks create checkpoints invisibly in the background before major changes!

## 🚀 Quick Start

### 1. Install ClaudePoint globally

```bash
npm install -g claudepoint
```

### 2. Configure Claude Code or Claude Desktop

#### For Claude Code (Command Line):
```bash
claude mcp add claudepoint claudepoint
```

#### For Claude Desktop (GUI Application):
Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "claudepoint": {
      "command": "claudepoint",
      "args": []
    }
  }
}
```

> **Note:** This basic configuration works for most users. Only configure the environment variable below if you need multi-project support or are experiencing working directory issues.

### 3. Initialize your project (ESSENTIAL FIRST STEP!)

```bash
# In your project directory - run this FIRST after npm install!
claudepoint setup
```

> **🚨 IMPORTANT**: Always run `claudepoint setup` as your first step in any new project to enable all ClaudePoint features including hooks and incremental checkpoints.

The **interactive setup wizard** will configure everything you need:
- ✅ Add .checkpoints to .gitignore? (Yes/No)
- ✅ Create initial checkpoint? (Yes/No) 
- ✅ Install Claude Code slash commands? (Yes/No)
- ✅ **Enable automatic safety hooks?** (Yes/No) ⭐ NEW!
  - Choose which triggers to enable (bash, file operations, etc.)
  - Configure auto-changelog for development history
- ✅ **Configure incremental checkpoints** (enabled by default) ⭐ NEW!

**What setup creates:**
- `.checkpoints/` directory with configuration
- Initial full checkpoint of your project
- Hook integration with Claude Code (if selected)
- Slash commands for faster workflow

For non-interactive setup: `claudepoint setup --no-interactive`

### 4. Let Claude manage checkpoints

**In any Claude Code or Claude Desktop conversation:**

- "Create a checkpoint before refactoring"
- "Show me our development history"
- "List all my checkpoints"
- "Restore the checkpoint from before the auth changes"
- "Log what you just changed"

Claude will automatically use ClaudePoint tools!

## 🤖 How to Instruct Claude

Once configured, you can naturally tell Claude:

### **Using Slash Commands (Fastest!):**
```
/create-checkpoint working-auth Everything works perfectly here
/list-checkpoints
/restore-checkpoint
/checkpoint-status
```

### **Project Setup:**
```
"Setup checkpoints for this project and show me what we've worked on before"
```

### **Before making changes:**
```
"Create a checkpoint before you start - call it 'before auth refactor'"
```

### **During development:**
```
"Now refactor the authentication to use OAuth, and log what you're doing"
```

### **After changes:**
```
"Document that you just added the OAuth integration with detailed changelog entry"
```

### **Session context:**
```
"What checkpoints do we have and what was the last thing we were working on?"
```

### **Recovery:**
```
"Something went wrong, restore the last working checkpoint"
```

### **Development timeline:**
```
"Show me our complete development history across all sessions"
```

Claude will handle all operations automatically using the MCP tools!

## 🔧 Manual CLI Usage

You can also use ClaudePoint directly:

```bash
# Setup in any project
cd your-project
claudepoint setup

# Create checkpoint
claudepoint create --description "Before major refactor"

# List checkpoints
claudepoint list

# View development history
claudepoint changelog

# Add custom changelog entry
claudepoint log "Fixed authentication bug" --details "Resolved OAuth token expiration issue" --type "BUG_FIX"

# Restore checkpoint
claudepoint restore "before-major" --dry-run
claudepoint restore "before-major"

# Initialize slash commands for Claude Code
claudepoint init-commands
```

## 🚀 Slash Commands (NEW!)

ClaudePoint now supports Claude Code slash commands for faster operations! These commands appear in Claude Code when you type `/`.

### Setup Slash Commands

```bash
# During initial setup
claudepoint setup

# Or add to existing project
claudepoint init-commands
```

### Available Slash Commands

- **`/create-checkpoint`** - Create a checkpoint with optional name and description
  - Example: `/create-checkpoint auth-working Authentication system complete`
  
- **`/restore-checkpoint`** - Interactive checkpoint restoration
  - Shows numbered list of checkpoints
  - Waits for your selection (by number or name)
  
- **`/list-checkpoints`** - Quick view of all checkpoints
  
- **`/checkpoint-status`** - Current status and recent activity

### How It Works

The slash commands are simple markdown files in `.claude/commands/` that guide Claude to use the appropriate ClaudePoint MCP tools. You can customize them after generation to fit your workflow!

## 🛠️ MCP Tools (For Claude)

When Claude has ClaudePoint configured, it can use:

- **`setup_claudepoint`** - Initialize checkpoints in current project
- **`create_checkpoint`** - Create new checkpoint with name/description
- **`list_checkpoints`** - Show all available checkpoints
- **`restore_checkpoint`** - Restore previous state (with emergency backup)
- **`get_changelog`** - View development history and session activities
- **`set_changelog`** - Add custom entries to development history
- **`init_slash_commands`** - Initialize Claude Code slash commands for the project

## 📋 Development History & Session Continuity

ClaudePoint automatically tracks all your development activities and enables Claude to document its own work:

### **What Gets Tracked Automatically:**
- ✅ **Project setup** - When ClaudePoint was initialized
- ✅ **Checkpoint creation** - Every checkpoint with description
- ✅ **Checkpoint restoration** - When you rolled back changes
- ✅ **Emergency backups** - Auto-backups before restores

### **What Claude Can Log:**
- ✅ **Code changes** - "Refactored authentication system"
- ✅ **Bug fixes** - "Fixed memory leak in user sessions"
- ✅ **Feature additions** - "Added real-time chat functionality"
- ✅ **Optimizations** - "Improved API response times by 40%"

### **Example Development Timeline:**
```
📋 Development History:
1. SETUP - ClaudePoint initialized in project
2. CREATE_CHECKPOINT - Created checkpoint: initial_setup
3. REFACTOR - Refactored authentication system to use OAuth
4. CREATE_CHECKPOINT - Created checkpoint: oauth_implementation  
5. BUG_FIX - Fixed memory leak in user session handling
6. ADD_FEATURE - Added real-time chat functionality
7. RESTORE_CHECKPOINT - Restored checkpoint: oauth_implementation
```

### **Claude Integration Benefits:**
```
You: "What have we been working on?"
Claude: Uses get_changelog → Shows complete development timeline

You: "Refactor the auth system and document what you're doing"
Claude: 
1. Uses create_checkpoint → Saves current state
2. Makes the changes
3. Uses set_changelog → Documents "Refactored authentication to use OAuth"
```


## 🛡️ Safety & Storage

### What Gets Saved
- ✅ Respects .gitignore patterns
- ✅ Smart compression with tar.gz
- ✅ Incremental storage (only changes)
- ✅ Development history & metadata
- ✅ Auto-cleanup of old checkpoints

### Safety Features
- **Emergency Backup**: Auto-backup before every restore
- **Dry Run Mode**: Preview changes with `--dry-run`
- **Smart Matching**: Use partial checkpoint names
- **Session Memory**: Complete development timeline

## ⚙️ Configuration

Auto-created `.checkpoints/config.json`:

```json
{
  "maxCheckpoints": 10,
  "autoName": true,
  "ignorePatterns": [
    ".git", ".checkpoints", "node_modules", ".env", ".env.*",
    "*.log", ".DS_Store", "Thumbs.db", "__pycache__", "*.pyc",
    ".vscode", ".idea", "dist", "build", "coverage", ".nyc_output",
    ".next", ".nuxt", ".cache", "tmp", "temp"
  ],
  "additionalIgnores": ["my-custom-dir"],
  "nameTemplate": "checkpoint_{timestamp}"
}
```


## 🔧 Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

**Quick fixes:**
- **Installation issues**: `npm cache clean --force && npm install -g claudepoint`
- **Command not found**: Check PATH with `npm config get prefix`
- **Wrong directory**: Set `CLAUDEPOINT_PROJECT_DIR` in config
- **Windows issues**: Use absolute paths in config


## 📊 Why ClaudePoint?

| Feature | ClaudePoint | Git Commits | File Copies |
|---------|------------|-------------|-------------|
| **Setup Time** | 30 seconds | Minutes | Manual |
| **Claude Integration** | ✅ Native | ❌ | ❌ |
| **Auto Documentation** | ✅ With AI | ❌ | ❌ |
| **Session Continuity** | ✅ Complete | ❌ | ❌ |
| **Emergency Backup** | ✅ Always | ❌ | ❌ |
| **Fast Restore** | ✅ Instant | ❌ Complex | ❌ Manual |
| **Space Efficient** | ✅ Compressed | ✅ | ❌ |
| **Development Timeline** | ✅ Rich History | ❌ Basic | ❌ |


## 📚 Documentation

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Detailed troubleshooting guide
- [ADVANCED.md](ADVANCED.md) - Advanced usage, patterns, and configuration
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🐛 Issues & Support

- 🐛 **Bug reports**: [GitHub Issues](https://github.com/Andycufari/ClaudePoint/issues)
- 💡 **Feature requests**: [GitHub Issues](https://github.com/Andycufari/ClaudePoint/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Andycufari/ClaudePoint/discussions)

## ⭐ Show Your Support

If ClaudePoint saves your code (and sanity), give it a star! ⭐

## 📄 License

MIT License - Use it however you want!

---

**Made with ❤️ for the Claude Code community**

Follow [@Andycufari](https://x.com/andycufari) for more dev tools!
