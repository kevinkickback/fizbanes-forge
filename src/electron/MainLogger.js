/** Simple logger adapter for main process (honors FF_DEBUG). */
import util from 'node:util';

const isDebug = process.env.FF_DEBUG === 'true' || false;

function formatMessage(prefix, ...args) {
	const message = args
		.map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 3 })))
		.join(' ');
	const ts = new Date().toISOString();
	return `${ts} ${prefix} ${message}`;
}

export const MainLogger = {
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
