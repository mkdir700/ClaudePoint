import fs from 'fs';
import path from 'path';

const { promises: fsPromises } = fs;

async function initializeSlashCommands(projectRoot = process.cwd()) {
  const commandsDir = path.join(projectRoot, '.claude', 'commands');
  
  // Create commands directory
  await fsPromises.mkdir(commandsDir, { recursive: true });
  
  // Create /claudepoint command (main action)
  const claudepointContent = `---
description: Deploy a new claudepoint // Lock in your digital DNA
argument-hint: [name] [description]
---

💾 Deploy a claudepoint! Use the ClaudePoint MCP tool to create a new claudepoint.

If arguments are provided:
- First argument: claudepoint name  
- Remaining arguments: description

Example: /claudepoint auth-working Authentication system hacked to perfection

Steps:
1. Use the create_claudepoint tool from ClaudePoint
2. Pass the name and description from $ARGUMENTS if provided
3. Celebrate the successful deployment with a cool message!
`;
  
  // Create /claudepoint-restore command
  const claudepointRestoreContent = `---
description: Time travel to a specific claudepoint // Precision restoration
---

🔄 Help the user time travel using ClaudePoint's restore_claudepoint tool.

Steps:
1. First, use the list_claudepoints tool to show all available claudepoints with numbering
2. Ask the user: "Which claudepoint would you like to time travel to? Please provide the number or name."
3. Wait for the user to respond with their selection
4. Use the restore_claudepoint tool with the selected claudepoint name
5. Celebrate the successful time travel with a cool message!

Important: Always show the numbered list first and wait for user selection.
`;
  
  // Create /claudepoint-list command
  const claudepointListContent = `---
description: Browse your claudepoint vault // Digital artifact collection
---

🗂️ Use the ClaudePoint MCP tool list_claudepoints to browse your vault.

Display the results with hacker style showing:
- Claudepoint name
- Description
- Date created
- Number of files
- Size
`;
  
  // Create /claudepoint-status command
  const claudepointStatusContent = `---
description: Show claudepoint status and recent hacking activity
---

📡 Show the current status of your claudepoint vault using ClaudePoint tools.

Steps:
1. Use list_claudepoints to get total number and show the latest one
2. Use get_changelog to show recent activity
3. Present a summary including:
   - Total number of claudepoints
   - Latest claudepoint details  
   - Recent operations (last 5 entries)
   
Format with cool emojis and hacker language!
`;

  // Create /claudepoint-init-hooks command
  const initHooksContent = `---
description: Initialize ClaudePoint hooks integration with Claude Code
---

Initialize ClaudePoint hooks to enable automatic safety checkpoints before major file operations.

Steps:
1. First check current status: \`claudepoint hooks status\`
2. If hooks are already configured and installed, inform the user they're already set up
3. If not configured: Run \`claudepoint init-hooks --install\` to automatically configure and install
4. If hooks are configured but not installed: Run \`claudepoint init-hooks --install\` to install to Claude Code settings
5. Explain what hooks will do:
   - Create automatic safety checkpoints before bulk file operations
   - Only enabled triggers will be active (by default: before_bulk_edit)
   - User can manage with \`claudepoint hooks status\` and \`claudepoint hooks configure\`

IMPORTANT: Always check status first before running init-hooks to avoid duplicate setup.
`;

  // Create /claudepoint-hooks-status command  
  const hooksStatusContent = `---
description: Show current ClaudePoint hooks configuration and installation status
---

Show the user their current ClaudePoint hooks configuration and whether they're properly installed.

Steps:
1. Run the CLI command: \`claudepoint hooks status\`
2. Explain the status output:
   - CONFIGURED & INSTALLED = Hooks are working
   - CONFIGURED BUT NOT INSTALLED = Need to run \`claudepoint init-hooks --install\`
   - DISABLED = Hooks are turned off locally
3. Show which triggers are available and their current state (CONFIGURED vs NOT IN CLAUDE CODE)
4. If hooks are not installed, suggest running \`claudepoint init-hooks --install\`

This helps users understand exactly what state their hooks are in.
`;

  // Create /claudepoint-hooks-toggle-changelog command
  const toggleChangelogContent = `---
description: Toggle automatic changelog entries for ClaudePoint hooks
---

Toggle whether ClaudePoint hooks automatically create changelog entries when creating safety checkpoints.

Steps:
1. Ask the user: "Do you want to enable or disable automatic changelog entries for hooks? (enable/disable)"
2. Wait for their response
3. Run the appropriate command:
   - To enable: \`claudepoint hooks set-changelog true\`
   - To disable: \`claudepoint hooks set-changelog false\`
4. Confirm the change and explain the impact:
   - Enabled: Hooks will create both checkpoints AND changelog entries
   - Disabled: Hooks will only create safety checkpoints

This gives users control over documentation level.
`;

  // Create /ultrathink command
  const ultrathinkContent = `---
description: Activate ultrathink mode // Deep analysis and reasoning
---

🧠 Execute ultrathink prompt for enhanced reasoning and analysis.

This command simply runs the "ultrathink" prompt to activate Claude's deep thinking mode.

Steps:
1. Execute the prompt: ultrathink
2. Let Claude engage in enhanced reasoning and analysis

Perfect for complex problems that need deeper thought.
`;

  // Create /undo command
  const undoContent = `---
description: Instant time hack // Quick restore to your last claudepoint
---

🔄 Instant time travel back to your last claudepoint! Use the ClaudePoint MCP tool for quick restoration.

Steps:
1. Use the undo_claudepoint tool from ClaudePoint
2. This will automatically restore your last claudepoint
3. Celebrate the successful time hack with a cool message!

Perfect for when you need to quickly undo recent changes and get back to a stable state.
`;

  // Create /changes command
  const changesContent = `---
description: Scan codebase for changes // See what's different since your last claudepoint
---

🔍 Use the ClaudePoint MCP tool get_changes to scan for modifications.

Steps:
1. Use the get_changes tool from ClaudePoint
2. Display changes with cool hacker formatting:
   - Added files (green +)
   - Modified files (yellow ~) 
   - Deleted files (red -)
3. Show totals and encourage deployment if changes found

Perfect for reviewing what Claude Code has modified in your project.
`;

  // Create /diff command
  const diffContent = `---
description: Terminal diff // Compare checkpoint files with current state using terminal tools
argument-hint: [checkpoint] [file] [--all] [--tool <tool>]
---

🔍 Compare checkpoint files with current state using powerful terminal diff tools.

Parse $ARGUMENTS to extract:
- checkpoint: Name or partial name of checkpoint to compare against
- file: Optional specific file to compare
- --all flag: Compare all changed files at once
- --tool flag: Diff tool to use (terminal, git, delta, nvim)

Steps:
1. If no checkpoint specified, use list_claudepoints to show available options
2. Use the CLI command: \`claudepoint diff [checkpoint] [file] --tool terminal --all\`
3. Available tools:
   - terminal: Standard diff with colors
   - git: Git diff with syntax highlighting
   - delta: Beautiful git diff with enhanced colors
   - nvim: Interactive diff in Neovim

Examples:
- /diff checkpoint_name src/app.js --tool git     # Git diff for specific file
- /diff checkpoint_name --all --tool delta       # Delta diff for all files
- /diff checkpoint_name --tool nvim              # Interactive nvim diff
- /diff                                          # Show available checkpoints

Perfect for reviewing changes in your terminal with professional diff tools!
`;

  // Create /claudepoint-changelog command
  const claudepointChangelogContent = `---
description: View your coding adventure timeline // Development history
---

📡 Use the ClaudePoint MCP tool get_changelog to view your development timeline.

Display the timeline with:
- Action types (CREATE_CLAUDEPOINT, RESTORE, etc.)
- Timestamps
- Descriptions and details
- Recent activity focus

This shows your complete coding journey across all sessions.
`;

  // Create /claudepoint-changelog-add command  
  const claudepointChangelogAddContent = `---
description: Add custom entry to development timeline // Document your work
argument-hint: [description] [details]
---

📝 Use the ClaudePoint MCP tool set_changelog to add custom timeline entries.

If arguments are provided:
- First part: description of what was done
- Remaining: detailed explanation

Example: /claudepoint-changelog-add "Fixed authentication bug" "Resolved OAuth token expiration issue affecting user sessions"

Steps:
1. Use the set_changelog tool with appropriate action type
2. Pass description and details from $ARGUMENTS
3. Confirm the entry was added to timeline

Great for documenting your work as you go!
`;

  // Create /claudepoint-setup command
  const claudepointSetupContent = `---
description: Initialize ClaudePoint // Setup project for hacking
---

🎆 Use the ClaudePoint MCP tool setup_claudepoint to initialize ClaudePoint.

This will:
- Create .claudepoint directory structure
- Update .gitignore for stealth mode
- Create initial configuration
- Deploy initial claudepoint if project has files

Steps:
1. Use setup_claudepoint tool
2. Celebrate ClaudePoint going online!
3. Explain next steps for fearless experimentation

Perfect for getting started with ClaudePoint in any project.
`;
  
  // Write all command files with clean names
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint.md'), claudepointContent);
  await fsPromises.writeFile(path.join(commandsDir, 'undo.md'), undoContent);
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint-list.md'), claudepointListContent);
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint-restore.md'), claudepointRestoreContent);
  await fsPromises.writeFile(path.join(commandsDir, 'changes.md'), changesContent);
  await fsPromises.writeFile(path.join(commandsDir, 'diff.md'), diffContent);
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint-changelog.md'), claudepointChangelogContent);
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint-changelog-add.md'), claudepointChangelogAddContent);
  await fsPromises.writeFile(path.join(commandsDir, 'ultrathink.md'), ultrathinkContent);
  
  return {
    success: true,
    commandsCreated: [
      'claudepoint',
      'undo',
      'claudepoint-list',
      'claudepoint-restore', 
      'changes',
      'diff',
      'claudepoint-changelog',
      'claudepoint-changelog-add',
      'ultrathink'
    ]
  };
}

export { initializeSlashCommands };
