const fs = require('node:fs');
const path = require('node:path');

// Source paths from node_modules
const sources = [
	{
		from: 'node_modules/bootstrap/dist',
		to: 'src/ui/assets/bootstrap/dist',
	},
	{
		from: 'node_modules/@fortawesome/fontawesome-free',
		to: 'src/ui/assets/fontawesome',
	},
];

console.log(' Setting up third-party assets...');

sources.forEach(({ from, to }) => {
	const fromPath = path.join(__dirname, from);
	const toPath = path.join(__dirname, to);

	if (fs.existsSync(fromPath)) {
		// Create destination directory
		fs.mkdirSync(path.dirname(toPath), { recursive: true });

		// Copy directory recursively
		console.log('Copying:', from, '->', to);
		fs.cpSync(fromPath, toPath, { recursive: true });
	} else {
		console.warn('  Source not found:', from);
	}
});

console.log(' Asset setup complete!');
