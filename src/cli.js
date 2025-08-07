/**
 * ClaudePoint CLI
 * Command line interface for checkpoint management
 */

import { program } from 'commander';
import CheckpointManager from './lib/checkpoint-manager.js';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { initializeSlashCommands } from './lib/slash-commands.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const { promises: fsPromises } = fs;
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

program
  .name('claudepoint')
  .description('The safest way to experiment with Claude Code')
  .version(packageJson.version);

program
  .command('setup')
  .description('Setup ClaudePoint in the current project')
  .option('--no-interactive', 'Skip interactive setup prompts')
  .action(async (options) => {
    console.log(chalk.blue('🎯 Welcome to ClaudePoint Setup!\n'));
    
    try {
      const manager = new CheckpointManager();
      
      // Interactive setup by default
      if (options.interactive !== false) {
        console.log(chalk.gray('This wizard will help you configure ClaudePoint for your project.\n'));
        
        // Ask about gitignore
        const { updateGitignore } = await inquirer.prompt([{
          type: 'confirm',
          name: 'updateGitignore',
          message: 'Add .checkpoints to .gitignore?',
          default: true
        }]);
        
        // Ask about initial checkpoint
        const { createInitial } = await inquirer.prompt([{
          type: 'confirm',
          name: 'createInitial',
          message: 'Create an initial checkpoint of your project?',
          default: true
        }]);
        
        // Ask about slash commands
        const { installCommands } = await inquirer.prompt([{
          type: 'confirm',
          name: 'installCommands',
          message: 'Install Claude Code slash commands (/create-checkpoint, etc)?',
          default: true
        }]);
        
        // Ask about hooks
        const { installHooks } = await inquirer.prompt([{
          type: 'confirm',
          name: 'installHooks',
          message: 'Enable automatic safety checkpoints (hooks)?',
          default: true
        }]);
        
        let hooksConfig = null;
        if (installHooks) {
          const { hookChoices } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'hookChoices',
            message: 'Which safety triggers would you like to enable?',
            choices: [
              { name: 'Before bulk edits (MultiEdit)', value: 'before_bulk_edit', checked: true },
              { name: 'Before file writes (Write)', value: 'before_major_write', checked: false },
              { name: 'Before bash commands', value: 'before_bash_commands', checked: false },
              { name: 'Before any file changes', value: 'before_file_operations', checked: false }
            ]
          }]);
          
          const { enableChangelog } = await inquirer.prompt([{
            type: 'confirm',
            name: 'enableChangelog',
            message: 'Enable automatic changelog entries for hook-created checkpoints?',
            default: false
          }]);
          
          hooksConfig = { triggers: hookChoices, enableChangelog };
        }
        
        // Now perform setup with chosen options
        const spinner = ora('Setting up ClaudePoint...').start();
        const result = await manager.setup({ 
          updateGitignore, 
          createInitial 
        });
        
        if (result.success) {
          spinner.succeed('ClaudePoint core setup complete!');
          console.log(chalk.green('✅ Created .checkpoints directory'));
          if (updateGitignore) {
            console.log(chalk.green('✅ Updated .gitignore'));
          }
          console.log(chalk.green('✅ Created configuration'));
          
          if (result.initialCheckpoint) {
            console.log(chalk.green(`✅ Created initial checkpoint: ${result.initialCheckpoint}`));
          }
          
          // Install slash commands if requested
          if (installCommands) {
            spinner.start('Creating Claude Code slash commands...');
            await initializeSlashCommands();
            spinner.succeed('Slash commands created!');
            console.log(chalk.green('✅ Created .claude/commands directory'));
            console.log(chalk.green('✅ Added 4 slash commands'));
          }
          
          // Setup hooks if requested
          if (installHooks) {
            spinner.start('Configuring hooks...');
            const hooksManager = new CheckpointManager();
            const hooksConfigData = await hooksManager.loadHooksConfig();
            
            // Update enabled triggers
            Object.keys(hooksConfigData.triggers).forEach(trigger => {
              hooksConfigData.triggers[trigger].enabled = hooksConfig.triggers.includes(trigger);
            });
            hooksConfigData.auto_changelog = hooksConfig.enableChangelog;
            
            await hooksManager.saveHooksConfig(hooksConfigData);
            
            // Install to Claude Code settings
            const { execSync } = await import('child_process');
            try {
              execSync('claudepoint init-hooks --install', { stdio: 'pipe' });
              spinner.succeed('Hooks configured and installed!');
              console.log(chalk.green('✅ Enabled triggers: ' + hooksConfig.triggers.join(', ')));
            } catch (error) {
              spinner.succeed('Hooks configured!');
              console.log(chalk.yellow('⚠️  Run "claudepoint init-hooks --install" to activate hooks in Claude Code'));
            }
          }
          
          // Show summary
          console.log(chalk.blue('\n✨ Setup Summary:'));
          console.log(`  📁 Checkpoints: ${chalk.green('Ready')}`);
          console.log(`  🔧 Gitignore: ${updateGitignore ? chalk.green('Updated') : chalk.gray('Skipped')}`);
          console.log(`  📸 Initial checkpoint: ${createInitial && result.initialCheckpoint ? chalk.green('Created') : chalk.gray('Skipped')}`);
          console.log(`  📝 Slash commands: ${installCommands ? chalk.green('Installed') : chalk.gray('Skipped')}`);
          console.log(`  🪝 Hooks: ${installHooks ? chalk.green('Configured') : chalk.gray('Skipped')}`);
          
          console.log(chalk.yellow('\n💡 Next steps:'));
          console.log('  1. Start using ClaudePoint with Claude Code');
          console.log('  2. Create checkpoints before major changes');
          console.log('  3. Use "claudepoint --help" to see all commands');
        } else {
          spinner.fail(`Setup failed: ${result.error}`);
          process.exit(1);
        }
      } else {
        // Non-interactive mode (original behavior)
        const spinner = ora('Setting up ClaudePoint...').start();
        const result = await manager.setup();
        
        if (result.success) {
          spinner.succeed('ClaudePoint setup complete!');
          console.log(chalk.green('✅ Created .checkpoints directory'));
          console.log(chalk.green('✅ Updated .gitignore'));
          console.log(chalk.green('✅ Created configuration'));
          
          if (result.initialCheckpoint) {
            console.log(chalk.green(`✅ Created initial checkpoint: ${result.initialCheckpoint}`));
          }
          
          console.log(chalk.yellow('\n💡 Run "claudepoint setup" again for interactive configuration'));
        } else {
          spinner.fail(`Setup failed: ${result.error}`);
          process.exit(1);
        }
      }
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('create')
  .description('Create a new checkpoint')
  .option('-n, --name <n>', 'Custom checkpoint name')
  .option('-d, --description <description>', 'Checkpoint description')
  .option('-f, --full', 'Force full checkpoint (disable incremental)')
  .action(async (options) => {
    const spinner = ora('Creating checkpoint...').start();
    
    try {
      const manager = new CheckpointManager();
      const result = await manager.create(options.name, options.description, options.full);
      
      if (result.success) {
        const typeLabel = result.type === 'FULL' ? chalk.green('[FULL]') : chalk.yellow('[INC]');
        spinner.succeed(`Checkpoint created: ${chalk.cyan(result.name)} ${typeLabel}`);
        console.log(`   Files: ${result.fileCount}`);
        if (result.type === 'INCREMENTAL') {
          console.log(`   Changes: ${result.changesCount}`);
        }
        console.log(`   Size: ${result.size}`);
        console.log(`   Description: ${result.description}`);
      } else if (result.noChanges) {
        spinner.info(chalk.yellow('No changes detected since last checkpoint'));
        console.log('Use --full flag to force a full checkpoint anyway');
      } else {
        spinner.fail(`Create failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Create failed');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all checkpoints')
  .option('--show-chain', 'Show checkpoint chain information')
  .action(async (options) => {
    try {
      const manager = new CheckpointManager();
      const checkpoints = await manager.getCheckpoints();
      
      if (checkpoints.length === 0) {
        console.log(chalk.yellow('No checkpoints found.'));
        console.log('Create your first checkpoint with: claudepoint create');
        return;
      }

      console.log(chalk.blue(`📋 Available checkpoints (${checkpoints.length}):`));
      
      for (let index = 0; index < checkpoints.length; index++) {
        const cp = checkpoints[index];
        const typeLabel = cp.type === 'FULL' ? chalk.green('[FULL]') : 
                         cp.type === 'INCREMENTAL' ? chalk.yellow('[INC]') : 
                         chalk.gray('[LEGACY]');
        
        // Show chain structure with visual indicators
        let prefix = '  ';
        if (options.showChain && cp.type === 'INCREMENTAL') {
          // Find if this is part of a chain
          const hasSubsequent = checkpoints.slice(0, index).some(nextCp => nextCp.baseCheckpoint === cp.name);
          prefix = hasSubsequent ? '  ├─ ' : '  └─ ';
        } else if (options.showChain && cp.type === 'FULL') {
          prefix = '  ';
        }
        
        console.log(`${prefix}${chalk.cyan((index + 1) + '.')} ${chalk.bold(cp.name)} ${typeLabel}`);
        console.log(`${prefix}   ${cp.description}`);
        
        let details = `${new Date(cp.timestamp).toLocaleString()} | ${cp.fileCount} files | ${manager.formatSize(cp.totalSize)}`;
        if (cp.type === 'INCREMENTAL' && cp.statistics) {
          details += ` | ${cp.statistics.filesChanged} changes`;
        }
        console.log(`${prefix}   ${details}`);
        
        if (options.showChain && cp.baseCheckpoint) {
          console.log(`${prefix}   ${chalk.gray('↳ based on:')} ${cp.baseCheckpoint}`);
        }
        
        console.log();
      }
      
      if (!options.showChain) {
        console.log(chalk.gray('💡 Use --show-chain to see checkpoint relationships'));
      }
    } catch (error) {
      console.error(chalk.red('❌ List failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('restore <checkpoint>')
  .description('Restore a checkpoint')
  .option('--dry-run', 'Show what would happen without making changes')
  .action(async (checkpoint, options) => {
    try {
      const manager = new CheckpointManager();
      
      if (options.dryRun) {
        const result = await manager.restore(checkpoint, true);
        
        if (!result.success) {
          console.log(chalk.red(`❌ ${result.error}`));
          const checkpoints = await manager.getCheckpoints();
          console.log(chalk.blue('Available checkpoints:'));
          checkpoints.slice(0, 5).forEach(cp => {
            const typeLabel = cp.type === 'FULL' ? chalk.green('[FULL]') : 
                             cp.type === 'INCREMENTAL' ? chalk.yellow('[INC]') : 
                             chalk.gray('[LEGACY]');
            console.log(`  - ${cp.name} ${typeLabel}`);
          });
          return;
        }

        const targetCheckpoint = result.checkpoint;
        const typeLabel = targetCheckpoint.type === 'FULL' ? chalk.green('[FULL]') : 
                         targetCheckpoint.type === 'INCREMENTAL' ? chalk.yellow('[INC]') : 
                         chalk.gray('[LEGACY]');
        
        console.log(chalk.blue(`🔍 DRY RUN - Would restore: ${targetCheckpoint.name} ${typeLabel}`));
        console.log(`   Description: ${targetCheckpoint.description}`);
        console.log(`   Date: ${new Date(targetCheckpoint.timestamp).toLocaleString()}`);
        console.log(`   Files: ${targetCheckpoint.fileCount}`);
        console.log(`   Strategy: ${result.restoreStrategy}`);
        
        if (result.chainLength > 1) {
          console.log(chalk.yellow(`   Chain Length: ${result.chainLength} checkpoints (includes incremental history)`));
        }
        
        const currentFiles = await manager.getProjectFiles();
        const filesToDelete = currentFiles.filter(f => !targetCheckpoint.files.includes(f));
        if (filesToDelete.length > 0) {
          console.log(chalk.yellow(`   Would delete ${filesToDelete.length} files that didn't exist in checkpoint`));
        }
        
        console.log('\nUse restore without --dry-run to proceed.');
        return;
      }

      // Create emergency backup and confirm
      console.log(chalk.blue('📦 This will create an emergency backup before restoring...'));
      
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Restore checkpoint '${checkpoint}'? This will modify your codebase.`,
        default: false
      }]);

      if (!confirm) {
        console.log(chalk.red('❌ Restoration cancelled'));
        return;
      }

      const spinner = ora('Restoring checkpoint...').start();
      const result = await manager.restore(checkpoint, false);
      
      if (result.success) {
        const typeLabel = result.type === 'FULL' ? '[FULL]' : 
                         result.type === 'INCREMENTAL' ? '[INC]' : '';
        spinner.succeed(`Checkpoint restored successfully! ${typeLabel}`);
        console.log(chalk.green(`   Emergency backup created: ${result.emergencyBackup}`));
        console.log(chalk.green(`   Restored: ${result.restored}`));
        if (result.type === 'INCREMENTAL') {
          console.log(chalk.yellow(`   Restoration used incremental chain reconstruction`));
        }
      } else {
        spinner.fail(`Restore failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Restore failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('changelog')
  .description('Show development history and session log')
  .action(async () => {
    try {
      const manager = new CheckpointManager();
      const changelog = await manager.getChangelog();
      
      if (changelog.length === 0) {
        console.log(chalk.yellow('No development history found.'));
        return;
      }

      console.log(chalk.blue('📋 Development History:'));
      changelog.forEach((entry, index) => {
        console.log(`\n${chalk.cyan((index + 1) + '.')} ${chalk.bold(entry.action)} - ${chalk.green(entry.timestamp)}`);
        console.log(`   ${entry.description}`);
        if (entry.details) {
          console.log(`   ${chalk.gray(entry.details)}`);
        }
      });
    } catch (error) {
      console.error(chalk.red('❌ Changelog failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('log <description>')
  .description('Add a custom entry to the development history')
  .option('-d, --details <details>', 'Detailed explanation of changes')
  .option('-t, --type <type>', 'Action type (CODE_CHANGE, REFACTOR, BUG_FIX, etc.)', 'CODE_CHANGE')
  .action(async (description, options) => {
    try {
      const manager = new CheckpointManager();
      await manager.logToChangelog(options.type, description, options.details);
      console.log(chalk.green(`✅ Changelog entry added: ${description}`));
    } catch (error) {
      console.error(chalk.red('❌ Log failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init-commands')
  .description('Initialize Claude Code slash commands for ClaudePoint')
  .option('--force', 'Force regeneration even if commands already exist')
  .action(async (options) => {
    const spinner = ora('Checking Claude Code slash commands...').start();
    
    try {
      // Check if commands already exist
      const commandsDir = path.join(process.cwd(), '.claude', 'commands');
      const createCheckpointFile = path.join(commandsDir, 'create-checkpoint.md');
      
      let commandsExist = false;
      try {
        await fsPromises.access(createCheckpointFile);
        commandsExist = true;
      } catch {
        commandsExist = false;
      }
      
      if (commandsExist && !options.force) {
        spinner.succeed('Slash commands already configured!');
        console.log(chalk.green('✅ Claude Code slash commands are already set up'));
        console.log(chalk.blue('\n🚀 Available slash commands in Claude Code:'));
        console.log('  /create-checkpoint - Create a new checkpoint');
        console.log('  /restore-checkpoint - Restore with interactive selection');
        console.log('  /list-checkpoints - List all checkpoints');
        console.log('  /checkpoint-status - Show current status');
        console.log('  /claudepoint-init-hooks - Initialize hooks integration');
        console.log('  /claudepoint-hooks-status - Show hooks status');
        console.log('  /claudepoint-hooks-toggle-changelog - Toggle changelog');
        
        console.log(chalk.yellow('\n💡 Use --force flag to regenerate commands'));
        console.log(chalk.gray('   Example: claudepoint init-commands --force'));
        return;
      }
      
      spinner.text = 'Creating Claude Code slash commands...';
      await initializeSlashCommands();
      spinner.succeed('Slash commands created successfully!');
      console.log(chalk.green('✅ Created .claude/commands directory'));
      console.log(chalk.green('✅ Added /create-checkpoint command'));
      console.log(chalk.green('✅ Added /restore-checkpoint command'));
      console.log(chalk.green('✅ Added /list-checkpoints command'));
      console.log(chalk.green('✅ Added /checkpoint-status command'));
      console.log(chalk.green('✅ Added /claudepoint-init-hooks command'));
      console.log(chalk.green('✅ Added /claudepoint-hooks-status command'));
      console.log(chalk.green('✅ Added /claudepoint-hooks-toggle-changelog command'));
      
      console.log(chalk.blue('\n🚀 Available slash commands in Claude Code:'));
      console.log('  /create-checkpoint - Create a new checkpoint');
      console.log('  /restore-checkpoint - Restore with interactive selection');
      console.log('  /list-checkpoints - List all checkpoints');
      console.log('  /checkpoint-status - Show current status');
      console.log('  /claudepoint-init-hooks - Initialize hooks integration');
      console.log('  /claudepoint-hooks-status - Show hooks status');
      console.log('  /claudepoint-hooks-toggle-changelog - Toggle changelog');
      
      console.log(chalk.yellow('\n💡 Tip: Type / in Claude Code to see available commands!'));
    } catch (error) {
      spinner.fail('Failed to create slash commands');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init-hooks')
  .description('Initialize ClaudePoint hooks integration with Claude Code')
  .option('--install', 'Automatically install hooks to Claude Code settings')
  .action(async (options) => {
    const spinner = ora('Initializing ClaudePoint hooks...').start();
    
    try {
      const manager = new CheckpointManager();
      
      // Ensure directories exist
      await manager.ensureDirectories();
      
      // Create hooks configuration file with proper defaults
      const defaultHooksConfig = await manager.loadHooksConfig();
      defaultHooksConfig.enabled = true;
      defaultHooksConfig.auto_changelog = false;
      
      await manager.saveHooksConfig(defaultHooksConfig);
      spinner.text = 'Creating Claude Code hooks configuration...';
      
      // Build Claude Code hooks configuration dynamically based on enabled triggers
      const claudeHooksConfig = {
        hooks: {
          PreToolUse: {}
        }
      };
      
      // Add hooks for each enabled trigger
      Object.entries(defaultHooksConfig.triggers).forEach(([triggerName, triggerConfig]) => {
        if (triggerConfig.enabled && triggerConfig.tools) {
          triggerConfig.tools.forEach(tool => {
            claudeHooksConfig.hooks.PreToolUse[tool] = `claudepoint-hook --trigger ${triggerName} --tool ${tool}`;
          });
        }
      });
      
      if (options.install) {
        // Install hooks to Claude Code settings automatically
        spinner.text = 'Installing hooks to Claude Code settings...';
        
        const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        let existingSettings = {};
        
        try {
          // Try to read existing settings
          const settingsData = await fsPromises.readFile(claudeSettingsPath, 'utf8');
          existingSettings = JSON.parse(settingsData);
        } catch (error) {
          // File doesn't exist or is invalid, start with empty settings
          console.log(chalk.yellow('   Creating new Claude Code settings file'));
        }
        
        // Merge hooks with existing settings
        if (!existingSettings.hooks) {
          existingSettings.hooks = {};
        }
        if (!existingSettings.hooks.PreToolUse) {
          existingSettings.hooks.PreToolUse = {};
        }
        
        // Add ClaudePoint hooks
        existingSettings.hooks.PreToolUse.MultiEdit = claudeHooksConfig.hooks.PreToolUse.MultiEdit;
        existingSettings.hooks.PreToolUse.Write = claudeHooksConfig.hooks.PreToolUse.Write;
        
        // Ensure .claude directory exists
        await fsPromises.mkdir(path.dirname(claudeSettingsPath), { recursive: true });
        
        // Write updated settings
        await fsPromises.writeFile(claudeSettingsPath, JSON.stringify(existingSettings, null, 2));
        
        spinner.succeed('ClaudePoint hooks installed!');
        console.log(chalk.green('✅ Created .checkpoints/hooks.json'));
        console.log(chalk.green('✅ Configured default safety hooks'));
        console.log(chalk.green('✅ Installed hooks to ~/.claude/settings.json'));
        
        console.log(chalk.blue('\n🔄 Restart Claude Code to activate hooks'));
        
      } else {
        spinner.succeed('ClaudePoint hooks initialized!');
        console.log(chalk.green('✅ Created .checkpoints/hooks.json'));
        console.log(chalk.green('✅ Configured default safety hooks'));
        
        console.log(chalk.blue('\n🔧 Add this to your Claude Code settings:'));
        console.log(chalk.gray('~/.claude/settings.json'));
        console.log(chalk.cyan(JSON.stringify(claudeHooksConfig, null, 2)));
        
        console.log(chalk.yellow('\n💡 Tip: Use --install flag to automatically add to settings!'));
      }
      
      console.log(chalk.blue('\n🚀 Available hook features:'));
      console.log('  • Safety checkpoints before bulk file edits');
      console.log('  • Safety checkpoints before major file writes');
      console.log('  • Optional automatic changelog entries');
      
      console.log(chalk.blue('\n⚙️  Hook management commands:'));
      console.log('  claudepoint hooks status    - Show hook configuration');
      console.log('  claudepoint hooks enable    - Enable hook triggers');
      console.log('  claudepoint hooks disable   - Disable hook triggers');
      
      console.log(chalk.yellow('\n💡 Tip: Hooks create automatic safety checkpoints before major changes!'));
      
    } catch (error) {
      spinner.fail('Failed to initialize hooks');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Hooks management commands
const hooksCommand = program
  .command('hooks')
  .description('Manage ClaudePoint hooks configuration')
  .addHelpText('after', `
Examples:
  $ claudepoint hooks status          Show detailed configuration and available options  
  $ claudepoint hooks configure       Interactive configuration wizard
  $ claudepoint hooks enable          Enable all hooks
  $ claudepoint hooks disable         Disable all hooks
  $ claudepoint hooks set-changelog true    Enable automatic changelog entries

Available Triggers:
  before_bulk_edit        Safety checkpoint before MultiEdit operations (default: enabled)
  before_major_write      Safety checkpoint before Write operations (default: disabled)  
  before_bash_commands    Safety checkpoint before Bash commands (default: disabled)
  before_file_operations  Safety checkpoint before any file changes (default: disabled)
`);

hooksCommand
  .command('status')
  .description('Show current hooks configuration and Claude Code installation status')
  .action(async () => {
    try {
      const manager = new CheckpointManager();
      const config = await manager.loadHooksConfig();
      
      // Check if hooks are installed in Claude Code settings
      const claudeSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      let installedInClaude = false;
      try {
        const settingsData = await fsPromises.readFile(claudeSettingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        installedInClaude = settings.hooks?.PreToolUse?.MultiEdit?.includes('claudepoint-hook') || false;
      } catch (error) {
        // Settings file doesn't exist or can't be read
        installedInClaude = false;
      }
      
      console.log(chalk.blue('🔗 ClaudePoint Hooks Status'));
      console.log('================================');
      
      const overallStatus = config.enabled 
        ? (installedInClaude ? chalk.green('✅ CONFIGURED & INSTALLED') : chalk.yellow('⚠️  CONFIGURED BUT NOT INSTALLED'))
        : chalk.red('❌ DISABLED');
      
      console.log(`Overall Status: ${overallStatus}`);
      console.log(`Auto Changelog: ${config.auto_changelog ? chalk.green('Enabled') : chalk.yellow('Disabled')}`);
      
      if (config.enabled && !installedInClaude) {
        console.log(chalk.red('\n⚠️  HOOKS NOT ACTIVE: Not installed in Claude Code settings'));
        console.log(chalk.yellow('   Run: claudepoint init-hooks --install'));
      }
      
      console.log('\n📋 Available Triggers:');
      Object.entries(config.triggers || {}).forEach(([name, trigger]) => {
        const localStatus = trigger.enabled ? '✅ CONFIGURED' : '❌ DISABLED';
        const claudeStatus = (trigger.enabled && installedInClaude) ? '✅ ACTIVE IN CLAUDE' : '❌ NOT IN CLAUDE CODE';
        
        console.log(`\n  ${chalk.bold(name)}`);
        console.log(`    Local: ${trigger.enabled ? chalk.green(localStatus) : chalk.red(localStatus)}`);
        console.log(`    Claude: ${(trigger.enabled && installedInClaude) ? chalk.green(claudeStatus) : chalk.red(claudeStatus)}`);
        console.log(`    ${chalk.gray('Description:')} ${trigger.description}`);
        if (trigger.tools && trigger.tools.length > 0) {
          console.log(`    ${chalk.gray('Triggers on:')} ${chalk.cyan(trigger.tools.join(', '))} tools`);
        }
      });
      
      console.log(chalk.blue('\n⚙️  Management Commands:'));
      console.log(`  ${chalk.cyan('claudepoint hooks enable [trigger]')} - Enable all hooks or specific trigger`);
      console.log(`  ${chalk.cyan('claudepoint hooks disable [trigger]')} - Disable all hooks or specific trigger`);
      console.log(`  ${chalk.cyan('claudepoint hooks set-changelog true/false')} - Toggle auto-changelog`);
      console.log(`  ${chalk.cyan('claudepoint hooks configure')} - Interactive configuration wizard`);
      
      console.log(chalk.blue('\n💡 Examples:'));
      console.log(`  ${chalk.gray('Enable specific trigger:')} claudepoint hooks enable before_bulk_edit`);
      console.log(`  ${chalk.gray('Disable all hooks:')} claudepoint hooks disable`);
      console.log(`  ${chalk.gray('Enable changelog:')} claudepoint hooks set-changelog true`);
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

hooksCommand
  .command('enable [trigger]')
  .description('Enable hooks (all triggers or specific trigger)')
  .action(async (trigger) => {
    try {
      const manager = new CheckpointManager();
      const config = await manager.loadHooksConfig();
      
      if (trigger) {
        if (config.triggers[trigger]) {
          config.triggers[trigger].enabled = true;
          await manager.saveHooksConfig(config);
          console.log(chalk.green(`✅ Enabled trigger: ${trigger}`));
        } else {
          console.log(chalk.red(`❌ Unknown trigger: ${trigger}`));
          console.log('Available triggers:', Object.keys(config.triggers).join(', '));
          process.exit(1);
        }
      } else {
        config.enabled = true;
        await manager.saveHooksConfig(config);
        console.log(chalk.green('✅ Enabled all ClaudePoint hooks'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

hooksCommand
  .command('disable [trigger]')
  .description('Disable hooks (all triggers or specific trigger)')
  .action(async (trigger) => {
    try {
      const manager = new CheckpointManager();
      const config = await manager.loadHooksConfig();
      
      if (trigger) {
        if (config.triggers[trigger]) {
          config.triggers[trigger].enabled = false;
          await manager.saveHooksConfig(config);
          console.log(chalk.yellow(`⚠️  Disabled trigger: ${trigger}`));
        } else {
          console.log(chalk.red(`❌ Unknown trigger: ${trigger}`));
          console.log('Available triggers:', Object.keys(config.triggers).join(', '));
          process.exit(1);
        }
      } else {
        config.enabled = false;
        await manager.saveHooksConfig(config);
        console.log(chalk.yellow('⚠️  Disabled all ClaudePoint hooks'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

hooksCommand
  .command('set-changelog <enabled>')
  .description('Enable or disable automatic changelog entries (true/false)')
  .action(async (enabled) => {
    try {
      const manager = new CheckpointManager();
      const config = await manager.loadHooksConfig();
      
      const enabledBool = enabled.toLowerCase() === 'true';
      config.auto_changelog = enabledBool;
      
      await manager.saveHooksConfig(config);
      
      if (enabledBool) {
        console.log(chalk.green('✅ Enabled automatic changelog entries'));
        console.log(chalk.gray('   Hooks will now create changelog entries when creating checkpoints'));
      } else {
        console.log(chalk.yellow('⚠️  Disabled automatic changelog entries'));
        console.log(chalk.gray('   Hooks will create checkpoints but no changelog entries'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

hooksCommand
  .command('configure')
  .description('Interactive configuration wizard for hooks')
  .action(async () => {
    try {
      const manager = new CheckpointManager();
      const config = await manager.loadHooksConfig();
      
      console.log(chalk.blue('🔧 ClaudePoint Hooks Configuration Wizard'));
      console.log('==========================================\n');
      
      // Overall enable/disable
      const { enableHooks } = await inquirer.prompt([{
        type: 'confirm',
        name: 'enableHooks',
        message: 'Enable ClaudePoint hooks for automatic safety checkpoints?',
        default: config.enabled
      }]);
      
      if (enableHooks) {
        // Auto-changelog setting
        const { enableChangelog } = await inquirer.prompt([{
          type: 'confirm', 
          name: 'enableChangelog',
          message: 'Enable automatic changelog entries when hooks create checkpoints?',
          default: config.auto_changelog
        }]);
        
        // Individual trigger configuration
        console.log(chalk.blue('\n📋 Configure Individual Triggers:'));
        
        const triggerChoices = [];
        for (const [name, trigger] of Object.entries(config.triggers)) {
          const { enabled } = await inquirer.prompt([{
            type: 'confirm',
            name: 'enabled',
            message: `${chalk.bold(name)}: ${trigger.description}\n   Triggers on: ${chalk.cyan(trigger.tools.join(', '))} tools\n   Enable this trigger?`,
            default: trigger.enabled
          }]);
          
          config.triggers[name].enabled = enabled;
          triggerChoices.push({ name, enabled });
        }
        
        config.enabled = true;
        config.auto_changelog = enableChangelog;
        
        await manager.saveHooksConfig(config);
        
        console.log(chalk.green('\n✅ Configuration saved successfully!'));
        
        // Show summary
        console.log(chalk.blue('\n📊 Configuration Summary:'));
        console.log(`Hooks: ${chalk.green('Enabled')}`);
        console.log(`Auto-changelog: ${enableChangelog ? chalk.green('Enabled') : chalk.yellow('Disabled')}`);
        
        triggerChoices.forEach(({ name, enabled }) => {
          const status = enabled ? chalk.green('✅') : chalk.red('❌');
          console.log(`${status} ${name}`);
        });
        
        console.log(chalk.blue('\n💡 Next steps:'));
        console.log('  • Make sure hooks are installed in Claude Code settings');
        console.log('  • Use: claudepoint init-hooks --install');
        console.log('  • Restart Claude Code to activate hooks');
        
      } else {
        config.enabled = false;
        await manager.saveHooksConfig(config);
        console.log(chalk.yellow('\n⚠️  All hooks disabled'));
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();