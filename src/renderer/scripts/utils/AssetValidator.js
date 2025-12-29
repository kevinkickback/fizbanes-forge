// AssetValidator.js
// Checks for required assets and logs or notifies if missing

const REQUIRED_ASSETS = [
	'assets/bootstrap/dist/css/bootstrap.min.css',
	'assets/fontawesome/css/all.min.css',
	'assets/fontawesome/webfonts/fa-solid-900.woff2',
];

export function validateAssets() {
	const missing = [];
	REQUIRED_ASSETS.forEach((relPath) => {
		const url = relPath;
		const req = new XMLHttpRequest();
		req.open('HEAD', url, false); // synchronous for startup check
		req.send();
		if (req.status !== 200) {
			missing.push(relPath);
		}
	});
	if (missing.length > 0) {
		console.warn('Missing required assets:', missing);
		if (window.FF_DEBUG) {
			alert(`Missing required assets: ${missing.join(', ')}`);
		}
	}
	return missing;
}
