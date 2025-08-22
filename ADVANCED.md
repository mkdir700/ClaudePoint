# Advanced ClaudePoint Usage

This guide covers advanced topics for power users and edge cases.

## Multi-Project Setup

To manage multiple projects simultaneously, create separate MCP server entries:

```json
{
  "mcpServers": {
    "claudepoint-web": {
      "command": "claudepoint",
      "env": {
        "CLAUDEPOINT_PROJECT_DIR": "/path/to/web-project"
      }
    },
    "claudepoint-api": {
      "command": "claudepoint",
      "env": {
        "CLAUDEPOINT_PROJECT_DIR": "/path/to/api-project"
      }
    }
  }
}
```

## Hooks Advanced Configuration

### Custom Trigger Patterns

Configure hooks for specific workflows:

```bash
# Enable specific triggers
claudepoint hooks enable before_bash_commands
claudepoint hooks enable before_file_operations

# Set auto-changelog for detailed tracking
claudepoint hooks set-changelog true
```

### Hook Configuration File

The `.checkpoints/hooks.json` file:

```json
{
  "enabled": true,
  "auto_changelog": true,
  "triggers": {
    "before_bulk_edit": {
      "enabled": true,
      "tools": ["MultiEdit"],
      "description": "Safety checkpoint before bulk file edits"
    },
    "before_major_write": {
      "enabled": false,
      "tools": ["Write"],
      "description": "Safety checkpoint before major file writes"
    },
    "before_bash_commands": {
      "enabled": false,
      "tools": ["Bash"],
      "description": "Safety checkpoint before executing bash commands"
    },
    "before_file_operations": {
      "enabled": false,
      "tools": ["Edit", "MultiEdit", "Write"],
      "description": "Safety checkpoint before any file modification"
    }
  }
}
```

## Performance Optimization

### Large Projects

For projects with many files or large binaries:

1. **Update ignore patterns**:
   ```json
   {
     "ignorePatterns": [
       "*.mp4", "*.mov", "*.zip",
       "vendor/", "cache/", "tmp/",
       "*.sqlite", "*.db"
     ]
   }
   ```

2. **Increase Node.js memory**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" claudepoint create
   ```

3. **Use force include for specific files**:
   ```json
   {
     "forceInclude": [".env.example", "docs/**/*.md"]
   }
   ```

## Incremental Checkpoint Tuning

### Custom Chain Length

Adjust incremental checkpoint behavior:

```json
{
  "incremental": {
    "enabled": true,
    "fullSnapshotInterval": 10,  // More incremental checkpoints
    "maxChainLength": 50          // Longer chains for maximum efficiency
  }
}
```

### Force Full Checkpoints

For major milestones:

```bash
# Force a full checkpoint
claudepoint create --full --description "Version 1.0 release"

# Via Claude
"Create a full checkpoint for the v1.0 release"
```

## Working Directory Issues

### macOS/Linux

If ClaudePoint operates in the wrong directory:

```json
{
  "mcpServers": {
    "claudepoint": {
      "command": "/usr/local/bin/node",
      "args": ["/usr/local/lib/node_modules/claudepoint/bin/claudepoint.js"],
      "env": {
        "CLAUDEPOINT_PROJECT_DIR": "/Users/username/project"
      }
    }
  }
}
```

### Windows

For Windows-specific path issues:

```json
{
  "mcpServers": {
    "claudepoint": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\USER\\AppData\\Roaming\\npm\\node_modules\\claudepoint\\bin\\claudepoint.js"],
      "env": {
        "CLAUDEPOINT_PROJECT_DIR": "C:\\Projects\\MyProject"
      }
    }
  }
}
```

## Development Workflow Patterns

### Feature Branch Pattern

```bash
# 1. Create checkpoint before new feature
claudepoint create --description "Before user-profile feature"

# 2. Work on feature...

# 3. Create checkpoint at milestone
claudepoint create --description "User profile UI complete"

# 4. If something breaks
claudepoint restore "user-profile"
```

### Experimentation Pattern

```bash
# 1. Checkpoint current stable state
claudepoint create --description "Stable - all tests passing"

# 2. Try risky refactoring
# ... make changes ...

# 3. If it doesn't work out
claudepoint restore "stable" --dry-run  # Preview first
claudepoint restore "stable"            # Restore
```

### Debug Pattern

```bash
# 1. Create checkpoint before debugging
claudepoint create --description "Before debugging memory leak"

# 2. Add debug code, console logs, etc.
# ... debug the issue ...

# 3. After fixing, restore clean state
claudepoint restore "before-debugging"

# 4. Apply only the fix
# ... apply the actual fix without debug code ...
```

## Diff and Comparison

### Visual Diff with Multiple Tools

ClaudePoint provides powerful diff capabilities to compare checkpoints with current files:

```bash
# Compare specific file with checkpoint
claudepoint diff checkpoint-name file.js

# Compare all changed files (opens in VSCode by default)
claudepoint diff checkpoint-name --all

# Use different diff tools
claudepoint diff checkpoint-name --tool terminal
claudepoint diff checkpoint-name --tool git
claudepoint diff checkpoint-name --tool nvim

# Customize terminal diff output
claudepoint diff checkpoint-name file.js --tool terminal --unified 5
```

### Diff Tool Options

**VSCode (Default)**
- Opens side-by-side diff view
- Best for visual comparison
- Supports multiple files simultaneously

```bash
claudepoint diff my-checkpoint --all --tool vscode
claudepoint diff my-checkpoint file.js --wait  # Wait for VSCode to close
```

**Terminal**
- Quick command-line diff
- Good for CI/CD environments
- Customizable context lines

```bash
claudepoint diff my-checkpoint --tool terminal --unified 3
```

**Git**
- Uses git's built-in diff
- Familiar for git users
- Respects git configuration

```bash
claudepoint diff my-checkpoint --tool git
```

**Neovim**
- For vim users
- Terminal-based visual diff

```bash
claudepoint diff my-checkpoint --tool nvim
```

### Diff Workflow Patterns

**Review Changes Before Checkpoint**
```bash
# See what's changed since last checkpoint
claudepoint changes

# Review specific changes
claudepoint diff last-checkpoint file.js

# Create checkpoint after review
claudepoint create --description "Reviewed and approved changes"
```

**Compare Different Checkpoints**
```bash
# Compare current state with specific checkpoint
claudepoint diff stable-version --all

# Compare specific files across time
claudepoint diff before-refactor src/main.js
claudepoint diff after-refactor src/main.js
```

**Batch File Comparison**
```bash
# Compare up to 10 files (default)
claudepoint diff my-checkpoint --all

# Compare more files
claudepoint diff my-checkpoint --all --max-files 20

# Review all changes in terminal
claudepoint diff my-checkpoint --all --tool terminal
```

### Integration with Development Workflow

**Code Review Pattern**
```bash
# 1. Create checkpoint before starting feature
claudepoint create --description "Before user-auth feature"

# 2. Work on feature...

# 3. Review all changes before committing
claudepoint diff before-user-auth --all

# 4. Create final checkpoint
claudepoint create --description "User auth feature complete"
```

**Debugging Pattern**
```bash
# 1. Checkpoint working state
claudepoint create --description "Working state before debug"

# 2. Add debug code and investigate...

# 3. Compare to see what debug code was added
claudepoint diff working-state --all --tool terminal

# 4. Restore clean state and apply only the fix
claudepoint restore working-state
```

## Integration with CI/CD

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
claudepoint create --description "Pre-commit checkpoint: $(git log -1 --pretty=%B)"
```

### GitHub Actions

```yaml
- name: Create checkpoint before deployment
  run: |
    npm install -g claudepoint
    claudepoint setup
    claudepoint create --description "Pre-deployment checkpoint"
```

## Roadmap & Future Features

### Planned Enhancements

- **Post-Edit Checkpoints**: Automatic checkpoints after Claude finishes editing
- **Smart Batching**: Group rapid changes into single checkpoint
- **Checkpoint Tagging**: Label by feature/bug/refactor type
- **Selective Restoration**: Restore specific files only
- **Checkpoint Comparison**: Visual diff between checkpoints
- **Cloud Sync**: Direct S3/cloud storage integration

### Hook Evolution

Future hook triggers:
- `after_edit_completion` - After Claude finishes editing
- `after_successful_tests` - When tests pass
- `before_git_commit` - Git workflow integration
- `session_milestones` - Periodic session checkpoints

## Pro Tips

1. **Combine with Git**: Use ClaudePoint for rapid experimentation, Git for permanent history
2. **Name conventions**: Use prefixes like `feature/`, `fix/`, `experiment/`
3. **Regular snapshots**: Force full checkpoints at major milestones
4. **Clean as you go**: Periodically review and clean old checkpoints
5. **Document changes**: Use the changelog feature extensively

## Debugging ClaudePoint

Enable debug output:

```bash
# Unix/macOS
DEBUG=1 claudepoint create

# Windows
set DEBUG=1 && claudepoint create
```

Check MCP communication:

```bash
echo '{"method": "initialize"}' | claudepoint
```

## File Format Details

### Manifest Structure

Each checkpoint's `manifest.json`:

```json
{
  "name": "checkpoint_name",
  "timestamp": "ISO 8601 timestamp",
  "description": "User description",
  "type": "FULL|INCREMENTAL",
  "files": ["array", "of", "files"],
  "fileCount": 100,
  "totalSize": 1048576,
  "fileHashes": {
    "file.js": "sha256hash..."
  },
  "baseCheckpoint": "parent_checkpoint_name",
  "changes": {
    "added": ["new.js"],
    "modified": ["existing.js"],
    "deleted": ["old.js"]
  },
  "statistics": {
    "filesChanged": 3,
    "bytesAdded": 1024,
    "bytesModified": 2048
  }
}
```

### Changelog Format

The `.checkpoints/changelog.json`:

```json
[
  {
    "timestamp": "ISO 8601 timestamp",
    "action": "CREATE_CHECKPOINT|RESTORE_CHECKPOINT|CUSTOM",
    "description": "What happened",
    "details": "Additional context"
  }
]
```