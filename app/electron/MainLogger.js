/**
 * Simple logger adapter for main process.
 * Provides consistent logging methods and honors DEBUG environment.
 */
const util = require('node:util');

const isDebug = process.env.FF_DEBUG === 'true' || false;

function formatMessage(prefix, ...args) {
	const message = args
		.map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 3 })))
		.join(' ');
	const ts = new Date().toISOString();
	return `${ts} ${prefix} ${message}`;
}

const MainLogger = {
	info(prefix, ...args) {
		console.log(formatMessage(`[${prefix}]`, ...args));
	},
	warn(prefix, ...args) {
		console.warn(formatMessage(`[${prefix}]`, ...args));
	},
	error(prefix, ...args) {
		console.error(formatMessage(`[${prefix}]`, ...args));
	},
	debug(prefix, ...args) {
		if (isDebug) {
			console.debug(formatMessage(`[${prefix}]`, ...args));
		}
	},
};

module.exports = { MainLogger };
