import fs from 'fs';
import path from 'path';
import tar from 'tar';
import ignore from 'ignore';
import crypto from 'crypto';
import os from 'os';

const { promises: fsPromises } = fs;

class CheckpointManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.checkpointDir = path.join(this.projectRoot, '.claudepoint');
    this.snapshotsDir = path.join(this.checkpointDir, 'snapshots');
    this.configFile = path.join(this.checkpointDir, 'config.json');
    this.changelogFile = path.join(this.checkpointDir, 'changelog.json');
    this.hooksConfigFile = path.join(this.checkpointDir, 'hooks.json');

    // 🕶️ Hacker vibes - cool messages for the coding experience
    this.successMessages = [
      '🚀 CLAUDEPOINT LOCKED IN // Ready to hack the impossible',
      '⚡ CODE VAULT SAVED // Your digital DNA is preserved',
      '🔥 CHECKPOINT DEPLOYED // Time to break things beautifully',
      '🎯 REALITY SNAPSHOT CAPTURED // Claude + Human = Unstoppable',
      '💾 DATA FORTRESS SECURED // Your coding session is immortalized',
      '🌟 QUANTUM STATE LOCKED // Ready for interdimensional debugging'
    ];

    this.undoMessages = [
      '🔄 INITIATING TIME HACK // Rolling back through digital history',
      '⏪ REALITY GLITCH DETECTED // Reverting to last stable dimension',
      '🎭 PLOT ARMOR ACTIVATED // Back to your legendary savepoint',
      '🚨 EMERGENCY ROLLBACK // Houston, we\'re going back in time',
      '✨ CTRL+Z OVERDRIVE // Undoing like a digital wizard'
    ];

    this.listMessages = [
      '📡 ACCESSING CODE VAULT // Your collection of digital artifacts',
      '🗂️ BROWSING CHECKPOINT ARCHIVE // Each one a moment of genius',
      '🎮 LOADING SAVE FILES // Your coding adventure continues',
      '🔍 SCANNING CLAUDEPOINT DATABASE // Beep boop beep...'
    ];

    this.configMessages = [
      '⚙️ ENTERING CONFIGURATION MODE // Time to tune your hacking rig',
      '🎛️ ADJUSTING SETTINGS // Making claudepoint work just right',
      '🔧 SYSTEM OPTIMIZATION // Preparing for maximum code velocity',
      '🎚️ FINE-TUNING PARAMETERS // Your checkpoint setup, perfected'
    ];
  }

  getRandomMessage(messageArray) {
    return messageArray[Math.floor(Math.random() * messageArray.length)];
  }

  async ensureDirectories() {
    await fsPromises.mkdir(this.checkpointDir, { recursive: true });
    await fsPromises.mkdir(this.snapshotsDir, { recursive: true });
  }

  async loadConfig() {
    const defaultConfig = {
      maxCheckpoints: 10,
      autoName: true,
      ignorePatterns: [
        '.git', '.claudepoint', 'node_modules', '.env', '.env.*',
        '*.log', '.DS_Store', 'Thumbs.db', '__pycache__', '*.pyc',
        '.vscode', '.idea', 'dist', 'build', 'coverage', '.nyc_output',
        '.next', '.nuxt', '.cache', 'tmp', 'temp'
      ],
      additionalIgnores: [],
      forceInclude: [],
      nameTemplate: 'checkpoint_{timestamp}',
      // Cleanup settings
      maxAge: 30 // Days to keep checkpoints (0 = no age limit)
    };

    try {
      const configData = await fsPromises.readFile(this.configFile, 'utf8');
      const config = JSON.parse(configData);
      // Merge with defaults for any missing keys
      return { ...defaultConfig, ...config };
    } catch (error) {
      // Create default config file
      await this.ensureDirectories();
      await fsPromises.writeFile(this.configFile, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
  }

  async loadHooksConfig() {
    const defaultHooksConfig = {
      enabled: true,
      auto_changelog: false,
      triggers: {
        before_bulk_edit: {
          enabled: true,
          tools: ['MultiEdit'],
          description: 'Safety checkpoint before bulk file edits (MultiEdit operations)'
        },
        before_major_write: {
          enabled: false,  // Disabled by default as it can be noisy
          tools: ['Write'],
          description: 'Safety checkpoint before major file writes (single file Write operations)'
        },
        before_bash_commands: {
          enabled: false,  // Disabled by default - user choice
          tools: ['Bash'],
          description: 'Safety checkpoint before executing bash commands'
        },
        before_file_operations: {
          enabled: false,  // Advanced option
          tools: ['Edit', 'MultiEdit', 'Write'],
          description: 'Safety checkpoint before any file modification (comprehensive protection)'
        }
      }
    };

    try {
      const configData = await fsPromises.readFile(this.hooksConfigFile, 'utf8');
      const config = JSON.parse(configData);
      // Merge with defaults for any missing keys
      return { ...defaultHooksConfig, ...config };
    } catch (error) {
      // Hooks config doesn't exist yet - return defaults but don't create file
      // File will be created by init-hooks command
      return defaultHooksConfig;
    }
  }

  async saveHooksConfig(config) {
    await this.ensureDirectories();
    await fsPromises.writeFile(this.hooksConfigFile, JSON.stringify(config, null, 2));
  }

  async shouldIgnore(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    const config = await this.loadConfig();
    const ig = ignore();

    // Use user-defined ignores if provided, otherwise use defaults + additional
    let ignorePatterns;
    if (config.ignores && Array.isArray(config.ignores)) {
      ignorePatterns = config.ignores; // Complete override
    } else {
      ignorePatterns = [...config.ignorePatterns, ...config.additionalIgnores];
    }

    // Add ignore patterns
    ig.add(ignorePatterns);

    // Add .gitignore patterns if file exists
    try {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      const gitignoreContent = await fsPromises.readFile(gitignorePath, 'utf8');
      ig.add(gitignoreContent);
    } catch (error) {
      // No gitignore file, continue
    }

    // Check if file should be ignored
    const shouldIgnore = ig.ignores(relativePath);

    // Check forceInclude patterns (these override ignores)
    if (shouldIgnore && config.forceInclude && Array.isArray(config.forceInclude)) {
      const forceIg = ignore();
      forceIg.add(config.forceInclude);
      if (forceIg.ignores(relativePath)) {
        return false; // Force include this file
      }
    }

    return shouldIgnore;
  }

  matchesPattern(str, pattern) {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  async getProjectFiles() {
    const files = [];
    const startTime = Date.now();
    let dirCount = 0;
    let fileCount = 0;

    // Safety check - don't scan home directory
    if (this.projectRoot === process.env.HOME || this.projectRoot === os.homedir()) {
      console.error(`[claudepoint] WARNING: Refusing to scan home directory: ${this.projectRoot}`);
      console.error(`[claudepoint] Use claudepoint in a specific project directory`);
      return [];
    }

    console.error(`[claudepoint] Scanning project files from: ${this.projectRoot}`);

    async function walkDir(dir) {
      try {
        dirCount++;
        if (dirCount > 1000) {
          console.error(`[claudepoint] WARNING: Scanned over 1000 directories, stopping`);
          return;
        }

        const entries = await fsPromises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!(await this.shouldIgnore(fullPath))) {
              await walkDir.call(this, fullPath);
            }
          } else if (entry.isFile()) {
            if (!(await this.shouldIgnore(fullPath))) {
              const relativePath = path.relative(this.projectRoot, fullPath);
              files.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await walkDir.call(this, this.projectRoot);

    const elapsed = Date.now() - startTime;
    console.error(`[claudepoint] File scan complete: ${files.length} files in ${elapsed}ms`);
    console.error(`[claudepoint] Scanned ${dirCount} directories`);

    return files.sort();
  }

  async calculateFileHash(filePath) {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const fileBuffer = await fsPromises.readFile(fullPath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      return null;
    }
  }

  async calculateFileHashes(files) {
    const hashes = new Map();

    for (const file of files) {
      const hash = await this.calculateFileHash(file);
      if (hash) {
        hashes.set(file, hash);
      }
    }

    return hashes;
  }

  async getCheckpointHashes(checkpointName) {
    try {
      const manifestPath = path.join(this.snapshotsDir, checkpointName, 'manifest.json');
      const manifestData = await fsPromises.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);

      // Return hashes if available (new format), otherwise empty map for backward compatibility
      return new Map(Object.entries(manifest.fileHashes || {}));
    } catch (error) {
      return new Map();
    }
  }

  async calculateChanges(currentFiles, lastCheckpointName) {
    const changes = { added: [], modified: [], deleted: [] };

    if (!lastCheckpointName) {
      // First checkpoint - all files are added
      changes.added = [...currentFiles];
      return changes;
    }

    // Get file hashes from last checkpoint
    const lastHashes = await this.getCheckpointHashes(lastCheckpointName);
    const currentHashes = await this.calculateFileHashes(currentFiles);

    // Find changes
    for (const [file, hash] of currentHashes) {
      if (!lastHashes.has(file)) {
        changes.added.push(file);
      } else if (lastHashes.get(file) !== hash) {
        changes.modified.push(file);
      }
    }

    // Find deletions
    for (const file of lastHashes.keys()) {
      if (!currentHashes.has(file)) {
        changes.deleted.push(file);
      }
    }

    return changes;
  }

  findBaseFullCheckpoint(checkpoints) {
    // Find the most recent full checkpoint
    return checkpoints.find(cp => cp.type === 'FULL');
  }

  // Always create full checkpoints now - incremental logic removed
  async shouldCreateFullCheckpoint(changes) {
    return true;
  }

  generateCheckpointName(customName, description) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (customName) {
      return `${customName}_${timestamp}`;
    }

    if (description) {
      const cleanDesc = description.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 30);
      return `${cleanDesc}_${timestamp}`;
    }

    return `checkpoint_${timestamp}`;
  }

  async setup(options = {}) {
    try {
      await this.ensureDirectories();

      // Setup gitignore if requested (default true for backward compatibility)
      const updateGitignore = options.updateGitignore !== false;

      if (updateGitignore) {
        const gitignorePath = path.join(this.projectRoot, '.gitignore');
        const gitignoreEntry = '.claudepoint/';

        try {
          let gitignoreContent = '';
          try {
            gitignoreContent = await fsPromises.readFile(gitignorePath, 'utf8');
          } catch (error) {
            // File doesn't exist, will create new one
          }

          if (!gitignoreContent.includes(gitignoreEntry)) {
            const newContent = gitignoreContent +
              (gitignoreContent && !gitignoreContent.endsWith('\n') ? '\n' : '') +
              '\n# ClaudePoint checkpoint system\n' + gitignoreEntry + '\n';
            await fsPromises.writeFile(gitignorePath, newContent);
          }
        } catch (error) {
          // Could not update .gitignore, continue
        }
      }

      // Create initial config
      await this.loadConfig();

      // Create initial checkpoint if requested and files exist
      const createInitial = options.createInitial !== false;
      let initialCheckpoint = null;

      if (createInitial) {
        const files = await this.getProjectFiles();
        if (files.length > 0) {
          // Create initial checkpoint (always full now)
          const result = await this.create('initial', 'Initial ClaudePoint setup');
          if (result.success) {
            initialCheckpoint = result.name;
          }
        }
      }

      return {
        success: true,
        initialCheckpoint,
        gitignoreUpdated: updateGitignore
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async create(name, description, forceCreate = false) {
    try {
      await this.ensureDirectories();
      const files = await this.getProjectFiles();

      if (files.length === 0) {
        return {
          success: false,
          error: 'No files found to checkpoint'
        };
      }

      // Get checkpoints for comparison
      const checkpoints = await this.getCheckpoints();
      const lastCheckpoint = checkpoints.length > 0 ? checkpoints[0] : null;

      // Anti-spam protection: prevent multiple checkpoints within 30 seconds
      // unless explicitly forced or manually created (has custom name)
      if (!forceCreate && !name && lastCheckpoint) {
        const lastCheckpointTime = new Date(lastCheckpoint.timestamp);
        const now = new Date();
        const timeDiff = (now - lastCheckpointTime) / 1000; // seconds

        if (timeDiff < 30) {
          console.error(`[claudepoint] Skipping checkpoint - created too recently (${Math.round(timeDiff)}s ago)`);
          return {
            success: false,
            error: `Checkpoint created too recently (${Math.round(timeDiff)}s ago)`,
            tooRecent: true
          };
        }
      }

      // For change detection, compare against the most recent checkpoint
      // For incremental storage, we'll determine the base checkpoint separately
      const changes = await this.calculateChanges(files, lastCheckpoint?.name);

      // Check if there are any actual changes for incremental checkpoints
      const hasChanges = changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0;

      if (!forceCreate && !hasChanges && lastCheckpoint) {
        return {
          success: false,
          error: 'No changes detected since last checkpoint',
          noChanges: true
        };
      }

      // Always create full checkpoints now
      const checkpointType = 'FULL';

      const checkpointName = this.generateCheckpointName(name, description);
      const checkpointPath = path.join(this.snapshotsDir, checkpointName);
      await fsPromises.mkdir(checkpointPath, { recursive: true });

      // Calculate file hashes for the manifest
      const fileHashes = await this.calculateFileHashes(files);

      // Calculate total size
      let totalSize = 0;
      for (const file of files) {
        try {
          const stats = await fsPromises.stat(path.join(this.projectRoot, file));
          totalSize += stats.size;
        } catch (error) {
          // File might have been deleted, skip
        }
      }

      // Create extended manifest
      const manifest = {
        name: checkpointName,
        timestamp: new Date().toISOString(),
        description: description || 'Manual checkpoint',
        type: checkpointType,
        files: files,
        fileCount: files.length,
        totalSize: totalSize,
        fileHashes: Object.fromEntries(fileHashes)
      };

      await fsPromises.writeFile(
        path.join(checkpointPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Always create full tarball
      const tarPath = path.join(checkpointPath, 'files.tar.gz');
      await tar.create(
        {
          gzip: true,
          file: tarPath,
          cwd: this.projectRoot
        },
        files
      );

      // Cleanup old checkpoints
      await this.cleanupOldCheckpoints();

      // Log to changelog
      const logMessage = `Created ${checkpointType.toLowerCase()} claudepoint: ${checkpointName}`;
      await this.logToChangelog('CREATE_CLAUDEPOINT', logMessage, manifest.description);

      return {
        success: true,
        name: checkpointName,
        description: manifest.description,
        type: checkpointType,
        fileCount: checkpointType === 'INCREMENTAL' ? manifest.statistics.filesChanged : files.length,
        changesCount: checkpointType === 'INCREMENTAL' ? manifest.statistics.filesChanged : files.length,
        size: checkpointType === 'INCREMENTAL' ?
          this.formatSize(manifest.statistics.bytesAdded + manifest.statistics.bytesModified) :
          this.formatSize(totalSize)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createIncrementalCheckpoint(checkpointPath, changes, manifest) {
    // Create directories for incremental storage
    const addedDir = path.join(checkpointPath, 'added');
    const modifiedDir = path.join(checkpointPath, 'modified');

    if (changes.added.length > 0) {
      await fsPromises.mkdir(addedDir, { recursive: true });
    }

    if (changes.modified.length > 0) {
      await fsPromises.mkdir(modifiedDir, { recursive: true });
    }

    let bytesAdded = 0;
    let bytesModified = 0;

    // Copy added files
    for (const file of changes.added) {
      const srcPath = path.join(this.projectRoot, file);
      const destPath = path.join(addedDir, file);

      // Ensure destination directory exists
      await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

      try {
        await fsPromises.copyFile(srcPath, destPath);
        const stats = await fsPromises.stat(srcPath);
        bytesAdded += stats.size;
      } catch (error) {
        // File might have been deleted, skip
      }
    }

    // Copy modified files
    for (const file of changes.modified) {
      const srcPath = path.join(this.projectRoot, file);
      const destPath = path.join(modifiedDir, file);

      // Ensure destination directory exists
      await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

      try {
        await fsPromises.copyFile(srcPath, destPath);
        const stats = await fsPromises.stat(srcPath);
        bytesModified += stats.size;
      } catch (error) {
        // File might have been deleted, skip
      }
    }

    // Save deleted files list
    if (changes.deleted.length > 0) {
      await fsPromises.writeFile(
        path.join(checkpointPath, 'deleted.json'),
        JSON.stringify(changes.deleted, null, 2)
      );
    }

    // Update statistics in manifest
    manifest.statistics.bytesAdded = bytesAdded;
    manifest.statistics.bytesModified = bytesModified;
    manifest.statistics.compressionRatio = (bytesAdded + bytesModified) / manifest.totalSize;

    // Update manifest with statistics
    await fsPromises.writeFile(
      path.join(checkpointPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  async restore(checkpointName, dryRun = false) {
    try {
      const checkpoints = await this.getCheckpoints();
      const checkpoint = checkpoints.find(cp =>
        cp.name === checkpointName || cp.name.includes(checkpointName)
      );

      if (!checkpoint) {
        return {
          success: false,
          error: `Checkpoint not found: ${checkpointName}`
        };
      }

      if (dryRun) {
        const chain = await this.buildCheckpointChain(checkpoint);
        return {
          success: true,
          dryRun: true,
          checkpoint: checkpoint,
          chainLength: chain.length,
          restoreStrategy: checkpoint.type === 'FULL' ? 'direct' : 'incremental'
        };
      }

      // Create emergency backup
      const emergencyName = `emergency_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
      const backupResult = await this.create(emergencyName, 'Auto-backup before restore', true);

      if (!backupResult.success) {
        return {
          success: false,
          error: 'Failed to create emergency backup'
        };
      }

      if (checkpoint.type === 'FULL' || !checkpoint.type) {
        // Restore full checkpoint (existing behavior)
        await this.restoreFullCheckpoint(checkpoint);
      } else {
        // Restore incremental checkpoint chain
        await this.restoreIncrementalCheckpoint(checkpoint);
      }

      // Clean up empty directories
      await this.cleanupEmptyDirectories();

      // Log to changelog
      await this.logToChangelog('RESTORE_CLAUDEPOINT', `Restored ${checkpoint.type || 'FULL'} claudepoint: ${checkpoint.name}`, `Emergency backup: ${emergencyName}`);

      return {
        success: true,
        emergencyBackup: emergencyName,
        restored: checkpoint.name,
        type: checkpoint.type || 'FULL'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async restoreFullCheckpoint(checkpoint) {
    // Get file differences
    const currentFiles = new Set(await this.getProjectFiles());
    const checkpointFiles = new Set(checkpoint.files);
    const filesToDelete = [...currentFiles].filter(f => !checkpointFiles.has(f));

    // Delete files that shouldn't exist
    for (const file of filesToDelete) {
      const fullPath = path.join(this.projectRoot, file);
      try {
        await fsPromises.unlink(fullPath);
      } catch (error) {
        // File already gone, continue
      }
    }

    // Extract checkpoint files
    const checkpointPath = path.join(this.snapshotsDir, checkpoint.name);
    const tarPath = path.join(checkpointPath, 'files.tar.gz');

    await tar.extract({
      file: tarPath,
      cwd: this.projectRoot
    });
  }

  async restoreIncrementalCheckpoint(targetCheckpoint) {
    // Build the checkpoint chain from target back to base
    const chain = await this.buildCheckpointChain(targetCheckpoint);

    if (chain.length === 0) {
      throw new Error('No restoration chain found - missing base checkpoint');
    }

    // Start with the base full checkpoint
    const baseCheckpoint = chain[0];
    await this.restoreFullCheckpoint(baseCheckpoint);

    // Apply incremental changes in order
    for (let i = 1; i < chain.length; i++) {
      const incrementalCheckpoint = chain[i];
      await this.applyIncrementalChanges(incrementalCheckpoint);
    }
  }

  async buildCheckpointChain(targetCheckpoint) {
    const chain = [];
    const checkpoints = await this.getCheckpoints();
    const checkpointMap = new Map(checkpoints.map(cp => [cp.name, cp]));

    let current = targetCheckpoint;
    chain.unshift(current);

    // Walk backwards through the chain
    while (current.type === 'INCREMENTAL' && current.baseCheckpoint) {
      const baseCheckpoint = checkpointMap.get(current.baseCheckpoint);
      if (!baseCheckpoint) {
        throw new Error(`Missing base checkpoint: ${current.baseCheckpoint}`);
      }

      chain.unshift(baseCheckpoint);
      current = baseCheckpoint;
    }

    // Ensure we have a full checkpoint at the base
    if (chain[0].type !== 'FULL' && !chain[0].type) {
      throw new Error('Checkpoint chain does not start with a full checkpoint');
    }

    return chain;
  }

  async applyIncrementalChanges(checkpoint) {
    const checkpointPath = path.join(this.snapshotsDir, checkpoint.name);
    const changes = checkpoint.changes;

    if (!changes) {
      return; // No changes to apply
    }

    // Apply added files
    if (changes.added && changes.added.length > 0) {
      const addedDir = path.join(checkpointPath, 'added');
      for (const file of changes.added) {
        const srcPath = path.join(addedDir, file);
        const destPath = path.join(this.projectRoot, file);

        // Ensure destination directory exists
        await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

        try {
          await fsPromises.copyFile(srcPath, destPath);
        } catch (error) {
          // Source file might be missing, skip
        }
      }
    }

    // Apply modified files
    if (changes.modified && changes.modified.length > 0) {
      const modifiedDir = path.join(checkpointPath, 'modified');
      for (const file of changes.modified) {
        const srcPath = path.join(modifiedDir, file);
        const destPath = path.join(this.projectRoot, file);

        // Ensure destination directory exists
        await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

        try {
          await fsPromises.copyFile(srcPath, destPath);
        } catch (error) {
          // Source file might be missing, skip
        }
      }
    }

    // Apply deleted files
    if (changes.deleted && changes.deleted.length > 0) {
      for (const file of changes.deleted) {
        const filePath = path.join(this.projectRoot, file);
        try {
          await fsPromises.unlink(filePath);
        } catch (error) {
          // File might already be deleted, continue
        }
      }
    }
  }

  async getCheckpoints() {
    try {
      await this.ensureDirectories();
      const entries = await fsPromises.readdir(this.snapshotsDir, { withFileTypes: true });
      const checkpoints = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(this.snapshotsDir, entry.name, 'manifest.json');
          try {
            const manifestData = await fsPromises.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestData);
            checkpoints.push(manifest);
          } catch (error) {
            // Skip invalid checkpoints
          }
        }
      }

      return checkpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      return [];
    }
  }

  async cleanupOldCheckpoints() {
    const config = await this.loadConfig();
    const checkpoints = await this.getCheckpoints();
    const toDelete = [];

    // Age-based cleanup (if maxAge > 0)
    if (config.maxAge > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.maxAge);

      for (const checkpoint of checkpoints) {
        const checkpointDate = new Date(checkpoint.timestamp);
        if (checkpointDate < cutoffDate) {
          toDelete.push(checkpoint);
        }
      }
    }

    // Count-based cleanup (keep only maxCheckpoints newest)
    const remainingAfterAge = checkpoints.filter(cp => !toDelete.includes(cp));
    if (remainingAfterAge.length > config.maxCheckpoints) {
      const excessCheckpoints = remainingAfterAge.slice(config.maxCheckpoints);
      toDelete.push(...excessCheckpoints);
    }

    // Delete old checkpoints
    for (const checkpoint of toDelete) {
      const checkpointPath = path.join(this.snapshotsDir, checkpoint.name);
      try {
        await fsPromises.rm(checkpointPath, { recursive: true, force: true });
      } catch (error) {
        // Continue on error
      }
    }
  }

  async cleanupEmptyDirectories() {
    const walkAndClean = async (dir) => {
      try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);
            await walkAndClean(fullPath);

            // Try to remove if empty
            try {
              const remaining = await fsPromises.readdir(fullPath);
              if (remaining.length === 0) {
                await fsPromises.rmdir(fullPath);
              }
            } catch (error) {
              // Directory not empty or other error, continue
            }
          }
        }
      } catch (error) {
        // Can't read directory, continue
      }
    };

    await walkAndClean(this.projectRoot);
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  async logToChangelog(action, description, details = null) {
    try {
      let changelog = [];
      try {
        const changelogData = await fsPromises.readFile(this.changelogFile, 'utf8');
        changelog = JSON.parse(changelogData);
      } catch (error) {
        // File doesn't exist yet, start with empty array
      }

      const entry = {
        timestamp: new Date().toISOString(),
        action,
        description,
        details
      };

      changelog.unshift(entry); // Add to beginning

      // Keep only last 50 entries
      if (changelog.length > 50) {
        changelog = changelog.slice(0, 50);
      }

      await fsPromises.writeFile(this.changelogFile, JSON.stringify(changelog, null, 2));
    } catch (error) {
      // Don't fail the main operation if changelog fails
      console.error('Warning: Could not update changelog:', error.message);
    }
  }

  async getChangelog() {
    try {
      const changelogData = await fsPromises.readFile(this.changelogFile, 'utf8');
      const changelog = JSON.parse(changelogData);

      // Format timestamps for display
      return changelog.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp).toLocaleString()
      }));
    } catch (error) {
      return [];
    }
  }

  // 🎯 NEW: Get files changed since last claudepoint
  async getChangedFilesSinceLastClaudepoint() {
    try {
      const checkpoints = await this.getCheckpoints();
      const currentFiles = await this.getProjectFiles();

      if (checkpoints.length === 0) {
        return {
          hasLastClaudepoint: false,
          added: currentFiles,
          modified: [],
          deleted: [],
          totalChanges: currentFiles.length
        };
      }

      const lastClaudepoint = checkpoints[0];
      const changes = await this.calculateChanges(currentFiles, lastClaudepoint.name);

      return {
        hasLastClaudepoint: true,
        lastClaudepointName: lastClaudepoint.name,
        lastClaudepointDate: new Date(lastClaudepoint.timestamp).toLocaleString(),
        ...changes,
        totalChanges: changes.added.length + changes.modified.length + changes.deleted.length
      };
    } catch (error) {
      return {
        error: error.message,
        hasLastClaudepoint: false,
        added: [],
        modified: [],
        deleted: [],
        totalChanges: 0
      };
    }
  }

  // 🎮 NEW: Interactive configuration management
  async getConfigurationStatus() {
    const config = await this.loadConfig();
    const checkpoints = await this.getCheckpoints();

    return {
      maxClaudepoints: config.maxCheckpoints,
      maxAge: config.maxAge,
      currentClaudepoints: checkpoints.length,
      ignorePatterns: config.ignorePatterns.length + config.additionalIgnores.length,
      autoName: config.autoName,
      configPath: this.configFile
    };
  }

  // 🚀 NEW: Quick undo - restore last claudepoint
  async undoLastClaudepoint() {
    try {
      const checkpoints = await this.getCheckpoints();

      if (checkpoints.length === 0) {
        return {
          success: false,
          error: '🤔 No claudepoints found to undo. Create your first safety net!',
          noClaudepoints: true
        };
      }

      const lastClaudepoint = checkpoints[0];
      return await this.restore(lastClaudepoint.name, false);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔍 NEW: Extract checkpoint file for diff comparison
  async extractCheckpointFile(checkpointName, filePath) {
    try {
      const checkpoints = await this.getCheckpoints();
      const checkpoint = checkpoints.find(cp =>
        cp.name === checkpointName || cp.name.includes(checkpointName)
      );

      if (!checkpoint) {
        throw new Error(`Checkpoint not found: ${checkpointName}`);
      }

      // Create temporary directory for extraction
      const tempDir = path.join(os.tmpdir(), 'claudepoint-diff', checkpoint.name);
      await fsPromises.mkdir(tempDir, { recursive: true });

      if (checkpoint.type === 'FULL' || !checkpoint.type) {
        // Extract specific file from full checkpoint
        const checkpointPath = path.join(this.snapshotsDir, checkpoint.name);
        const tarPath = path.join(checkpointPath, 'files.tar.gz');

        await tar.extract({
          file: tarPath,
          cwd: tempDir,
          filter: (path) => path === filePath
        });

        const extractedFile = path.join(tempDir, filePath);
        if (await this.fileExists(extractedFile)) {
          return extractedFile;
        }
      } else {
        // Handle incremental checkpoint (reconstruct file state)
        await this.reconstructFileFromIncrementalChain(checkpoint, filePath, tempDir);
        const reconstructedFile = path.join(tempDir, filePath);
        if (await this.fileExists(reconstructedFile)) {
          return reconstructedFile;
        }
      }

      // File not found in checkpoint - this means it's a new file
      // Create an empty file for comparison
      const emptyFile = path.join(tempDir, filePath);
      await fsPromises.mkdir(path.dirname(emptyFile), { recursive: true });
      await fsPromises.writeFile(emptyFile, '', 'utf8');
      return emptyFile;
    } catch (error) {
      throw new Error(`Failed to extract checkpoint file: ${error.message}`);
    }
  }

  // 🔧 Helper: Check if file exists
  async fileExists(filePath) {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // 🔄 NEW: Reconstruct file from incremental checkpoint chain
  async reconstructFileFromIncrementalChain(targetCheckpoint, filePath, outputDir) {
    const chain = await this.buildCheckpointChain(targetCheckpoint);

    if (chain.length === 0) {
      throw new Error('No reconstruction chain found');
    }

    // Start with base checkpoint
    const baseCheckpoint = chain[0];
    const baseCheckpointPath = path.join(this.snapshotsDir, baseCheckpoint.name);
    const baseTarPath = path.join(baseCheckpointPath, 'files.tar.gz');

    // Extract base file
    await tar.extract({
      file: baseTarPath,
      cwd: outputDir,
      filter: (path) => path === filePath
    });

    // Check if base file was extracted, if not create empty file
    const baseFile = path.join(outputDir, filePath);
    if (!(await this.fileExists(baseFile))) {
      // File didn't exist in base checkpoint, create empty file
      await fsPromises.mkdir(path.dirname(baseFile), { recursive: true });
      await fsPromises.writeFile(baseFile, '', 'utf8');
    }

    // Apply incremental changes
    for (let i = 1; i < chain.length; i++) {
      const incrementalCheckpoint = chain[i];
      await this.applyIncrementalFileChange(incrementalCheckpoint, filePath, outputDir);
    }
  }

  // 🔄 NEW: Apply incremental file change for specific file
  async applyIncrementalFileChange(checkpoint, filePath, outputDir) {
    const checkpointPath = path.join(this.snapshotsDir, checkpoint.name);
    const changes = checkpoint.changes;

    if (!changes) return;

    const outputFilePath = path.join(outputDir, filePath);

    // Handle added/modified files
    if (changes.added?.includes(filePath)) {
      const srcPath = path.join(checkpointPath, 'added', filePath);
      if (await this.fileExists(srcPath)) {
        await fsPromises.mkdir(path.dirname(outputFilePath), { recursive: true });
        await fsPromises.copyFile(srcPath, outputFilePath);
      }
    } else if (changes.modified?.includes(filePath)) {
      const srcPath = path.join(checkpointPath, 'modified', filePath);
      if (await this.fileExists(srcPath)) {
        await fsPromises.mkdir(path.dirname(outputFilePath), { recursive: true });
        await fsPromises.copyFile(srcPath, outputFilePath);
      }
    } else if (changes.deleted?.includes(filePath)) {
      // File was deleted in this checkpoint
      if (await this.fileExists(outputFilePath)) {
        await fsPromises.unlink(outputFilePath);
      }
    }
  }

  // 🎯 NEW: Open VSCode diff for file comparison
  async openVSCodeDiff(checkpointName, filePath, options = {}) {
    try {
      const { spawn } = await import('child_process');

      // Extract checkpoint version of the file
      const checkpointFilePath = await this.extractCheckpointFile(checkpointName, filePath);
      const currentFilePath = path.join(this.projectRoot, filePath);

      // Check if current file exists
      if (!(await this.fileExists(currentFilePath))) {
        return {
          success: false,
          error: `Current file not found: ${filePath}`,
          suggestion: 'File may have been deleted since checkpoint'
        };
      }

      // Generate diff title
      const checkpoints = await this.getCheckpoints();
      const checkpoint = checkpoints.find(cp =>
        cp.name === checkpointName || cp.name.includes(checkpointName)
      );
      const checkpointDate = checkpoint ? new Date(checkpoint.timestamp).toLocaleString() : 'Unknown';

      const leftTitle = `${filePath} (Checkpoint: ${checkpointName})`;
      const rightTitle = `${filePath} (Current)`;

      // Open VSCode diff
      const vscodeArgs = [
        '--diff',
        checkpointFilePath,
        currentFilePath,
        '--title', `${leftTitle} ↔ ${rightTitle}`
      ];

      if (options.wait) {
        vscodeArgs.push('--wait');
      }

      const vscodeProcess = spawn('code', vscodeArgs, {
        stdio: 'inherit',
        detached: !options.wait
      });

      if (options.wait) {
        return new Promise((resolve) => {
          vscodeProcess.on('close', (code) => {
            resolve({
              success: code === 0,
              checkpointFile: checkpointFilePath,
              currentFile: currentFilePath,
              exitCode: code
            });
          });
        });
      }

      return {
        success: true,
        checkpointFile: checkpointFilePath,
        currentFile: currentFilePath,
        message: `Opened diff in VSCode: ${filePath}`,
        checkpointInfo: {
          name: checkpoint?.name,
          date: checkpointDate,
          description: checkpoint?.description
        }
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'VSCode not found in PATH',
          suggestion: 'Please install VSCode and ensure "code" command is available in your terminal'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔍 NEW: Open VSCode diff for all changed files
  async openVSCodeDiffAll(checkpointName, options = {}) {
    try {
      const checkpoints = await this.getCheckpoints();
      const checkpoint = checkpoints.find(cp =>
        cp.name === checkpointName || cp.name.includes(checkpointName)
      );

      if (!checkpoint) {
        return {
          success: false,
          error: `Checkpoint not found: ${checkpointName}`
        };
      }

      // Get current files and calculate changes
      const currentFiles = await this.getProjectFiles();
      const changes = await this.calculateChanges(currentFiles, checkpoint.name);

      const changedFiles = [...changes.modified, ...changes.added.filter(file =>
        // Only show added files that exist in current state
        currentFiles.includes(file)
      )];

      if (changedFiles.length === 0) {
        return {
          success: false,
          error: 'No changed files to compare',
          noChanges: true
        };
      }

      const results = [];
      const maxFiles = options.maxFiles || 10; // Limit to prevent overwhelming VSCode
      const filesToProcess = changedFiles.slice(0, maxFiles);

      for (const file of filesToProcess) {
        try {
          const result = await this.openVSCodeDiff(checkpoint.name, file, { wait: false });
          results.push({ file, ...result });
        } catch (error) {
          results.push({
            file,
            success: false,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        success: successful > 0,
        processed: filesToProcess.length,
        successful,
        failed,
        skipped: Math.max(0, changedFiles.length - maxFiles),
        results,
        checkpointInfo: {
          name: checkpoint.name,
          date: new Date(checkpoint.timestamp).toLocaleString(),
          description: checkpoint.description
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔍 NEW: Open terminal diff for a single file
  async openTerminalDiff(checkpointName, filePath, options = {}) {
    try {
      const { spawn } = await import('child_process');

      // Extract checkpoint version of the file
      const checkpointFilePath = await this.extractCheckpointFile(checkpointName, filePath);
      const currentFilePath = path.join(this.projectRoot, filePath);

      // Check if current file exists
      if (!(await this.fileExists(currentFilePath))) {
        return {
          success: false,
          error: `Current file not found: ${filePath}`,
          suggestion: 'File may have been deleted since checkpoint'
        };
      }

      const tool = options.tool || 'terminal';
      const unified = options.unified || 3;

      // Select diff command based on tool preference
      let command, args;

      switch (tool) {
        case 'git':
          command = 'git';
          args = ['diff', '--no-index', '--color=always', `--unified=${unified}`, checkpointFilePath, currentFilePath];
          break;
        case 'nvim':
          command = 'nvim';
          args = ['-d', checkpointFilePath, currentFilePath];
          break;
        case 'delta':
          // Use delta as pager for git diff
          command = 'git';
          args = ['diff', '--no-index', '--color=always', `--unified=${unified}`, checkpointFilePath, currentFilePath];
          process.env.PAGER = 'delta';
          break;
        case 'terminal':
        default:
          // Use system diff command
          command = 'diff';
          args = ['--color=auto', `-u${unified}`, checkpointFilePath, currentFilePath];
          break;
      }

      // For nvim, launch and return immediately (non-blocking)
      if (tool === 'nvim') {
        return new Promise((resolve) => {
          const child = spawn(command, args, {
            stdio: 'inherit',
            env: process.env,
            detached: true  // Allow process to run independently
          });

          child.on('error', (error) => {
            // Clean up temp file on error only
            this.deleteTempFile(checkpointFilePath);

            resolve({
              success: false,
              error: `Failed to launch ${tool}: ${error.message}`,
              suggestion: `Make sure ${command} is installed and in your PATH`
            });
          });

          // Return immediately for nvim
          setTimeout(() => {
            resolve({
              success: true,
              file: filePath,
              tool: tool,
              launched: true,
              note: 'nvim launched in background - temp file will be cleaned up when nvim exits'
            });
          }, 100);

          // Clean up temp file when nvim actually closes (but don't wait)
          child.on('close', () => {
            this.deleteTempFile(checkpointFilePath);
          });
        });
      }

      // For other tools, wait for completion
      return new Promise((resolve) => {
        const child = spawn(command, args, {
          stdio: 'inherit',
          env: process.env
        });

        child.on('close', (code) => {
          // Clean up temp file
          this.deleteTempFile(checkpointFilePath);

          resolve({
            success: true,
            file: filePath,
            tool: tool,
            exitCode: code
          });
        });

        child.on('error', (error) => {
          // Clean up temp file
          this.deleteTempFile(checkpointFilePath);

          resolve({
            success: false,
            error: `Failed to launch ${tool}: ${error.message}`,
            suggestion: `Make sure ${command} is installed and in your PATH`
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔍 NEW: Open terminal diff for all changed files
  async openTerminalDiffAll(checkpointName, options = {}) {
    try {
      const checkpoints = await this.getCheckpoints();
      const checkpoint = checkpoints.find(cp =>
        cp.name === checkpointName || cp.name.includes(checkpointName)
      );

      if (!checkpoint) {
        return {
          success: false,
          error: `Checkpoint not found: ${checkpointName}`
        };
      }

      // Get current files and calculate changes
      const currentFiles = await this.getProjectFiles();
      const changes = await this.calculateChanges(currentFiles, checkpoint.name);

      const changedFiles = [...changes.modified, ...changes.added.filter(file =>
        // Only show added files that exist in current state
        currentFiles.includes(file)
      )];

      if (changedFiles.length === 0) {
        return {
          success: false,
          error: 'No changed files to compare',
          noChanges: true
        };
      }

      const tool = options.tool || 'terminal';
      const maxFiles = options.maxFiles || 10;
      const filesToProcess = changedFiles.slice(0, maxFiles);

      // For nvim, open all files in one session
      if (tool === 'nvim') {
        return await this.openNvimDiffAll(checkpoint.name, filesToProcess);
      }

      // For other tools, show diff for each file sequentially
      const results = [];

      console.log(`\n📍 Checkpoint: ${checkpoint.name}`);
      console.log(`📅 Date: ${new Date(checkpoint.timestamp).toLocaleString()}`);
      console.log(`📝 Description: ${checkpoint.description || 'No description'}`);
      console.log(`🔍 Tool: ${tool}\n`);

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        console.log(`\n📄 File ${i + 1}/${filesToProcess.length}: ${file}`);
        console.log('─'.repeat(60));

        try {
          const result = await this.openTerminalDiff(checkpoint.name, file, {
            tool,
            unified: options.unified
          });
          results.push({ file, ...result });

          // Add separator between files
          if (i < filesToProcess.length - 1) {
            console.log('\n' + '═'.repeat(60) + '\n');
          }
        } catch (error) {
          results.push({
            file,
            success: false,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        success: successful > 0,
        processed: filesToProcess.length,
        successful,
        failed,
        skipped: Math.max(0, changedFiles.length - maxFiles),
        results,
        checkpointInfo: {
          name: checkpoint.name,
          date: new Date(checkpoint.timestamp).toLocaleString(),
          description: checkpoint.description,
          tool: tool
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔍 Helper: Open multiple files in nvim diff mode
  async openNvimDiffAll(checkpointName, files) {
    try {
      const { spawn } = await import('child_process');

      // Extract all checkpoint files
      const tempFiles = [];
      const nvimArgs = ['-d']; // Start nvim in diff mode

      for (const file of files) {
        const checkpointFilePath = await this.extractCheckpointFile(checkpointName, file);
        const currentFilePath = path.join(this.projectRoot, file);

        tempFiles.push(checkpointFilePath);

        // Add both checkpoint and current file for each file
        nvimArgs.push(checkpointFilePath);
        nvimArgs.push(currentFilePath);
      }

      return new Promise((resolve) => {
        const child = spawn('nvim', nvimArgs, {
          stdio: 'inherit'
        });

        child.on('close', (code) => {
          // Clean up temp files
          tempFiles.forEach(file => this.deleteTempFile(file));

          resolve({
            success: true,
            processed: files.length,
            tool: 'nvim',
            exitCode: code
          });
        });

        child.on('error', (error) => {
          // Clean up temp files
          tempFiles.forEach(file => this.deleteTempFile(file));

          resolve({
            success: false,
            error: `Failed to launch nvim: ${error.message}`,
            suggestion: 'Make sure nvim is installed and in your PATH'
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 🔍 Helper: Delete temporary files
  deleteTempFile(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Warning: Could not clean up temp file: ${filePath}`);
    }
  }
}

export default CheckpointManager;
