/**
 * Centralized logging system with configurable log levels.
 *
 * ARCHITECTURE: Infrastructure Layer - No dependencies on other app code
 *
 * PURPOSE:
 * - Replaces all console.log statements
 * - Provides filterable log levels (DEBUG, INFO, WARN, ERROR)
 * - Stores log history for debugging
 * - Consistent format across entire application
 *
 * USAGE EXAMPLES:
 *   import { Logger } from '../infrastructure/Logger.js';
 *
 *   Logger.debug('ComponentName', 'Detailed diagnostic info', { data });
 *   Logger.info('ComponentName', 'General informational message');
 *   Logger.warn('ComponentName', 'Warning message', { context });
 *   Logger.error('ComponentName', 'Error occurred', error);
 *
 * CONFIGURATION:
 *   Logger.setLevel('DEBUG')  // Show all logs
 *   Logger.setLevel('INFO')   // Show INFO, WARN, ERROR (default)
 *   Logger.setLevel('WARN')   // Show WARN, ERROR only
 *   Logger.setLevel('ERROR')  // Show ERROR only
 *   Logger.setEnabled(false)  // Disable all logging
 *
 * LOG HISTORY:
 *   const history = Logger.getHistory();           // Get all logs
 *   const errors = Logger.getHistory('ERROR');     // Get only errors
 *   Logger.clearHistory();                         // Clear log history
 *
 * @module infrastructure/Logger
 */

export const LOG_LEVELS = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
};

class LoggerImpl {
	constructor() {
		this.currentLevel = LOG_LEVELS.INFO;
		this.enabled = true;
		this.history = [];
		this.maxHistorySize = 1000;
	}

	setLevel(level) {
		const upperLevel = level.toUpperCase();
		if (Object.hasOwn(LOG_LEVELS, upperLevel)) {
			this.currentLevel = LOG_LEVELS[upperLevel];
		} else {
			console.warn(`[Logger] Invalid log level: ${level}. Using INFO.`);
			this.currentLevel = LOG_LEVELS.INFO;
		}
	}

	getLevel() {
		return Object.keys(LOG_LEVELS).find(
			(key) => LOG_LEVELS[key] === this.currentLevel,
		);
	}

	setEnabled(enabled) {
		this.enabled = enabled;
	}

	shouldLog(level) {
		return this.enabled && level >= this.currentLevel;
	}

	formatLog(level, category, message, data) {
		return {
			timestamp: new Date().toISOString(),
			level,
			category,
			message,
			data,
		};
	}

	addToHistory(logEntry) {
		this.history.push(logEntry);
		if (this.history.length > this.maxHistorySize) {
			this.history.shift();
		}
	}

	getHistory(filterLevel) {
		if (!filterLevel) {
			return [...this.history];
		}
		return this.history.filter((entry) => entry.level === filterLevel);
	}

	clearHistory() {
		this.history = [];
	}

	debug(category, message, data = null) {
		if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;

		const logEntry = this.formatLog('DEBUG', category, message, data);
		this.addToHistory(logEntry);

		console.debug(
			`[DEBUG] [${category}] ${message}`,
			data !== null ? data : '',
		);
	}

	info(category, message, data = null) {
		if (!this.shouldLog(LOG_LEVELS.INFO)) return;

		const logEntry = this.formatLog('INFO', category, message, data);
		this.addToHistory(logEntry);

		console.info(`[INFO] [${category}] ${message}`, data !== null ? data : '');
	}

	warn(category, message, data = null) {
		if (!this.shouldLog(LOG_LEVELS.WARN)) return;

		const logEntry = this.formatLog('WARN', category, message, data);
		this.addToHistory(logEntry);

		console.warn(`[WARN] [${category}] ${message}`, data !== null ? data : '');
	}

	error(category, message, error = null) {
		if (!this.shouldLog(LOG_LEVELS.ERROR)) return;

		const logEntry = this.formatLog('ERROR', category, message, error);
		this.addToHistory(logEntry);

		console.error(
			`[ERROR] [${category}] ${message}`,
			error !== null ? error : '',
		);
	}
}

export const Logger = new LoggerImpl();
