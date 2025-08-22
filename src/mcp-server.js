#!/usr/bin/env node

/**
 * ClaudePoint MCP Server
 * The safest way to experiment with Claude Code
 * 
 * GitHub: https://github.com/Andycufari/ClaudePoint
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import CheckpointManager from './lib/checkpoint-manager.js';
import { initializeSlashCommands } from './lib/slash-commands.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

class ClaudePointMCPServer {
  constructor() {
    try {
      this.server = new Server(
        {
          name: 'claudepoint',
          version: packageJson.version,
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Get the working directory from MCP environment or current directory
      // Claude Code sets the cwd to the project directory when launching MCP servers
      const workingDir = process.cwd();
      console.error(`[claudepoint] Using working directory: ${workingDir}`);
      console.error(`[claudepoint] Process started from: ${process.cwd()}`);
      console.error(`[claudepoint] Environment CWD: ${process.env.PWD || 'not set'}`);
      this.manager = new CheckpointManager(workingDir);
      this.setupToolHandlers();
    } catch (error) {
      console.error('Failed to initialize ClaudePoint MCP server:', error);
      console.error('Error details:', error.stack);
      throw error;
    }
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_claudepoint',
            description: '💾 Deploy a new claudepoint // Lock in your digital DNA and experiment fearlessly',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Optional custom name for the checkpoint'
                },
                description: {
                  type: 'string',
                  description: 'Description of what this checkpoint represents'
                }
              }
            }
          },
          {
            name: 'list_claudepoints',
            description: '🗂️ Browse your claudepoint vault // View your collection of digital artifacts',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'restore_claudepoint',
            description: '🔄 Time travel to a specific claudepoint // Precision restoration with emergency backup',
            inputSchema: {
              type: 'object',
              properties: {
                claudepoint: {
                  type: 'string',
                  description: 'Name or partial name of the claudepoint to restore'
                },
                dry_run: {
                  type: 'boolean',
                  description: 'Preview changes without actually restoring',
                  default: false
                }
              },
              required: ['claudepoint']
            }
          },
          {
            name: 'setup_claudepoint',
            description: '🎆 Initialize ClaudePoint // Creates .claudepoint vault and activates stealth mode',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_changelog',
            description: '📡 Access development history // View your coding adventure timeline',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'set_changelog',
            description: 'Add a custom entry to the development history (for Claude Code to log what changes were made)',
            inputSchema: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Brief description of what changes were made'
                },
                details: {
                  type: 'string',
                  description: 'Optional detailed explanation of the changes'
                },
                action_type: {
                  type: 'string',
                  description: 'Type of action (e.g., REFACTOR, ADD_FEATURE, BUG_FIX, OPTIMIZATION)',
                  default: 'CODE_CHANGE'
                }
              },
              required: ['description']
            }
          },
          {
            name: 'init_slash_commands',
            description: '🚀 Deploy slash command arsenal // Install claudepoint commands in Claude Code',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'undo_claudepoint',
            description: '🔄 Instant time hack // Quick restore to your last claudepoint',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_changes',
            description: '🔍 Scan for changes // See what\'s different since your last claudepoint',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'configure_claudepoint',
            description: '⚙️ Enter configuration mode // View and tune your claudepoint settings',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'diff_claudepoint',
            description: '🔍 Open VSCode diff // Compare checkpoint with current files visually',
            inputSchema: {
              type: 'object',
              properties: {
                checkpoint: {
                  type: 'string',
                  description: 'Checkpoint name to compare against'
                },
                file: {
                  type: 'string',
                  description: 'Specific file to compare (optional - if not provided, shows changed files list)'
                },
                all: {
                  type: 'boolean',
                  description: 'Compare all changed files at once',
                  default: false
                },
                maxFiles: {
                  type: 'number',
                  description: 'Maximum number of files to compare when using all option',
                  default: 10
                }
              },
              required: ['checkpoint']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_claudepoint':
            return await this.handleCreateClaudepoint(args);
          
          case 'list_claudepoints':
            return await this.handleListClaudepoints(args);
          
          case 'restore_claudepoint':
            return await this.handleRestoreClaudepoint(args);
            
          case 'undo_claudepoint':
            return await this.handleUndoClaudepoint(args);
            
          case 'get_changes':
            return await this.handleGetChanges(args);
            
          case 'configure_claudepoint':
            return await this.handleConfigureClaudepoint(args);
          
          case 'diff_claudepoint':
            return await this.handleDiffClaudepoint(args);
          
          case 'setup_claudepoint':
            return await this.handleSetup(args);
          
          case 'get_changelog':
            return await this.handleGetChangelog(args);
          
          case 'set_changelog':
            return await this.handleSetChangelog(args);
          
          case 'init_slash_commands':
            return await this.handleInitSlashCommands(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async handleCreateClaudepoint(args) {
    const { name, description } = args || {};
    
    console.error(`[claudepoint] Creating claudepoint: name=${name}, desc=${description}`);
    console.error(`[claudepoint] Working in: ${process.cwd()}`);
    
    try {
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out after 10 seconds')), 10000);
      });
      
      const operationPromise = (async () => {
        await this.manager.ensureDirectories();
        console.error(`[claudepoint] Getting project files...`);
        const files = await this.manager.getProjectFiles();
        console.error(`[claudepoint] Found ${files.length} files`);
        return files;
      })();
      
      const files = await Promise.race([operationPromise, timeoutPromise]);
      
      if (files.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '🚨 No files found to deploy! Make sure you\'re in a project directory and run setup first.'
            }
          ]
        };
      }

      const result = await this.manager.create(name, description);
      
      if (result.success) {
        const successMsg = this.manager.getRandomMessage(this.manager.successMessages);
        return {
          content: [
            {
              type: 'text',
              text: `${successMsg}\n   💾 Name: ${result.name}\n   📁 Files: ${result.fileCount}\n   📊 Size: ${result.size}\n   📝 Description: ${result.description || 'Manual claudepoint'}`
            }
          ]
        };
      } else if (result.noChanges) {
        return {
          content: [
            {
              type: 'text',
              text: '🤔 Codebase is stable // No changes detected since last claudepoint'
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `🚨 Deploy failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Error deploying claudepoint: ${error.message}`
          }
        ]
      };
    }
  }

  async handleSetChangelog(args) {
    const { description, details, action_type = 'CODE_CHANGE' } = args || {};
    
    if (!description) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Error: Description is required for changelog entry'
          }
        ]
      };
    }

    try {
      await this.manager.logToChangelog(action_type, description, details);
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Changelog entry added: ${description}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error adding changelog entry: ${error.message}`
          }
        ]
      };
    }
  }

  async handleGetChangelog(args) {
    try {
      const changelog = await this.manager.getChangelog();
      
      if (changelog.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📋 No development history found. Start creating checkpoints to build your project timeline!'
            }
          ]
        };
      }

      let output = `📋 Development History (${changelog.length} entries):\n\n`;
      
      changelog.slice(0, 10).forEach((entry, index) => {
        output += `${index + 1}. **${entry.action}** - ${entry.timestamp}\n`;
        output += `   ${entry.description}\n`;
        if (entry.details) {
          output += `   _${entry.details}_\n`;
        }
        output += '\n';
      });

      if (changelog.length > 10) {
        output += `... and ${changelog.length - 10} more entries. Use CLI 'claudepoint changelog' for full history.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error getting changelog: ${error.message}`
          }
        ]
      };
    }
  }

  async handleListClaudepoints(args) {
    try {
      const claudepoints = await this.manager.getCheckpoints();
      
      if (claudepoints.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '🤔 No claudepoints found in the vault. Deploy your first with create_claudepoint!'
            }
          ]
        };
      }

      const listMsg = this.manager.getRandomMessage(this.manager.listMessages);
      let output = `${listMsg}\n📦 Total claudepoints: ${claudepoints.length}\n\n`;
      
      claudepoints.forEach((cp, index) => {
        const date = new Date(cp.timestamp).toLocaleString();
        output += `${index + 1}. 💾 ${cp.name}\n`;
        output += `   📝 ${cp.description}\n`;
        output += `   📅 ${date} | ${cp.fileCount} files | ${this.manager.formatSize(cp.totalSize)}\n\n`;
      });

      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Error browsing vault: ${error.message}`
          }
        ]
      };
    }
  }

  async handleRestoreClaudepoint(args) {
    const { claudepoint, dry_run = false } = args || {};
    
    try {
      const checkpoints = await this.manager.getCheckpoints();
      const targetCheckpoint = checkpoints.find(cp => 
        cp.name === claudepoint || cp.name.includes(claudepoint)
      );

      if (!targetCheckpoint) {
        const available = checkpoints.slice(0, 5).map(cp => `  - ${cp.name}`).join('\n');
        return {
          content: [
            {
              type: 'text',
              text: `🚨 Claudepoint not found: ${claudepoint}\n\nAvailable claudepoints:\n${available}`
            }
          ]
        };
      }

      if (dry_run) {
        const currentFiles = await this.manager.getProjectFiles();
        const filesToDelete = currentFiles.filter(f => !targetCheckpoint.files.includes(f));
        
        let output = `🔍 DRY RUN - Would restore: ${targetCheckpoint.name}\n`;
        output += `   📝 Description: ${targetCheckpoint.description}\n`;
        output += `   📅 Date: ${new Date(targetCheckpoint.timestamp).toLocaleString()}\n`;
        output += `   📁 Files: ${targetCheckpoint.fileCount}\n`;
        
        if (filesToDelete.length > 0) {
          output += `   🗑️  Would delete ${filesToDelete.length} files that didn't exist in checkpoint\n`;
        }
        
        output += '\nUse restore_claudepoint without dry_run to proceed.';
        
        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };
      }

      // Perform actual restore
      const result = await this.manager.restore(claudepoint, false);
      
      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `${this.manager.getRandomMessage(this.manager.undoMessages)}\n   🔒 Emergency backup: ${result.emergencyBackup}\n   🔄 Restored: ${targetCheckpoint.name}\n   📁 Files restored: ${targetCheckpoint.fileCount}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `🚨 Time travel failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Time travel error: ${error.message}`
          }
        ]
      };
    }
  }

  async handleInitSlashCommands(args) {
    try {
      const result = await initializeSlashCommands();
      
      if (result.success) {
        let output = '🚀 ClaudePoint slash commands initialized!\n\n';
        output += '✅ Created .claude/commands directory\n';
        output += '✅ Added complete claudepoint command arsenal\n';
        output += '✅ Created 7 essential slash commands\n';
        output += '\n💡 Main slash commands:\n';
        output += '  • /claudepoint - Deploy a new claudepoint\n';
        output += '  • /undo - Instant time hack to last claudepoint\n';
        output += '  • /claudepoint-restore - Time travel with interactive selection\n';
        output += '  • /claudepoint-list - Browse your claudepoint vault\n';
        output += '  • /changes - Scan for modifications\n';
        output += '  • /claudepoint-changelog - View history\n';
        output += '  • /ultrathink - Activate deep reasoning mode\n';
        output += '\n🎯 Type / in Claude Code to see and use these commands!';
        
        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to initialize slash commands: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error initializing slash commands: ${error.message}`
          }
        ]
      };
    }
  }

  async handleSetup(args) {
    try {
      const result = await this.manager.setup();
      
      if (result.success) {
        let output = '💾 ClaudePoint is ONLINE!\n\n';
        output += '✨ Created .claudepoint vault\n';
        output += '🔒 Updated .gitignore (stealth mode activated)\n';
        output += '⚙️ Configuration loaded\n';
        
        if (result.initialCheckpoint) {
          output += `✨ Deployed initial claudepoint: ${result.initialCheckpoint}\n`;
        }
        
        output += '\n🚀 Quick command arsenal:\n';
        output += '  • create_claudepoint - Deploy a new claudepoint\n';
        output += '  • list_claudepoints - Browse your vault\n';
        output += '  • restore_claudepoint - Time travel to previous state\n';
        output += '  • undo_claudepoint - Quick time hack to last claudepoint\n';
        output += '  • get_changes - Scan for code changes\n';
        output += '  • get_changelog - View your coding adventure timeline\n';
        output += '\n🎆 Tip: Deploy claudepoints before hacking the impossible!';
        
        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `🚨 Initialization failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Error during setup: ${error.message}`
            }
          ]
        };
    }
  }

  // 🚀 NEW: Quick undo handler
  async handleUndoClaudepoint(args) {
    try {
      const result = await this.manager.undoLastClaudepoint();
      
      if (result.success) {
        const undoMsg = this.manager.getRandomMessage(this.manager.undoMessages);
        return {
          content: [
            {
              type: 'text',
              text: `${undoMsg}\n   🛡️ Emergency backup: ${result.emergencyBackup}\n   🔄 Restored: ${result.restored}\n   📅 Back to the future!`
            }
          ]
        };
      } else if (result.noClaudepoints) {
        return {
          content: [
            {
              type: 'text',
              text: '🤔 No claudepoints found to undo. Deploy your first safety net!'
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `🚨 Time hack failed: ${result.error}`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Error during time hack: ${error.message}`
          }
        ]
      };
    }
  }

  // 🔍 NEW: Changes handler
  async handleGetChanges(args) {
    try {
      const changes = await this.manager.getChangedFilesSinceLastClaudepoint();
      
      if (changes.error) {
        return {
          content: [
            {
              type: 'text',
              text: `🚨 Scan error: ${changes.error}`
            }
          ]
        };
      }
      
      if (!changes.hasLastClaudepoint) {
        return {
          content: [
            {
              type: 'text',
              text: `🆕 No previous claudepoint found // Everything is new!\n📁 Total files in project: ${changes.totalChanges}\n\nDeploy your first claudepoint to start tracking changes.`
            }
          ]
        };
      }
      
      if (changes.totalChanges === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `✨ Codebase is stable // No changes detected\n📍 Last claudepoint: ${changes.lastClaudepointName}\n📅 Created: ${changes.lastClaudepointDate}\n\n🎯 Perfect time to experiment - you're fully protected!`
            }
          ]
        };
      }
      
      let output = `🎯 Changes detected: ${changes.totalChanges} modifications found\n`;
      output += `📍 Since claudepoint: ${changes.lastClaudepointName}\n`;
      output += `📅 Created: ${changes.lastClaudepointDate}\n\n`;
      
      if (changes.added.length > 0) {
        output += `➕ Added files (${changes.added.length}):\n`;
        changes.added.slice(0, 5).forEach(file => {
          output += `   + ${file}\n`;
        });
        if (changes.added.length > 5) {
          output += `   ... and ${changes.added.length - 5} more\n`;
        }
        output += '\n';
      }
      
      if (changes.modified.length > 0) {
        output += `📝 Modified files (${changes.modified.length}):\n`;
        changes.modified.slice(0, 5).forEach(file => {
          output += `   ~ ${file}\n`;
        });
        if (changes.modified.length > 5) {
          output += `   ... and ${changes.modified.length - 5} more\n`;
        }
        output += '\n';
      }
      
      if (changes.deleted.length > 0) {
        output += `🗑️ Deleted files (${changes.deleted.length}):\n`;
        changes.deleted.slice(0, 5).forEach(file => {
          output += `   - ${file}\n`;
        });
        if (changes.deleted.length > 5) {
          output += `   ... and ${changes.deleted.length - 5} more\n`;
        }
        output += '\n';
      }
      
      output += '💡 Ready to lock in these changes? Use create_claudepoint!';
      
      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
      
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Scan error: ${error.message}`
          }
        ]
      };
    }
  }

  // ⚙️ NEW: Configuration handler
  async handleConfigureClaudepoint(args) {
    try {
      const status = await this.manager.getConfigurationStatus();
      const configMsg = this.manager.getRandomMessage(this.manager.configMessages);
      
      let output = `${configMsg}\n\n`;
      output += `🎛️ Current Configuration:\n`;
      output += `   Max Claudepoints: ${status.maxClaudepoints}\n`;
      output += `   Current Claudepoints: ${status.currentClaudepoints}\n`;
      output += `   Max Age: ${status.maxAge} days ${status.maxAge === 0 ? '(unlimited)' : ''}\n`;
      output += `   Ignore Patterns: ${status.ignorePatterns} rules\n`;
      output += `   Auto Naming: ${status.autoName ? 'Enabled' : 'Disabled'}\n`;
      output += `   Config File: ${status.configPath}\n\n`;
      
      const config = await this.manager.loadConfig();
      if (config.additionalIgnores && config.additionalIgnores.length > 0) {
        output += `🚷 Additional Ignore Patterns:\n`;
        config.additionalIgnores.forEach(pattern => {
          output += `   • ${pattern}\n`;
        });
        output += '\n';
      }
      
      if (config.forceInclude && config.forceInclude.length > 0) {
        output += `⭐ Force Include Patterns:\n`;
        config.forceInclude.forEach(pattern => {
          output += `   • ${pattern}\n`;
        });
        output += '\n';
      }
      
      output += '🎨 Tip: Edit the config file directly or use the CLI setup for interactive configuration.';
      
      return {
        content: [
          {
            type: 'text',
            text: output
          }
        ]
      };
      
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Configuration error: ${error.message}`
          }
        ]
      };
    }
  }

  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('ClaudePoint MCP server running on stdio');
      console.error('Available tools: setup_claudepoint, create_claudepoint, list_claudepoints, restore_claudepoint, undo_claudepoint, get_changes, configure_claudepoint, diff_claudepoint, get_changelog, set_changelog, init_slash_commands');
      
      // Keep the process alive
      process.on('SIGINT', () => {
        console.error('MCP server shutting down...');
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.error('MCP server shutting down...');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      console.error('Error details:', error.stack);
      process.exit(1);
    }
  }

  async handleDiffClaudepoint(args) {
    const { checkpoint, file, all, maxFiles } = args || {};
    
    if (!checkpoint) {
      return {
        content: [
          {
            type: 'text',
            text: '🚨 No checkpoint specified. Please provide a checkpoint name to compare against.'
          }
        ]
      };
    }
    
    try {
      if (all) {
        // Compare all changed files
        const result = await this.manager.openVSCodeDiffAll(checkpoint, {
          maxFiles: maxFiles || 10,
          wait: false
        });
        
        if (!result.success) {
          if (result.noChanges) {
            return {
              content: [
                {
                  type: 'text',
                  text: `✨ No changes to compare\n📍 Checkpoint: ${checkpoint}\n🎯 Everything is in sync!`
                }
              ]
            };
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `🚨 Diff failed: ${result.error}`
              }
            ]
          };
        }
        
        let output = `🎯 Opened ${result.successful} diffs in VSCode\n`;
        output += `📍 Checkpoint: ${result.checkpointInfo.name}\n`;
        output += `   Created: ${result.checkpointInfo.date}\n`;
        output += `   Description: ${result.checkpointInfo.description}\n`;
        
        if (result.failed > 0) {
          output += `⚠️  ${result.failed} files failed to open\n`;
        }
        
        if (result.skipped > 0) {
          output += `📋 ${result.skipped} files skipped (increase maxFiles if needed)\n`;
        }
        
        output += '\n💡 Files opened in VSCode diff view - check your editor!';
        
        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };
        
      } else if (file) {
        // Compare specific file
        const result = await this.manager.openVSCodeDiff(checkpoint, file, {
          wait: false
        });
        
        if (!result.success) {
          let output = `🚨 Diff failed: ${result.error}`;
          if (result.suggestion) {
            output += `\n💡 ${result.suggestion}`;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: output
              }
            ]
          };
        }
        
        let output = `🎯 Opened diff in VSCode: ${file}\n`;
        output += `📍 Checkpoint: ${result.checkpointInfo.name}\n`;
        output += `   Created: ${result.checkpointInfo.date}\n`;
        output += `   Description: ${result.checkpointInfo.description}\n`;
        output += '\n💡 Comparing: Checkpoint vs Current';
        
        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };
        
      } else {
        // Show changed files and usage instructions
        const changes = await this.manager.getChangedFilesSinceLastClaudepoint();
        
        if (!changes.hasLastClaudepoint) {
          return {
            content: [
              {
                type: 'text',
                text: '🆕 No previous checkpoint found\n💡 Create a checkpoint first, then make changes to see diffs'
              }
            ]
          };
        }
        
        if (changes.totalChanges === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `✨ No changes detected\n📍 Since checkpoint: ${changes.lastClaudepointName}\n🎯 Everything is in sync!`
              }
            ]
          };
        }
        
        const changedFiles = [...changes.modified, ...changes.added];
        
        if (changedFiles.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '💡 Only deletions found - nothing to compare\nUse all=true parameter to see all changes including deletions.'
              }
            ]
          };
        }
        
        let output = `🎯 Found ${changes.totalChanges} changed files since ${changes.lastClaudepointName}:\n\n`;
        output += '📁 Changed files:\n';
        
        changedFiles.slice(0, 10).forEach((file, index) => {
          const prefix = changes.modified.includes(file) ? '📝' : '➕';
          output += `   ${index + 1}. ${prefix} ${file}\n`;
        });
        
        if (changedFiles.length > 10) {
          output += `   ... and ${changedFiles.length - 10} more files\n`;
        }
        
        output += '\n🚀 To compare files:\n';
        output += `• Use file parameter for specific file: {"checkpoint": "${checkpoint}", "file": "src/example.js"}\n`;
        output += `• Use all=true for all changed files: {"checkpoint": "${checkpoint}", "all": true}`;
        
        return {
          content: [
            {
              type: 'text',
              text: output
            }
          ]
        };
      }
      
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `🚨 Diff operation failed: ${error.message}`
          }
        ]
      };
    }
  }
}

// Start the server
const server = new ClaudePointMCPServer();
server.start().catch(error => {
  console.error('Failed to start server:', error);
  console.error('Error stack:', error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process for unhandled rejections in MCP server
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

export default ClaudePointMCPServer;