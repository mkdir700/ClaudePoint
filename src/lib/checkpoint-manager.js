import fs from 'fs';
import path from 'path';
import tar from 'tar';
import ignore from 'ignore';
import crypto from 'crypto';

const { promises: fsPromises } = fs;

class CheckpointManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.checkpointDir = path.join(this.projectRoot, '.checkpoints');
    this.snapshotsDir = path.join(this.checkpointDir, 'snapshots');
    this.configFile = path.join(this.checkpointDir, 'config.json');
    this.changelogFile = path.join(this.checkpointDir, 'changelog.json');
    this.hooksConfigFile = path.join(this.checkpointDir, 'hooks.json');
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
        '.git', '.checkpoints', 'node_modules', '.env', '.env.*',
        '*.log', '.DS_Store', 'Thumbs.db', '__pycache__', '*.pyc',
        '.vscode', '.idea', 'dist', 'build', 'coverage', '.nyc_output',
        '.next', '.nuxt', '.cache', 'tmp', 'temp'
      ],
      additionalIgnores: [],
      forceInclude: [],
      nameTemplate: 'checkpoint_{timestamp}',
      // Incremental checkpoint settings
      incremental: {
        enabled: true,
        fullSnapshotInterval: 5, // Create full snapshot every N incremental checkpoints
        maxChainLength: 20 // Maximum incremental chain before forcing full snapshot
      }
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
    
    async function walkDir(dir) {
      try {
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

  async shouldCreateFullCheckpoint(changes) {
    const config = await this.loadConfig();
    
    if (!config.incremental.enabled) {
      return true;
    }
    
    const checkpoints = await this.getCheckpoints();
    const incrementalCheckpoints = checkpoints.filter(cp => 
      cp.type === 'INCREMENTAL' || cp.type === 'INC'
    );
    
    // Create full checkpoint if:
    // 1. This is the first checkpoint
    // 2. We've reached the full snapshot interval
    // 3. We've reached the max chain length
    // 4. There are too many changes (more than 50% of files)
    const shouldCreateFull = (
      checkpoints.length === 0 ||
      incrementalCheckpoints.length >= config.incremental.fullSnapshotInterval ||
      incrementalCheckpoints.length >= config.incremental.maxChainLength ||
      (changes.added.length + changes.modified.length + changes.deleted.length) > (checkpoints[0]?.fileCount || 0) * 0.5
    );
    
    return shouldCreateFull;
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
        const gitignoreEntry = '.checkpoints/';
        
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

  async create(name, description, forceFullCheckpoint = false) {
    try {
      await this.ensureDirectories();
      const files = await this.getProjectFiles();
      
      if (files.length === 0) {
        return {
          success: false,
          error: 'No files found to checkpoint'
        };
      }

      // Get the last checkpoint for comparison
      const checkpoints = await this.getCheckpoints();
      const lastCheckpoint = checkpoints.length > 0 ? checkpoints[0] : null;
      
      // Calculate file changes
      const changes = await this.calculateChanges(files, lastCheckpoint?.name);
      
      // Check if there are any actual changes for incremental checkpoints
      const hasChanges = changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0;
      
      if (!forceFullCheckpoint && !hasChanges && lastCheckpoint) {
        return {
          success: false,
          error: 'No changes detected since last checkpoint',
          noChanges: true
        };
      }
      
      // Determine checkpoint type
      const shouldCreateFull = forceFullCheckpoint || await this.shouldCreateFullCheckpoint(changes);
      const checkpointType = shouldCreateFull ? 'FULL' : 'INCREMENTAL';
      
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

      // Add incremental-specific metadata
      if (checkpointType === 'INCREMENTAL') {
        manifest.baseCheckpoint = lastCheckpoint?.name;
        manifest.changes = changes;
        manifest.statistics = {
          filesChanged: changes.added.length + changes.modified.length + changes.deleted.length,
          bytesAdded: 0, // Will be calculated during storage
          bytesModified: 0,
          compressionRatio: 0
        };
      }

      await fsPromises.writeFile(
        path.join(checkpointPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      if (checkpointType === 'FULL') {
        // Create full tarball (existing behavior)
        const tarPath = path.join(checkpointPath, 'files.tar.gz');
        await tar.create(
          {
            gzip: true,
            file: tarPath,
            cwd: this.projectRoot
          },
          files
        );
      } else {
        // Create incremental checkpoint structure
        await this.createIncrementalCheckpoint(checkpointPath, changes, manifest);
      }

      // Cleanup old checkpoints
      await this.cleanupOldCheckpoints();
      
      // Log to changelog
      const logMessage = `Created ${checkpointType.toLowerCase()} checkpoint: ${checkpointName}`;
      await this.logToChangelog('CREATE_CHECKPOINT', logMessage, manifest.description);
      
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
      await this.logToChangelog('RESTORE_CHECKPOINT', `Restored ${checkpoint.type || 'FULL'} checkpoint: ${checkpoint.name}`, `Emergency backup: ${emergencyName}`);

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
    
    if (checkpoints.length > config.maxCheckpoints) {
      const toDelete = checkpoints.slice(config.maxCheckpoints);
      for (const checkpoint of toDelete) {
        const checkpointPath = path.join(this.snapshotsDir, checkpoint.name);
        try {
          await fsPromises.rm(checkpointPath, { recursive: true, force: true });
        } catch (error) {
          // Continue on error
        }
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
}

export default CheckpointManager;