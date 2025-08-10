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

// Progress bar animation function
async function showProgressBar(message, steps) {
  const spinner = ora(message).start();
  const totalSteps = steps.length;
  
  for (let i = 0; i < totalSteps; i++) {
    const step = steps[i];
    spinner.text = `${message} [${i + 1}/${totalSteps}] ${step.text}`;
    
    if (step.action) {
      await step.action();
    }
    
    await new Promise(resolve => setTimeout(resolve, step.delay || 300));
  }
  
  return spinner;
}

// Configure MCP server based on scope
async function configureMCPServer(scope = 'project') {
  try {
    // For project scope, we need to use Claude Code CLI
    if (scope === 'project') {
      // Check if we're in a Claude Code environment
      const { execSync } = await import('child_process');
      try {
        // Try to add MCP server via Claude CLI
        execSync(`claude mcp add claudepoint --command claudepoint`, { stdio: 'inherit' });
        return { success: true, scope: 'project' };
      } catch (error) {
        // Fall back to manual instruction
        return { 
          success: false, 
          manual: true,
          instructions: 'Run in Claude Code: claude mcp add claudepoint --command claudepoint'
        };
      }
    }
    
    // For user/global scope, modify config file
    const configPath = scope === 'user' 
      ? path.join(os.homedir(), '.claude', 'mcp_servers.json')
      : path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    
    let config = {};
    try {
      const configData = await fsPromises.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch {
      // File doesn't exist, create new
    }
    
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Check for existing claudepoint entries
    const existingKeys = Object.keys(config.mcpServers).filter(key => 
      key === 'claudepoint' || key.startsWith('claudepoint_')
    );
    
    if (existingKeys.length > 0) {
      return { alreadyConfigured: true, scope, existingKeys };
    }
    
    // Get the full path to claudepoint binary
    const { execSync } = await import('child_process');
    let claudepointPath;
    try {
      claudepointPath = execSync('which claudepoint', { encoding: 'utf8' }).trim();
    } catch {
      // Fallback - try common paths
      const commonPaths = [
        '/usr/local/bin/claudepoint',
        '/opt/homebrew/bin/claudepoint',
        path.join(os.homedir(), '.npm-global/bin/claudepoint')
      ];
      claudepointPath = commonPaths.find(p => {
        try {
          require('fs').accessSync(p);
          return true;
        } catch {
          return false;
        }
      }) || 'claudepoint';
    }
    
    config.mcpServers.claudepoint = {
      command: claudepointPath,
      args: []
    };
    
    await fsPromises.mkdir(path.dirname(configPath), { recursive: true });
    await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2));
    
    return { success: true, scope, configPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Configure hooks based on scope
async function configureHooks(scope = 'project', triggers = ['before_bulk_edit']) {
  try {
    const settingsPath = scope === 'project'
      ? path.join(process.cwd(), '.claude', 'settings.json')
      : path.join(os.homedir(), '.claude', 'settings.json');
    
    let settings = {};
    try {
      const data = await fsPromises.readFile(settingsPath, 'utf8');
      settings = JSON.parse(data);
    } catch {
      // File doesn't exist
    }
    
    if (!settings.hooks) {
      settings.hooks = {};
    }
    
    if (!Array.isArray(settings.hooks.PreToolUse)) {
      settings.hooks.PreToolUse = [];
    }
    
    // Remove existing claudepoint hooks
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(hook => 
      !hook.hooks || !hook.hooks.some(h => h.command && h.command.includes('claudepoint-hook'))
    );
    
    // Add hooks for specified triggers
    const toolMap = {
      'before_bulk_edit': ['MultiEdit'],
      'before_major_write': ['Write'],
      'before_bash_commands': ['Bash'],
      'before_file_operations': ['*']
    };
    
    triggers.forEach(trigger => {
      const tools = toolMap[trigger] || [];
      tools.forEach(tool => {
        settings.hooks.PreToolUse.push({
          matcher: tool,
          hooks: [{
            type: 'command',
            command: `claudepoint-hook --trigger ${trigger} --tool ${tool}`
          }]
        });
      });
    });
    
    await fsPromises.mkdir(path.dirname(settingsPath), { recursive: true });
    await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    
    return { success: true, scope, settingsPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Original configureMCPServer function for backward compatibility
async function configureMCPServerLegacy() {
  try {
    // Determine Claude Code config path based on platform
    const platform = os.platform();
    let configPath;
    
    if (platform === 'darwin') {
      // macOS
      configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else if (platform === 'win32') {
      // Windows
      configPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    } else {
      // Linux or other
      configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    }
    
    // Check if config file exists
    let config = {};
    let wasCreated = false;
    
    try {
      const configData = await fsPromises.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      // Config doesn't exist, create new one
      wasCreated = true;
      config = {};
    }
    
    // Check if ANY claudepoint configuration already exists (prevent duplicates)
    if (config.mcpServers) {
      const claudepointKeys = Object.keys(config.mcpServers).filter(key => 
        key === 'claudepoint' || key.startsWith('claudepoint_')
      );
      if (claudepointKeys.length > 0) {
        return { alreadyConfigured: true, configPath, existingKeys: claudepointKeys };
      }
    }
    
    // Add claudepoint configuration
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    config.mcpServers.claudepoint = {
      command: 'claudepoint',
      args: []
    };
    
    // Ensure directory exists
    await fsPromises.mkdir(path.dirname(configPath), { recursive: true });
    
    // Write updated config
    await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2));
    
    return { success: true, configPath, wasCreated };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

program
  .name('claudepoint')
  .description('🚀 The ultimate hacking companion for Claude Code // Break things beautifully')
  .version(packageJson.version)
  .action(async (options, command) => {
    // Default action when no command is specified - create a claudepoint!
    if (command.args.length === 0) {
      // Quick intro for deploy
      console.log(chalk.green('    ⣿⣿⠋⠀⢀⣤⣶⣶⣶⣶⣶⣶⣤⡀⠀⠋⣿⣿'));
      console.log(chalk.cyan('    >> CLAUDEPOINT DEPLOY SEQUENCE <<'));
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const spinner = ora('💾 Deploying claudepoint...').start();
      
      try {
        const manager = new CheckpointManager();
        const result = await manager.create();
        
        if (result.success) {
          spinner.succeed(manager.getRandomMessage(manager.successMessages));
          console.log(chalk.cyan(`   Name: ${result.name}`));
          console.log(chalk.gray(`   Files: ${result.fileCount} | Size: ${result.size}`));
          console.log(chalk.gray(`   Description: ${result.description}`));
        } else if (result.noChanges) {
          spinner.info(chalk.yellow('🤔 No changes detected since last claudepoint // Codebase is stable'));
        } else {
          spinner.fail(`🚨 Deploy failed: ${result.error}`);
        }
      } catch (error) {
        spinner.fail('🚨 Deploy error detected');
        console.error(chalk.red('Error:'), error.message);
      }
    }
  });

program
  .command('setup')
  .description('🎆 Complete ClaudePoint setup // MCP + Hooks + Commands in one go')
  .option('--scope <scope>', 'Configuration scope: project, user, or global', 'project')
  .option('--no-interactive', 'Skip interactive setup prompts')
  .option('--force', 'Force reinstall even if already configured')
  .action(async (options) => {
    // Matrix animation
    console.log(chalk.green('    ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿'));
    console.log(chalk.green('    ⣿⣿⣿⣿⣿⣿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⣿⣿⣿⣿'));
    console.log(chalk.green('    ⣿⣿⣿⠿⠋⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠿⣿⣿'));
    console.log(chalk.green('    ⣿⣿⠋⠀⢀⣤⣶⣶⣶⣶⣶⣶⣤⡀⠀⠋⣿⣿'));
    console.log(chalk.green('    ⣿⠋⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠋⣿'));
    console.log(chalk.green('    ⡟⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⢻'));
    console.log(chalk.green('    ⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀'));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(chalk.cyan.bold('\n    ╔═══════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('    ║     🕶️  CLAUDEPOINT MATRIX v1.4.4     ║'));
    console.log(chalk.cyan.bold('    ║      >> INITIALIZING HACK MODE <<      ║'));
    console.log(chalk.cyan.bold('    ╚═══════════════════════════════════════╝'));
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Loading animation
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    const loadingInterval = setInterval(() => {
      process.stdout.write(`\r${chalk.green(frames[frameIndex])} ${chalk.cyan('Accessing neural pathways...')}   `);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 100);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    clearInterval(loadingInterval);
    process.stdout.write('\r                                        \r');
    
    console.log(chalk.green('✅ Neural pathways established'));
    console.log(chalk.green('✅ Matrix protocols loaded'));
    console.log(chalk.green('✅ Quantum tunnels active'));
    
    await new Promise(resolve => setTimeout(resolve, 400));
    
    console.log(chalk.blue.bold('\n🕶️ Welcome to the ClaudePoint Matrix!\n'));
    
    try {
      const manager = new CheckpointManager();
      
      // Determine configuration scope
      let configScope = options.scope;
      
      // Interactive setup by default
      if (options.interactive !== false) {
        console.log(chalk.gray('This wizard will set up ClaudePoint with MCP server, hooks, and commands.\n'));
        
        // Ask about scope
        const { scope } = await inquirer.prompt([{
          type: 'list',
          name: 'scope',
          message: '🎯 Choose configuration scope:',
          choices: [
            { name: 'Project (recommended) - Settings for this project only', value: 'project' },
            { name: 'User - Available across all your projects', value: 'user' },
            { name: 'Global - System-wide configuration', value: 'global' }
          ],
          default: 'project'
        }]);
        configScope = scope;
        console.log(chalk.gray('This digital wizard will hack your way to the perfect ClaudePoint setup.\n'));
        
        // Ask about gitignore
        const { updateGitignore } = await inquirer.prompt([{
          type: 'confirm',
          name: 'updateGitignore',
          message: '🔒 Activate stealth mode (.claudepoint → .gitignore)?',
          default: true
        }]);
        
        // Ask about initial checkpoint
        const { createInitial } = await inquirer.prompt([{
          type: 'confirm',
          name: 'createInitial',
          message: '💾 Deploy initial claudepoint to lock in your digital DNA?',
          default: true
        }]);
        
        // Ask about slash commands
        const { installCommands } = await inquirer.prompt([{
          type: 'confirm',
          name: 'installCommands',
          message: '🚀 Install Claude Code command arsenal (/claudepoint, /undo, etc)?',
          default: true
        }]);
        
        // Ask about MCP configuration
        const { configureMCP } = await inquirer.prompt([{
          type: 'confirm',
          name: 'configureMCP',
          message: '⚙️ Configure ClaudePoint as MCP server in Claude Code?',
          default: true
        }]);
        
        // Ask about hooks with better UX
        const { enableHooks } = await inquirer.prompt([{
          type: 'confirm',
          name: 'enableHooks',
          message: '🪝 Enable automatic safety checkpoints before changes?',
          default: true
        }]);
        
        let selectedTriggers = [];
        if (enableHooks) {
          const { triggers } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'triggers',
            message: 'When should ClaudePoint create automatic checkpoints?',
            choices: [
              { name: 'Before bulk edits (MultiEdit)', value: 'before_bulk_edit', checked: true },
              { name: 'Before file writes (Write)', value: 'before_major_write', checked: false },
              { name: 'Before bash commands', value: 'before_bash_commands', checked: false },
              { name: 'Before any file changes', value: 'before_file_operations', checked: false }
            ]
          }]);
          
          selectedTriggers = triggers.length > 0 ? triggers : ['before_bulk_edit'];
        }
        
        // Now perform setup with chosen options using progress animation
        const steps = [
          { text: 'Creating .claudepoint vault...', action: async () => {}, delay: 400 },
          { text: 'Loading configuration...', delay: 300 },
          { text: 'Setting up file patterns...', delay: 350 },
        ];
        
        if (updateGitignore) {
          steps.push({ text: 'Updating .gitignore...', delay: 300 });
        }
        
        if (createInitial) {
          steps.push({ text: 'Creating initial checkpoint...', delay: 500 });
        }
        
        const spinner = await showProgressBar('🚀 Initializing ClaudePoint', steps);
        
        // Perform actual setup
        const result = await manager.setup({ 
          updateGitignore, 
          createInitial 
        });
        
        if (result.success) {
          spinner.succeed('💾 ClaudePoint is ONLINE!');
          console.log(chalk.green('✨ Created .claudepoint vault'));
          if (updateGitignore) {
            console.log(chalk.green('🔒 Updated .gitignore (stealth mode activated)'));
          }
          console.log(chalk.green('⚙️ Configuration loaded'));
          
          if (result.initialCheckpoint) {
            console.log(chalk.green(`✨ Deployed initial claudepoint: ${result.initialCheckpoint}`));
          }
          
          // Install slash commands if requested
          if (installCommands) {
            spinner.start('🚀 Deploying Claude Code slash command arsenal...');
            await initializeSlashCommands();
            spinner.succeed('⚙️ Slash command arsenal deployed!');
            console.log(chalk.green('✨ Created .claude/commands vault'));
            console.log(chalk.green('🚀 Added claudepoint command arsenal'));
          }
          
          // Configure MCP if requested
          if (configureMCP) {
            spinner.start(`Configuring MCP server (${configScope} scope)...`);
            const configResult = await configureMCPServer(configScope);
            if (configResult.success) {
              spinner.succeed(`MCP server configured (${configScope} scope)!`);
              if (configResult.configPath) {
                console.log(chalk.green(`✅ Updated: ${configResult.configPath}`));
              }
              if (configScope === 'project') {
                console.log(chalk.blue('\n📍 MCP configured for this project only'));
              } else {
                console.log(chalk.blue(`\n📍 MCP configured at ${configScope} level`));
                if (configScope === 'user' || configScope === 'global') {
                  console.log(chalk.yellow('   For each project, you may still need to:'));
                  console.log(chalk.cyan('   claude mcp add-from-claude-desktop'));
                }
              }
            } else if (configResult.alreadyConfigured) {
              spinner.info(`MCP server already configured (${configScope} scope)`);
              if (configResult.existingKeys) {
                console.log(chalk.gray(`   Found: ${configResult.existingKeys.join(', ')}`));
              }
            } else if (configResult.manual) {
              spinner.warn('Cannot auto-configure MCP in project scope');
              console.log(chalk.yellow('\n📝 Run this command in Claude Code:'));
              console.log(chalk.cyan(configResult.instructions));
            } else {
              spinner.warn(`Could not configure MCP: ${configResult.error}`);
            }
          }
          
          // Setup hooks if requested
          if (enableHooks && selectedTriggers.length > 0) {
            spinner.start(`Configuring hooks (${configScope} scope)...`);
            
            // Configure hooks with proper format
            const hooksResult = await configureHooks(configScope, selectedTriggers);
            
            if (hooksResult.success) {
              spinner.succeed(`Hooks configured (${configScope} scope)!`);
              console.log(chalk.green(`✅ Updated: ${hooksResult.settingsPath}`));
              console.log(chalk.green(`✅ Enabled triggers: ${selectedTriggers.join(', ')}`));
              
              // Also save local hook config for the hook binary
              const hooksManager = new CheckpointManager();
              const hooksConfigData = await hooksManager.loadHooksConfig();
              Object.keys(hooksConfigData.triggers).forEach(trigger => {
                hooksConfigData.triggers[trigger].enabled = selectedTriggers.includes(trigger);
              });
              await hooksManager.saveHooksConfig(hooksConfigData);
            } else {
              spinner.warn(`Could not configure hooks: ${hooksResult.error}`);
            }
          }
          
          // Show summary
          console.log(chalk.blue('\n✨ Setup Summary:'));
          console.log(`  📁 Checkpoints: ${chalk.green('Ready')}`);
          console.log(`  🔧 Gitignore: ${updateGitignore ? chalk.green('Updated') : chalk.gray('Skipped')}`);
          console.log(`  📸 Initial checkpoint: ${createInitial && result.initialCheckpoint ? chalk.green('Created') : chalk.gray('Skipped')}`);
          console.log(`  📝 Slash commands: ${installCommands ? chalk.green('Installed') : chalk.gray('Skipped')}`);
          console.log(`  ⚙️ MCP Server: ${configureMCP ? chalk.green('Configured') : chalk.gray('Skipped')}`);
          console.log(`  🪝 Hooks: ${enableHooks ? chalk.green('Configured & Installed to Claude Code') : chalk.gray('Skipped')}`);
          
          console.log(chalk.yellow('\n💡 Next steps:'));
          console.log('  1. Restart Claude Code to activate hooks');
          if (configScope !== 'project') {
            console.log(chalk.red('  2. 🚨 IMPORTANT: Run this in your project terminal:'));
            console.log('     ' + chalk.cyan('claude mcp add-from-claude-desktop'));
            console.log('  3. Test with /claudepoint command in Claude Code');
          } else {
            console.log('  2. Test with /claudepoint command in Claude Code');
          }
          console.log('  4. Create checkpoints before major changes');
          console.log('  5. Use "claudepoint --help" to see all commands');
          
          console.log(chalk.gray('\n🔍 To verify MCP is working:'));
          console.log(chalk.gray('   - Type /claudepoint in Claude Code'));
          console.log(chalk.gray('   - You should see ClaudePoint tools available'));
          console.log(chalk.gray('   - If not working, make sure you did step 2 above!'));
        } else {
          spinner.fail(`Setup failed: ${result.error}`);
          process.exit(1);
        }
      } else {
        // Non-interactive mode with progress
        const steps = [
          { text: 'Creating .claudepoint vault...', delay: 400 },
          { text: 'Loading configuration...', delay: 300 },
          { text: 'Updating .gitignore...', delay: 300 },
          { text: 'Setting up patterns...', delay: 350 }
        ];
        
        const spinner = await showProgressBar('🚀 Initializing ClaudePoint', steps);
        const result = await manager.setup();
        
        if (result.success) {
          spinner.succeed('💾 ClaudePoint is ONLINE!');
          console.log(chalk.green('✨ Created .claudepoint vault'));
          console.log(chalk.green('🔒 Updated .gitignore (stealth mode activated)'));
          console.log(chalk.green('⚙️ Configuration loaded'));
          
          if (result.initialCheckpoint) {
            console.log(chalk.green(`✨ Deployed initial claudepoint: ${result.initialCheckpoint}`));
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
  .description('💾 Deploy a new claudepoint // Lock in your digital DNA')
  .option('-n, --name <n>', 'Custom checkpoint name')
  .option('-d, --description <description>', 'Checkpoint description')
  .option('--debug', 'Show debug information about file discovery')
  .action(async (options) => {
    const spinner = ora('💾 Deploying claudepoint...').start();
    
    try {
      const manager = new CheckpointManager();
      
      // Debug mode: Show file discovery info
      if (options.debug) {
        spinner.text = 'Discovering project files...';
        const files = await manager.getProjectFiles();
        spinner.stop();
        console.log(chalk.blue(`\n🔍 Debug: Found ${files.length} files:`));
        files.slice(0, 20).forEach(file => console.log(chalk.gray(`  ${file}`)));
        if (files.length > 20) {
          console.log(chalk.gray(`  ... and ${files.length - 20} more files`));
        }
        console.log('');
        spinner.start('Creating checkpoint...');
      }
      
      const result = await manager.create(options.name, options.description);
      
      if (result.success) {
        spinner.succeed(manager.getRandomMessage(manager.successMessages));
        console.log(chalk.cyan(`   Name: ${result.name} ${chalk.green('[DEPLOYED]')}`));
        console.log(chalk.gray(`   Files: ${result.fileCount}`));
        console.log(chalk.gray(`   Size: ${result.size}`));
        console.log(chalk.gray(`   Description: ${result.description}`));
      } else if (result.noChanges) {
        spinner.info(chalk.yellow('🤔 No changes detected since last claudepoint // Codebase is stable'));
        console.log('Make some changes and redeploy when ready');
      } else {
        spinner.fail(`🚨 Deploy failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Create failed');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// 🚀 NEW: Quick undo command
program
  .command('undo')
  .description('🔄 Instant time hack // Restore your last claudepoint')
  .action(async () => {
    const spinner = ora('🕰️ Initiating time hack...').start();
    
    try {
      const manager = new CheckpointManager();
      const result = await manager.undoLastClaudepoint();
      
      if (result.success) {
        spinner.succeed(manager.getRandomMessage(manager.undoMessages));
        console.log(chalk.green(`   🛡️ Emergency backup: ${result.emergencyBackup}`));
        console.log(chalk.cyan(`   🔄 Restored: ${result.restored}`));
        console.log(chalk.gray(`   📅 Back to the future: ${result.type || 'FULL'} claudepoint`));
      } else if (result.noClaudepoints) {
        spinner.info(chalk.yellow('🤔 No claudepoints found to undo. Time to create your first safety net!'));
      } else {
        spinner.fail(`🚨 Time hack failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('🚨 Error during time hack');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('🗂️ Browse your claudepoint vault // Digital artifact collection')
  .option('--show-chain', 'Show checkpoint chain information')
  .action(async (options) => {
    try {
      const manager = new CheckpointManager();
      const checkpoints = await manager.getCheckpoints();
      
      if (checkpoints.length === 0) {
        console.log(chalk.yellow('🤔 No claudepoints found in the vault.'));
        console.log('🚀 Deploy your first claudepoint with: claudepoint');
        return;
      }

      console.log(chalk.blue(manager.getRandomMessage(manager.listMessages)));
      console.log(chalk.blue(`📦 Total claudepoints: ${checkpoints.length}`));
      
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

// 🎯 NEW: Changes command - see what's different since last claudepoint
program
  .command('changes')
  .description("🔍 Scan for changes // See what's different since your last claudepoint")
  .action(async () => {
    const spinner = ora('🔍 Scanning for changes...').start();
    
    try {
      const manager = new CheckpointManager();
      const changes = await manager.getChangedFilesSinceLastClaudepoint();
      
      if (changes.error) {
        spinner.fail(`🚨 Scan error: ${changes.error}`);
        return;
      }
      
      if (!changes.hasLastClaudepoint) {
        spinner.info('🆕 No previous claudepoint found // Everything is new!');
        console.log(chalk.blue(`📁 Total files in project: ${changes.totalChanges}`));
        console.log(chalk.gray('   Deploy your first claudepoint to track changes'));
        return;
      }
      
      if (changes.totalChanges === 0) {
        spinner.succeed('✨ Codebase is stable // No changes detected');
        console.log(chalk.green(`📍 Last claudepoint: ${changes.lastClaudepointName}`));
        console.log(chalk.gray(`   Created: ${changes.lastClaudepointDate}`));
        console.log(chalk.blue("🎯 Perfect time to experiment - you're fully protected!"));
        return;
      }
      
      spinner.succeed(`🎯 Changes detected: ${changes.totalChanges} modifications found`);
      console.log(chalk.blue(`📍 Since claudepoint: ${changes.lastClaudepointName}`));
      console.log(chalk.gray(`   Created: ${changes.lastClaudepointDate}`));
      
      if (changes.added.length > 0) {
        console.log(chalk.green(`\\n➕ Added files (${changes.added.length}):`));
        changes.added.slice(0, 10).forEach(file => {
          console.log(chalk.green(`   + ${file}`));
        });
        if (changes.added.length > 10) {
          console.log(chalk.gray(`   ... and ${changes.added.length - 10} more`));
        }
      }
      
      if (changes.modified.length > 0) {
        console.log(chalk.yellow(`\\n📝 Modified files (${changes.modified.length}):`));
        changes.modified.slice(0, 10).forEach(file => {
          console.log(chalk.yellow(`   ~ ${file}`));
        });
        if (changes.modified.length > 10) {
          console.log(chalk.gray(`   ... and ${changes.modified.length - 10} more`));
        }
      }
      
      if (changes.deleted.length > 0) {
        console.log(chalk.red(`\\n🗑️ Deleted files (${changes.deleted.length}):`));
        changes.deleted.slice(0, 10).forEach(file => {
          console.log(chalk.red(`   - ${file}`));
        });
        if (changes.deleted.length > 10) {
          console.log(chalk.gray(`   ... and ${changes.deleted.length - 10} more`));
        }
      }
      
      console.log(chalk.blue('\\n💡 Ready to lock in these changes? Run: claudepoint'));
      
    } catch (error) {
      spinner.fail('🚨 Scan error');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// 🎛️ NEW: Configuration command
program
  .command('config')
  .description('⚙️ Enter configuration mode // Tune your hacking rig')
  .action(async () => {
    const spinner = ora('🔧 Loading configuration...').start();
    
    try {
      const manager = new CheckpointManager();
      const status = await manager.getConfigurationStatus();
      
      spinner.succeed(manager.getRandomMessage(manager.configMessages));
      
      console.log(chalk.blue('\n🎛️ Current Configuration:'));
      console.log(chalk.cyan(`   Max Claudepoints: ${status.maxClaudepoints}`));
      console.log(chalk.cyan(`   Current Claudepoints: ${status.currentClaudepoints}`));
      console.log(chalk.cyan(`   Max Age: ${status.maxAge} days ${status.maxAge === 0 ? '(unlimited)' : ''}`));
      console.log(chalk.cyan(`   Ignore Patterns: ${status.ignorePatterns} rules`));
      console.log(chalk.cyan(`   Auto Naming: ${status.autoName ? 'Enabled' : 'Disabled'}`));
      console.log(chalk.gray(`   Config File: ${status.configPath}`));
      
      console.log(chalk.blue('\n🎨 Quick Config Commands:'));
      console.log(chalk.yellow('   • Edit config file directly with your favorite editor'));
      console.log(chalk.yellow('   • Or use the interactive setup: claudepoint setup'));
      
      const config = await manager.loadConfig();
      if (config.additionalIgnores && config.additionalIgnores.length > 0) {
        console.log(chalk.blue('\n🚷 Additional Ignore Patterns:'));
        config.additionalIgnores.forEach(pattern => {
          console.log(chalk.gray(`   • ${pattern}`));
        });
      }
      
      if (config.forceInclude && config.forceInclude.length > 0) {
        console.log(chalk.blue('\n⭐ Force Include Patterns:'));
        config.forceInclude.forEach(pattern => {
          console.log(chalk.green(`   • ${pattern}`));
        });
      }
      
    } catch (error) {
      spinner.fail('🚨 Configuration error');
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('restore <checkpoint>')
  .description('🔄 Time travel to a specific claudepoint // Precision restoration')
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
      console.log(chalk.blue('🔒 Emergency backup protocol initiated...'));
      
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `🔄 Restore claudepoint '${checkpoint}'? This will modify your codebase.`,
        default: false
      }]);

      if (!confirm) {
        console.log(chalk.red('❌ Time travel cancelled // Codebase remains stable'));
        return;
      }

      const spinner = ora('🔄 Initiating time travel sequence...').start();
      const result = await manager.restore(checkpoint, false);
      
      if (result.success) {
        const typeLabel = result.type === 'FULL' ? '[FULL]' : 
                         result.type === 'INCREMENTAL' ? '[INC]' : '';
        spinner.succeed(manager.getRandomMessage(manager.undoMessages));
        console.log(chalk.green(`   🔒 Emergency backup: ${result.emergencyBackup}`));
        console.log(chalk.cyan(`   🔄 Restored: ${result.restored} ${typeLabel}`));
        if (result.type === 'INCREMENTAL') {
          console.log(chalk.yellow(`   ⚡ Used incremental chain reconstruction`));
        }
        console.log(chalk.blue('   🎆 Welcome back to the past! Time travel complete.'));
      } else {
        spinner.fail(`🚨 Time travel failed: ${result.error}`);
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
      
      // Build Claude Code hooks configuration with CORRECT format
      const claudeHooksConfig = {
        hooks: {
          PreToolUse: []
        }
      };
      
      // Add hooks for each enabled trigger with proper structure
      Object.entries(defaultHooksConfig.triggers).forEach(([triggerName, triggerConfig]) => {
        if (triggerConfig.enabled && triggerConfig.tools) {
          triggerConfig.tools.forEach(tool => {
            claudeHooksConfig.hooks.PreToolUse.push({
              matcher: tool,
              hooks: [{
                type: "command",
                command: `claudepoint-hook --trigger ${triggerName} --tool ${tool}`
              }]
            });
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
        
        // Add ClaudePoint hooks with proper structure
        if (!Array.isArray(existingSettings.hooks.PreToolUse)) {
          existingSettings.hooks.PreToolUse = [];
        }
        
        // Remove existing claudepoint hooks to avoid duplicates
        existingSettings.hooks.PreToolUse = existingSettings.hooks.PreToolUse.filter(hook => 
          !hook.hooks || !hook.hooks.some(h => h.command && h.command.includes('claudepoint-hook'))
        );
        
        // Add new hooks
        existingSettings.hooks.PreToolUse.push(...claudeHooksConfig.hooks.PreToolUse);
        
        // Ensure .claude directory exists
        await fsPromises.mkdir(path.dirname(claudeSettingsPath), { recursive: true });
        
        // Write updated settings
        await fsPromises.writeFile(claudeSettingsPath, JSON.stringify(existingSettings, null, 2));
        
        spinner.succeed('ClaudePoint hooks installed!');
        console.log(chalk.green('✅ Created .checkpoints/hooks.json'));
        console.log(chalk.green('✅ Configured default safety hooks'));
        console.log(chalk.green('✅ Installed hooks to ~/.claude/settings.json'));
        
        console.log(chalk.yellow('\n⚠️  Note: Hooks are installed globally in Claude Code'));
        console.log(chalk.gray('   Running setup in other projects will update the global hook configuration'));
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

// Uninstall command - cleanly remove ClaudePoint from system
// Debug command to check MCP configuration
// Command to help with project MCP setup
program
  .command('mcp-setup')
  .description('🎯 Setup MCP in current project // Import from Claude Desktop')
  .action(async () => {
    console.log(chalk.blue.bold('\n🎯 ClaudePoint MCP Project Setup'));
    console.log(chalk.blue('=====================================\n'));
    
    // Check if global config exists
    const platform = os.platform();
    let configPath;
    
    if (platform === 'darwin') {
      configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else if (platform === 'win32') {
      configPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    } else {
      configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    }
    
    try {
      const configData = await fsPromises.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      if (config.mcpServers && config.mcpServers.claudepoint) {
        console.log(chalk.green('✅ ClaudePoint is configured globally in Claude Desktop'));
        console.log(chalk.gray(`   Global config: ${configPath}`));
        
        console.log(chalk.yellow('\n📍 To use ClaudePoint in this project:'));
        console.log(chalk.cyan('\n   1. Open Claude Code in this directory'));
        console.log(chalk.cyan('   2. Run this command in Claude Code:'));
        console.log(chalk.green.bold('      claude mcp add-from-claude-desktop'));
        console.log(chalk.cyan('   3. Select "claudepoint" from the list'));
        console.log(chalk.cyan('   4. Restart Claude Code'));
        
        console.log(chalk.blue('\n💡 Alternative: Manual project setup'));
        console.log(chalk.gray('   Run in Claude Code: claude mcp add claudepoint'));
        console.log(chalk.gray('   Command: claudepoint'));
        console.log(chalk.gray('   Arguments: (leave empty)'));
        
      } else {
        console.log(chalk.yellow('⚠️  ClaudePoint not found in global Claude Desktop config'));
        console.log(chalk.cyan('\n   First run: claudepoint setup'));
        console.log(chalk.cyan('   Then follow the instructions above'));
      }
      
    } catch (error) {
      console.log(chalk.red('❌ No Claude Desktop configuration found'));
      console.log(chalk.yellow('\n   Run: claudepoint setup'));
      console.log(chalk.yellow('   This will configure ClaudePoint globally'));
    }
    
    console.log(chalk.gray('\n📝 Note: Claude Code has two MCP configurations:'));
    console.log(chalk.gray('   1. Global (Claude Desktop) - shared across all projects'));
    console.log(chalk.gray('   2. Project - specific to each project directory'));
    console.log(chalk.gray('   ClaudePoint must be imported from global to project.'));
  });

program
  .command('check-mcp')
  .description('🔍 Check Claude Code MCP configuration // Debug MCP server status')
  .action(async () => {
    console.log(chalk.blue('🔍 Checking Claude Code MCP Configuration\n'));
    
    try {
      const platform = os.platform();
      let configPath;
      
      if (platform === 'darwin') {
        configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else if (platform === 'win32') {
        configPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      } else {
        configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
      }
      
      console.log(chalk.gray(`Config path: ${configPath}\n`));
      
      try {
        const configData = await fsPromises.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        console.log(chalk.green('✅ Config file exists and is valid JSON'));
        
        if (config.mcpServers) {
          const claudepointKeys = Object.keys(config.mcpServers).filter(key => 
            key === 'claudepoint' || key.startsWith('claudepoint_')
          );
          
          if (claudepointKeys.length > 0) {
            console.log(chalk.green(`✅ Found ${claudepointKeys.length} claudepoint MCP entries:`));
            claudepointKeys.forEach(key => {
              const server = config.mcpServers[key];
              console.log(chalk.cyan(`   ${key}: command="${server.command}", args=[${server.args.join(', ')}]`));
            });
          } else {
            console.log(chalk.yellow('⚠️  No claudepoint entries found in mcpServers'));
          }
          
          console.log(chalk.gray(`\nAll MCP servers in config:`));
          Object.keys(config.mcpServers).forEach(key => {
            console.log(chalk.gray(`   - ${key}`));
          });
        } else {
          console.log(chalk.red('❌ No mcpServers section found in config'));
        }
        
        console.log(chalk.gray('\nFull config file contents:'));
        console.log(chalk.gray(JSON.stringify(config, null, 2)));
        
      } catch (error) {
        console.log(chalk.red(`❌ Cannot read config file: ${error.message}`));
        console.log(chalk.yellow('\n💡 Try running: claudepoint setup'));
      }
      
      console.log(chalk.blue('\n📝 Troubleshooting tips:'));
      console.log('1. Make sure Claude Code is completely closed');
      console.log('2. Run: claudepoint uninstall && claudepoint setup');
      console.log('3. Restart Claude Code after setup');
      console.log('4. Check if claudepoint is globally installed: npm list -g claudepoint');
      
    } catch (error) {
      console.error(chalk.red('Error checking MCP configuration:'), error.message);
    }
  });

program
  .command('uninstall')
  .description('🗑️ Uninstall ClaudePoint from Claude Code // Clean removal of hooks and MCP')
  .option('--delete-checkpoints', 'Delete .claudepoint directories and checkpoints (default: keep them)')
  .option('--dry-run', 'Show what would be uninstalled without actually doing it')
  .action(async (options) => {
    console.log(chalk.red.bold('\n🗑️ CLAUDEPOINT UNINSTALLER'));
    console.log(chalk.red('====================================='));
    
    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN MODE - Nothing will be actually removed\n'));
    }
    
    try {
      const uninstallSteps = [];
      
      // Check what needs to be uninstalled
      console.log(chalk.blue('🔍 Scanning for ClaudePoint installations...\n'));
      
      // 1. Check MCP configuration
      const mcpResult = await checkMCPInstallation();
      if (mcpResult.found) {
        const entryCount = mcpResult.claudepointKeys.length;
        const entryText = entryCount === 1 ? 'MCP server' : `${entryCount} MCP servers`;
        uninstallSteps.push({
          type: 'mcp',
          description: `Remove ${entryText} from ${mcpResult.configPath} (${mcpResult.claudepointKeys.join(', ')})`,
          action: () => removeMCPConfiguration(mcpResult.configPath, options.dryRun)
        });
      }
      
      // 2. Check hooks installation
      const hooksResult = await checkHooksInstallation();
      if (hooksResult.found) {
        uninstallSteps.push({
          type: 'hooks',
          description: `Remove hooks from ${hooksResult.settingsPath}`,
          action: () => removeHooksConfiguration(hooksResult.settingsPath, options.dryRun)
        });
      }
      
      // 3. Check slash commands
      const commandsResult = await checkSlashCommands();
      if (commandsResult.found) {
        uninstallSteps.push({
          type: 'commands',
          description: `Remove slash commands from ${commandsResult.commandsDir}`,
          action: () => removeSlashCommands(commandsResult.commandsDir, options.dryRun)
        });
      }
      
      // 4. Check local .claudepoint directories
      if (options.deleteCheckpoints) {
        const checkpointsResult = await checkLocalCheckpoints();
        if (checkpointsResult.found) {
          uninstallSteps.push({
            type: 'checkpoints',
            description: `Remove .claudepoint directory from ${checkpointsResult.path}`,
            action: () => removeLocalCheckpoints(checkpointsResult.path, options.dryRun)
          });
        }
      }
      
      if (uninstallSteps.length === 0) {
        console.log(chalk.yellow('🤔 No ClaudePoint installations found to remove'));
        console.log(chalk.gray('   ClaudePoint appears to be already uninstalled or never installed'));
        return;
      }
      
      // Show what will be uninstalled
      console.log(chalk.red('Found the following ClaudePoint installations:'));
      uninstallSteps.forEach((step, index) => {
        const icon = step.type === 'mcp' ? '⚙️' : 
                    step.type === 'hooks' ? '🧝' :
                    step.type === 'commands' ? '📝' : '📁';
        console.log(`  ${index + 1}. ${icon} ${step.description}`);
      });
      
      if (!options.dryRun) {
        console.log(chalk.red('\n⚠️ WARNING: This will completely remove ClaudePoint from your system'));
        
        const { confirmUninstall } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmUninstall',
          message: 'Are you sure you want to proceed with uninstallation?',
          default: false
        }]);
        
        if (!confirmUninstall) {
          console.log(chalk.gray('\n❌ Uninstallation cancelled'));
          return;
        }
      }
      
      // Perform uninstallation
      console.log(chalk.red(`\n🗑️ ${options.dryRun ? 'Would remove' : 'Removing'} ClaudePoint...\n`));
      
      for (const step of uninstallSteps) {
        const spinner = ora(`${options.dryRun ? 'Would remove' : 'Removing'} ${step.type}...`).start();
        
        try {
          const result = await step.action();
          if (result.success) {
            spinner.succeed(`${step.type} ${options.dryRun ? 'would be removed' : 'removed'} successfully`);
            if (result.details) {
              console.log(chalk.gray(`   ${result.details}`));
            }
          } else {
            spinner.warn(`${step.type} removal ${options.dryRun ? 'would fail' : 'failed'}: ${result.error}`);
          }
        } catch (error) {
          spinner.fail(`Failed to remove ${step.type}: ${error.message}`);
        }
      }
      
      if (options.dryRun) {
        console.log(chalk.yellow('\n🎆 DRY RUN COMPLETE - Nothing was actually removed'));
        console.log(chalk.gray('   Run without --dry-run to perform actual uninstallation'));
      } else {
        console.log(chalk.green('\n✅ ClaudePoint uninstallation complete!'));
        
        if (!options.deleteCheckpoints) {
          console.log(chalk.blue('\n📁 Note: Your .claudepoint directories and checkpoints were preserved'));
        }
        
        console.log(chalk.yellow('\n🔄 Next steps:'));
        console.log('  1. Restart Claude Code to fully remove hooks/MCP integration');
        console.log('  2. Uninstall the npm package: npm uninstall -g claudepoint');
        
        if (options.deleteCheckpoints) {
          console.log(chalk.red('\n⚠️ WARNING: Your checkpoints were deleted and cannot be recovered'));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('\n🚨 Uninstallation failed:'), error.message);
      process.exit(1);
    }
  });

// Helper functions for uninstallation
async function checkMCPInstallation() {
  const platform = os.platform();
  let configPath;
  
  if (platform === 'darwin') {
    configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    configPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else {
    configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
  
  try {
    const configData = await fsPromises.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Check for ANY claudepoint entries (claudepoint, claudepoint_1, etc.)
    let found = false;
    let claudepointKeys = [];
    if (config.mcpServers) {
      claudepointKeys = Object.keys(config.mcpServers).filter(key => 
        key === 'claudepoint' || key.startsWith('claudepoint_')
      );
      found = claudepointKeys.length > 0;
    }
    
    return { found, configPath, claudepointKeys };
  } catch (error) {
    return { found: false, configPath, claudepointKeys: [] };
  }
}

async function removeMCPConfiguration(configPath, dryRun) {
  if (dryRun) {
    return { success: true, details: 'Would remove claudepoint from mcpServers' };
  }
  
  try {
    const configData = await fsPromises.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Remove ALL claudepoint entries (claudepoint, claudepoint_1, etc.)
    if (config.mcpServers) {
      const claudepointKeys = Object.keys(config.mcpServers).filter(key => 
        key === 'claudepoint' || key.startsWith('claudepoint_')
      );
      
      if (claudepointKeys.length > 0) {
        claudepointKeys.forEach(key => {
          delete config.mcpServers[key];
        });
        
        // Remove mcpServers entirely if it's empty
        if (Object.keys(config.mcpServers).length === 0) {
          delete config.mcpServers;
        }
        
        await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2));
        return { success: true, details: `Removed ${claudepointKeys.length} claudepoint MCP entries: ${claudepointKeys.join(', ')}` };
      }
    }
    
    return { success: true, details: 'No claudepoint MCP configuration found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkHooksInstallation() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  
  try {
    const settingsData = await fsPromises.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    const found = settings.hooks?.PreToolUse && 
                 Object.values(settings.hooks.PreToolUse).some(cmd => 
                   typeof cmd === 'string' && cmd.includes('claudepoint-hook'));
    return { found, settingsPath };
  } catch (error) {
    return { found: false, settingsPath };
  }
}

async function removeHooksConfiguration(settingsPath, dryRun) {
  if (dryRun) {
    return { success: true, details: 'Would remove claudepoint hooks from PreToolUse' };
  }
  
  try {
    const settingsData = await fsPromises.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    
    if (settings.hooks?.PreToolUse) {
      // Remove all claudepoint hooks
      Object.keys(settings.hooks.PreToolUse).forEach(tool => {
        if (settings.hooks.PreToolUse[tool] && 
            settings.hooks.PreToolUse[tool].includes('claudepoint-hook')) {
          delete settings.hooks.PreToolUse[tool];
        }
      });
      
      // Clean up empty objects
      if (Object.keys(settings.hooks.PreToolUse).length === 0) {
        delete settings.hooks.PreToolUse;
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }
      
      await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      return { success: true, details: 'Removed claudepoint hooks configuration' };
    }
    
    return { success: true, details: 'No claudepoint hooks configuration found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkSlashCommands() {
  const commandsDir = path.join(process.cwd(), '.claude', 'commands');
  
  try {
    const files = await fsPromises.readdir(commandsDir);
    const claudepointFiles = files.filter(file => 
      file.includes('claudepoint') || file.includes('undo.md') || file.includes('changes.md') || file.includes('ultrathink.md')
    );
    return { found: claudepointFiles.length > 0, commandsDir, files: claudepointFiles };
  } catch (error) {
    return { found: false, commandsDir, files: [] };
  }
}

async function removeSlashCommands(commandsDir, dryRun) {
  if (dryRun) {
    return { success: true, details: 'Would remove claudepoint slash command files' };
  }
  
  try {
    const files = await fsPromises.readdir(commandsDir);
    const claudepointFiles = files.filter(file => 
      file.includes('claudepoint') || file.includes('undo.md') || file.includes('changes.md') || file.includes('ultrathink.md')
    );
    
    let removedCount = 0;
    for (const file of claudepointFiles) {
      await fsPromises.unlink(path.join(commandsDir, file));
      removedCount++;
    }
    
    return { success: true, details: `Removed ${removedCount} slash command files` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkLocalCheckpoints() {
  const checkpointDir = path.join(process.cwd(), '.claudepoint');
  
  try {
    await fsPromises.access(checkpointDir);
    const stats = await fsPromises.stat(checkpointDir);
    return { found: stats.isDirectory(), path: checkpointDir };
  } catch (error) {
    return { found: false, path: checkpointDir };
  }
}

async function removeLocalCheckpoints(checkpointPath, dryRun) {
  if (dryRun) {
    return { success: true, details: 'Would remove .claudepoint directory and all checkpoints' };
  }
  
  try {
    await fsPromises.rm(checkpointPath, { recursive: true, force: true });
    return { success: true, details: 'Removed .claudepoint directory and all checkpoints' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

program.parse();