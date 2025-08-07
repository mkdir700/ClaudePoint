import fs from 'fs';
import path from 'path';

const { promises: fsPromises } = fs;

async function initializeSlashCommands(projectRoot = process.cwd()) {
  const commandsDir = path.join(projectRoot, '.claude', 'commands');
  
  // Create commands directory
  await fsPromises.mkdir(commandsDir, { recursive: true });
  
  // Create /create-checkpoint command
  const createCheckpointContent = `---
description: Create a new checkpoint of your codebase
argument-hint: [name] [description]
---

Use the ClaudePoint MCP tool to create a new checkpoint.

If arguments are provided:
- First argument: checkpoint name
- Remaining arguments: description

Example: /create-checkpoint auth-working Authentication system working perfectly

Steps:
1. Use the create_checkpoint tool from ClaudePoint
2. Pass the name and description from $ARGUMENTS if provided
3. Confirm the checkpoint was created successfully
`;
  
  // Create /restore-checkpoint command
  const restoreCheckpointContent = `---
description: Restore a previous checkpoint with interactive selection
---

Help the user restore a checkpoint using ClaudePoint's restore_checkpoint tool.

Steps:
1. First, use the list_checkpoints tool to show all available checkpoints with numbering
2. Ask the user: "Which checkpoint would you like to restore? Please provide the number or name."
3. Wait for the user to respond with their selection
4. Use the restore_checkpoint tool with the selected checkpoint name
5. Confirm the restoration was successful

Important: Always show the numbered list first and wait for user selection.
`;
  
  // Create /list-checkpoints command
  const listCheckpointsContent = `---
description: List all available checkpoints
---

Use the ClaudePoint MCP tool list_checkpoints to show all available checkpoints.

Display the results in a clear, organized format showing:
- Checkpoint name
- Description
- Date created
- Number of files
- Size
`;
  
  // Create /checkpoint-status command
  const checkpointStatusContent = `---
description: Show current checkpoint status and recent activity
---

Show the current status of checkpoints in this project using ClaudePoint tools.

Steps:
1. Use list_checkpoints to get total number of checkpoints and show the latest one
2. Use get_changelog to show recent checkpoint activity
3. Present a summary including:
   - Total number of checkpoints
   - Latest checkpoint details
   - Recent checkpoint operations (last 5 entries)
   
Format the output clearly to give a quick overview of the checkpoint system status.
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
  
  // Write all command files
  await fsPromises.writeFile(path.join(commandsDir, 'create-checkpoint.md'), createCheckpointContent);
  await fsPromises.writeFile(path.join(commandsDir, 'restore-checkpoint.md'), restoreCheckpointContent);
  await fsPromises.writeFile(path.join(commandsDir, 'list-checkpoints.md'), listCheckpointsContent);
  await fsPromises.writeFile(path.join(commandsDir, 'checkpoint-status.md'), checkpointStatusContent);
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint-init-hooks.md'), initHooksContent);
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint-hooks-status.md'), hooksStatusContent);
  await fsPromises.writeFile(path.join(commandsDir, 'claudepoint-hooks-toggle-changelog.md'), toggleChangelogContent);
  
  return {
    success: true,
    commandsCreated: [
      'create-checkpoint',
      'restore-checkpoint', 
      'list-checkpoints',
      'checkpoint-status',
      'claudepoint-init-hooks',
      'claudepoint-hooks-status', 
      'claudepoint-hooks-toggle-changelog'
    ]
  };
}

export { initializeSlashCommands };