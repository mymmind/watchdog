/**
 * Safe command execution wrapper to prevent command injection
 * Only whitelisted commands are allowed, and all arguments are sanitized
 */

import { execSync } from 'child_process';
import logger from './logger.js';

// Whitelist of allowed commands
const ALLOWED_COMMANDS = [
  'docker',
  'pm2',
  'systemctl',
  'df',
  'free',
  'top',
  'redis-cli',
  'pg_isready',
];

/**
 * Safely execute a shell command with argument validation
 * @param {string} command - Command name (must be whitelisted)
 * @param {string[]} args - Arguments (will be sanitized)
 * @param {Object} options - exec options
 * @returns {string} - Command output (trimmed)
 * @throws {Error} - If command is not allowed or args are unsafe
 */
export function safeExec(command, args = [], options = {}) {
  // Validate command is whitelisted
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }

  // Sanitize arguments - reject anything with command injection attempts
  const sanitizedArgs = args.map((arg) => {
    if (typeof arg !== 'string') {
      throw new Error('All arguments must be strings');
    }
    // Reject args with shell metacharacters that could cause injection
    if (/[;&|`$()]/.test(arg)) {
      throw new Error(`Potentially unsafe argument: ${arg}`);
    }
    return arg;
  });

  const fullCommand = [command, ...sanitizedArgs].join(' ');

  try {
    logger.debug(`Executing: ${fullCommand}`);
    const result = execSync(fullCommand, {
      encoding: 'utf8',
      timeout: options.timeout || 10000,
      maxBuffer: options.maxBuffer || 1024 * 1024, // 1MB
      stdio: ['pipe', 'pipe', 'pipe'], // Capture stdout, stderr
      ...options,
    });
    return result.trim();
  } catch (error) {
    logger.error(`Command failed: ${fullCommand}`, {
      error: error.message,
      code: error.code,
    });
    throw error;
  }
}

/**
 * Execute command and return true if successful, false if failed
 * Useful for existence checks and availability tests
 * @param {string} command - Command name
 * @param {string[]} args - Arguments
 * @param {Object} options - exec options
 * @returns {boolean} - True if command succeeded, false otherwise
 */
export function safeExecBool(command, args = [], options = {}) {
  try {
    safeExec(command, args, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute command and parse JSON output
 * @param {string} command - Command name
 * @param {string[]} args - Arguments
 * @param {Object} options - exec options
 * @returns {Object|Array} - Parsed JSON output
 * @throws {Error} - If command fails or output is not valid JSON
 */
export function safeExecJSON(command, args = [], options = {}) {
  const output = safeExec(command, args, options);
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to parse JSON output from ${command}: ${error.message}`);
  }
}
