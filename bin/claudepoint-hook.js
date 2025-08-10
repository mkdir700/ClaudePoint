#!/usr/bin/env node

/**
 * ClaudePoint Hook Helper
 * Integrates with Claude Code hooks for automatic checkpoint creation
 * 
 * This script is called by Claude Code hooks and handles:
 * - Safety checkpoints before bulk operations
 * - Optional changelog integration
 * - Smart batching to avoid checkpoint spam
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fsPromises } from 'fs';
import CheckpointManager from '../src/lib/checkpoint-manager.js';
import { program } from 'commander';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

program
  .name('claudepoint-hook')
  .description('ClaudePoint hook integration for Claude Code')
  .version(packageJson.version);

program
  .option('--trigger <type>', 'Hook trigger type')
  .option('--tool <name>', 'Tool name that triggered the hook')
  .option('--debug', 'Enable debug output')
  .parse();

const options = program.opts();

async function logHookAttempt(projectDir, message, isError = false) {
  try {
    const logFile = join(projectDir, '.claudepoint', 'hooks.log');
    const timestamp = new Date().toISOString();
    const level = isError ? 'ERROR' : 'INFO';
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;
    
    await fsPromises.appendFile(logFile, logEntry);
  } catch (error) {
    // Silently fail if logging fails - don't break the hook
  }
}

async function findProjectDirectory() {
  // Strategy 1: Use env var if set
  if (process.env.CLAUDEPOINT_PROJECT_DIR) {
    return process.env.CLAUDEPOINT_PROJECT_DIR;
  }
  
  // Strategy 2: Look for .claudepoint directory starting from cwd
  let currentDir = process.cwd();
  const root = '/';
  
  while (currentDir !== root) {
    const checkpointDir = join(currentDir, '.claudepoint');
    try {
      await fsPromises.access(checkpointDir);
      return currentDir; // Found .claudepoint directory
    } catch (error) {
      // Continue searching
    }
    
    currentDir = dirname(currentDir);
  }
  
  // Strategy 3: Fallback to cwd
  return process.cwd();
}

async function main() {
  try {
    // Get project directory with smart detection
    const projectDir = await findProjectDirectory();
    const manager = new CheckpointManager(projectDir);
    
    await logHookAttempt(projectDir, `Hook triggered: ${options.trigger} for tool ${options.tool}`);
    
    if (options.debug) {
      console.error(`[claudepoint-hook] Project dir: ${projectDir}`);
      console.error(`[claudepoint-hook] Trigger: ${options.trigger}`);
      console.error(`[claudepoint-hook] Tool: ${options.tool}`);
    }

    // Check if ClaudePoint is set up in this project
    const checkpointsDir = join(projectDir, '.claudepoint');
    try {
      await fsPromises.access(checkpointsDir);
    } catch (error) {
      await logHookAttempt(projectDir, 'ClaudePoint not set up in this project, skipping hook');
      if (options.debug) {
        console.error('[claudepoint-hook] ClaudePoint not set up in this project, exiting');
      }
      return; // Silently exit if ClaudePoint isn't set up
    }

    // Load hooks configuration
    const hooksConfig = await manager.loadHooksConfig();
    
    if (!hooksConfig.enabled) {
      await logHookAttempt(projectDir, 'Hooks are disabled in this project, skipping');
      if (options.debug) {
        console.error('[claudepoint-hook] Hooks disabled, exiting');
      }
      return;
    }

    // Handle different trigger types
    switch (options.trigger) {
      case 'before_bulk_edit':
        await handleBeforeBulkEdit(manager, hooksConfig, options, projectDir);
        break;
      
      case 'before_major_write':
        await handleBeforeMajorWrite(manager, hooksConfig, options, projectDir);
        break;
      
      case 'before_bash_commands':
        await handleBeforeBashCommands(manager, hooksConfig, options, projectDir);
        break;
      
      case 'before_file_operations':
        await handleBeforeFileOperations(manager, hooksConfig, options, projectDir);
        break;
      
      default:
        if (options.debug) {
          console.error(`[claudepoint-hook] Unknown trigger: ${options.trigger}`);
        }
    }

  } catch (error) {
    try {
      const projectDir = await findProjectDirectory();
      await logHookAttempt(projectDir, `Hook failed: ${error.message}`, true);
    } catch (logError) {
      // Ignore logging errors
    }
    
    if (options.debug) {
      console.error('[claudepoint-hook] Error:', error.message);
      console.error('[claudepoint-hook] Stack:', error.stack);
    }
    process.exit(1);
  }
}

async function handleBeforeBulkEdit(manager, config, options, projectDir) {
  const trigger = config.triggers?.before_bulk_edit;
  
  if (!trigger?.enabled) {
    await logHookAttempt(projectDir, `Trigger before_bulk_edit is disabled, skipping`);
    if (options.debug) {
      console.error('[claudepoint-hook] before_bulk_edit trigger disabled');
    }
    return;
  }

  // Create safety checkpoint
  const description = `Safety checkpoint before ${options.tool || 'bulk edit'}`;
  
  try {
    await logHookAttempt(projectDir, `Creating safety checkpoint: ${description}`);
    await manager.ensureDirectories();
    const result = await manager.create(null, description, false); // Don't force, respect anti-spam
    
    if (result.success) {
      await logHookAttempt(projectDir, `Successfully created checkpoint: ${result.name}`);
      if (options.debug) {
        console.error(`[claudepoint-hook] Created safety checkpoint: ${result.name}`);
      }
      
      // Add changelog entry if enabled
      if (config.auto_changelog) {
        await manager.logToChangelog(
          'SAFETY_CHECKPOINT',
          `Created safety checkpoint before ${options.tool || 'bulk operation'}`,
          `Automatic checkpoint created by ClaudePoint hooks`
        );
      }
    } else if (result.noChanges) {
      if (options.debug) {
        console.error(`[claudepoint-hook] No changes detected, skipping checkpoint`);
      }
      // This is not an error - just no changes to checkpoint
    } else if (result.tooRecent) {
      await logHookAttempt(projectDir, `Skipping checkpoint - too recent: ${result.error}`);
      if (options.debug) {
        console.error(`[claudepoint-hook] ${result.error}`);
      }
      // This is not an error - just anti-spam protection
    } else {
      if (options.debug) {
        console.error(`[claudepoint-hook] Failed to create checkpoint: ${result.error}`);
      }
    }
  } catch (error) {
    if (options.debug) {
      console.error('[claudepoint-hook] Error creating checkpoint:', error.message);
    }
  }
}

async function handleBeforeMajorWrite(manager, config, options, projectDir) {
  const trigger = config.triggers?.before_major_write;
  
  if (!trigger?.enabled) {
    return;
  }

  // Similar logic to bulk edit but for major file writes
  await handleBeforeBulkEdit(manager, config, options);
}

async function handleBeforeBashCommands(manager, config, options, projectDir) {
  const trigger = config.triggers?.before_bash_commands;
  
  if (!trigger?.enabled) {
    if (options.debug) {
      console.error('[claudepoint-hook] before_bash_commands trigger disabled');
    }
    return;
  }

  // Create safety checkpoint before bash commands
  const description = `Safety checkpoint before bash command execution`;
  
  try {
    await manager.ensureDirectories();
    const result = await manager.create(null, description, false); // Don't force, respect anti-spam
    
    if (result.success) {
      if (options.debug) {
        console.error(`[claudepoint-hook] Created safety checkpoint: ${result.name}`);
      }
      
      // Add changelog entry if enabled
      if (config.auto_changelog) {
        await manager.logToChangelog(
          'SAFETY_CHECKPOINT',
          `Created safety checkpoint before bash command execution`,
          `Automatic checkpoint created by ClaudePoint hooks before executing bash commands`
        );
      }
    } else if (result.noChanges) {
      if (options.debug) {
        console.error(`[claudepoint-hook] No changes detected, skipping checkpoint`);
      }
    }
  } catch (error) {
    if (options.debug) {
      console.error('[claudepoint-hook] Error creating checkpoint:', error.message);
    }
  }
}

async function handleBeforeFileOperations(manager, config, options, projectDir) {
  const trigger = config.triggers?.before_file_operations;
  
  if (!trigger?.enabled) {
    if (options.debug) {
      console.error('[claudepoint-hook] before_file_operations trigger disabled');
    }
    return;
  }

  // Create safety checkpoint before any file operations (comprehensive protection)
  const description = `Safety checkpoint before ${options.tool || 'file'} operation`;
  
  try {
    await manager.ensureDirectories();
    const result = await manager.create(null, description, false); // Don't force, respect anti-spam
    
    if (result.success) {
      if (options.debug) {
        console.error(`[claudepoint-hook] Created safety checkpoint: ${result.name}`);
      }
      
      // Add changelog entry if enabled
      if (config.auto_changelog) {
        await manager.logToChangelog(
          'SAFETY_CHECKPOINT',
          `Created safety checkpoint before ${options.tool || 'file'} operation`,
          `Automatic checkpoint created by ClaudePoint hooks for comprehensive file operation protection`
        );
      }
    } else if (result.noChanges) {
      if (options.debug) {
        console.error(`[claudepoint-hook] No changes detected, skipping checkpoint`);
      }
    }
  } catch (error) {
    if (options.debug) {
      console.error('[claudepoint-hook] Error creating checkpoint:', error.message);
    }
  }
}

main().catch(error => {
  if (options.debug) {
    console.error('Unhandled error in claudepoint-hook:', error);
  }
  process.exit(1);
});