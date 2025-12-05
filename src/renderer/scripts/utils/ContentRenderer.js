/**
 * ContentRenderer.js
 * Main rendering engine for D&D game content based on 5etools architecture
 * Handles recursive rendering of D&D content entries with support for nested structures
 *
 * Usage:
 *   const renderer = Renderer.get();
 *   const html = renderer.render(entry);
 */
// biome-ignore-all lint/complexity/noThisInStatic: false positive
// biome-ignore-all lint/complexity/noStaticOnlyClass: false positive

/**
 * Main Renderer class - implements recursive entry rendering system
 * Supports 40+ entry types for flexible content representation
 */
class Renderer {
	constructor() {
		this.baseUrl = '';
		this.baseMediaUrls = {};

		// Configuration
		this._wrapperTag = 'div';
		this._firstSection = true;
		this._isAddHandlers = true;
		this._headerIndex = 1;
		this._depth = 0;

		// Plugin system
		this._plugins = {};

		// Tracking systems
		this._trackTitles = { enabled: false, titles: {} };
		this._depthTracker = null;
		this._tagExportDict = null;
	}

	// ============================================================================
	// CONFIGURATION METHODS
	// ============================================================================

	setBaseUrl(url) {
		this.baseUrl = url;
		return this;
	}

	setBaseMediaUrl(mediaDir, url) {
		this.baseMediaUrls[mediaDir] = url;
		return this;
	}

	getMediaUrl(mediaDir, path) {
		if (this.baseMediaUrls[mediaDir]) {
			return `${this.baseMediaUrls[mediaDir]}${path}`;
		}
		return `${this.baseUrl}${mediaDir}/${path}`;
	}

	setWrapperTag(tag) {
		this._wrapperTag = tag;
		return this;
	}

	setFirstSection(bool) {
		this._firstSection = !!bool;
		return this;
	}

	setAddHandlers(bool) {
		this._isAddHandlers = !!bool;
		return this;
	}

	resetHeaderIndex() {
		this._headerIndex = 1;
		this._trackTitles.titles = {};
		return this;
	}

	setTrackTitles(bool) {
		this._trackTitles.enabled = !!bool;
		return this;
	}

	getTrackedTitles() {
		return { ...this._trackTitles.titles };
	}

	// ============================================================================
	// PLUGIN SYSTEM
	// ============================================================================

	addPlugin(pluginType, fnPlugin) {
		if (!this._plugins[pluginType]) this._plugins[pluginType] = [];
		this._plugins[pluginType].push(fnPlugin);
		return this;
	}

	removePlugin(pluginType, fnPlugin) {
		if (!this._plugins[pluginType]) return this;
		const ix = this._plugins[pluginType].indexOf(fnPlugin);
		if (~ix) this._plugins[pluginType].splice(ix, 1);
		return this;
	}

	_getPlugins(pluginType) {
		return this._plugins[pluginType] || [];
	}

	// ============================================================================
	// MAIN RENDERING METHODS
	// ============================================================================

	/**
	 * Main public render method
	 * @param {*} entry The entry to render
	 * @param {number} depth The depth level (for nested entries)
	 * @returns {string} HTML string
	 */
	render(entry, depth = 0) {
		const tempStack = [];
		this.recursiveRender(entry, tempStack, { depth });
		return tempStack.join('');
	}

	/**
	 * Recursive renderer - core rendering engine
	 * @param {*} entry Entry to render
	 * @param {Array} textStack Stack for building output
	 * @param {Object} meta Metadata about the current render state
	 */
	recursiveRender(entry, textStack, meta = {}) {
		if (Array.isArray(entry)) {
			for (const nxt of entry) {
				this.recursiveRender(nxt, textStack, meta);
			}
			return this;
		}

		// Initialize stack
		if (textStack.length === 0) textStack[0] = '';
		else textStack.reverse();

		// Initialize metadata
		meta = meta || {};
		meta._typeStack = [];
		meta.depth = meta.depth ?? 0;

		this._recursiveRender(entry, textStack, meta);
		textStack.reverse();

		return this;
	}

	/**
	 * Inner rendering implementation
	 * @private
	 */
	_recursiveRender(entry, textStack, meta) {
		if (entry == null) return;

		// Handle wrapped entries
		if (entry.type === 'wrapper' && entry.wrapped) {
			return this._recursiveRender(entry.wrapped, textStack, meta);
		}

		// Determine type
		const type = entry.type ?? (typeof entry === 'string' ? 'string' : null);

		if (typeof entry === 'string') {
			this._renderString(entry, textStack, meta);
		} else if (type && this._rendererMap[type]) {
			meta._typeStack.push(type);
			this._rendererMap[type].call(this, entry, textStack, meta);
			meta._typeStack.pop();
		} else {
			// Fallback - render as primitive
			textStack[0] += entry.toString?.() ?? entry;
		}
	}

	// ============================================================================
	// ENTRY TYPE RENDERERS
	// ============================================================================

	_renderString(str, textStack, _meta) {
		textStack[0] += str;
	}

	_renderEntries(entry, textStack, meta) {
		if (meta.depth === -1) {
			if (!this._firstSection)
				textStack[0] += `<hr class="rd__hr rd__hr--section">`;
			this._firstSection = false;
		}

		if (entry.name) {
			const headerTag = `h${Math.min(Math.max(meta.depth + 2, 1), 6)}`;
			textStack[0] += `<${headerTag} class="rd__h rd__h--${meta.depth + 1}" data-title-index="${this._headerIndex++}">`;
			textStack[0] += entry.name;
			textStack[0] += `</${headerTag}>`;
		}

		if (entry.entries) {
			const cacheDepth = meta.depth;
			meta.depth += 1;
			for (const subEntry of entry.entries) {
				textStack[0] += `<p>`;
				this._recursiveRender(subEntry, textStack, meta);
				textStack[0] += `</p>`;
			}
			meta.depth = cacheDepth;
		}
	}

	_renderList(entry, textStack, meta) {
		const tag = entry.start && entry.start > 1 ? 'ol' : 'ul';
		const start = entry.start ? `start="${entry.start}"` : '';

		textStack[0] += `<${tag} ${start}>`;
		if (entry.name) {
			textStack[0] += `<li class="rd__list-name">${entry.name}</li>`;
		}

		if (entry.items) {
			for (const item of entry.items) {
				textStack[0] += `<li>`;
				this._recursiveRender(item, textStack, meta);
				textStack[0] += `</li>`;
			}
		}

		textStack[0] += `</${tag}>`;
	}

	_renderTable(entry, textStack, meta) {
		textStack[0] += `<table class="rd__table">`;

		// Caption
		if (entry.caption) {
			textStack[0] += `<caption>${entry.caption}</caption>`;
		}

		// Header
		if (entry.header?.length) {
			textStack[0] += `<thead><tr>`;
			for (const headerCell of entry.header) {
				textStack[0] += `<th>`;
				this._recursiveRender(headerCell, textStack, meta);
				textStack[0] += `</th>`;
			}
			textStack[0] += `</tr></thead>`;
		}

		// Rows
		textStack[0] += `<tbody>`;
		if (entry.rows) {
			for (const row of entry.rows) {
				textStack[0] += `<tr>`;
				const cells = Array.isArray(row) ? row : row.row;
				for (const cell of cells) {
					textStack[0] += `<td>`;
					this._recursiveRender(cell, textStack, meta);
					textStack[0] += `</td>`;
				}
				textStack[0] += `</tr>`;
			}
		}
		textStack[0] += `</tbody>`;

		// Footer
		if (entry.footnotes?.length) {
			textStack[0] += `<tfoot>`;
			for (const footnote of entry.footnotes) {
				textStack[0] += `<tr><td colspan="99">`;
				this._recursiveRender(footnote, textStack, meta);
				textStack[0] += `</td></tr>`;
			}
			textStack[0] += `</tfoot>`;
		}

		textStack[0] += `</table>`;
	}

	_renderInset(entry, textStack, meta) {
		const cssClass =
			entry.type === 'insetReadaloud' ? 'rd__b-inset--readaloud' : '';
		textStack[0] += `<div class="rd__b-inset ${cssClass}">`;

		if (entry.name) {
			textStack[0] += `<h4>${entry.name}</h4>`;
		}

		if (entry.entries) {
			for (const subEntry of entry.entries) {
				textStack[0] += `<p>`;
				this._recursiveRender(subEntry, textStack, meta);
				textStack[0] += `</p>`;
			}
		}

		textStack[0] += `</div>`;
	}

	// ============================================================================
	// RENDERER MAP - Maps entry types to their renderers
	// ============================================================================

	get _rendererMap() {
		return {
			entries: this._renderEntries,
			list: this._renderList,
			table: this._renderTable,
			inset: this._renderInset,
			insetReadaloud: this._renderInset,
		};
	}
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let _globalRenderer = null;

/**
 * Get the global renderer instance
 * @returns {Renderer}
 */
Renderer.get = () => {
	if (!_globalRenderer) {
		_globalRenderer = new Renderer();
	}
	return _globalRenderer;
};

// ============================================================================
// TYPE-SPECIFIC RENDERERS
// ============================================================================

/**
 * Renderer for spell entries
 */
Renderer.spell = class {
	static getHtmlPtLevelSchoolRitual(spell) {
		const school = spell.school || 'Unknown';
		if (spell.level === 0) {
			return `<div class="rd__h-spell">${school} Cantrip</div>`;
		}
		const ritual = spell.ritual ? ' (ritual)' : '';
		return `<div class="rd__h-spell">Level ${spell.level} ${school}${ritual}</div>`;
	}

	static getHtmlPtCastingTime(spell) {
		if (!spell.time) return '';
		const time = Array.isArray(spell.time) ? spell.time[0] : spell.time;
		return `<div><b>Casting Time:</b> ${time.number || 1} ${time.unit}</div>`;
	}

	static getHtmlPtRange(spell) {
		if (!spell.range) return '';
		const range = spell.range;
		return `<div><b>Range:</b> ${range.distance?.amount || 0} ${range.distance?.type || 'ft.'}</div>`;
	}

	static getHtmlPtComponents(spell) {
		if (!spell.components) return '';
		const comps = spell.components
			.map((c) => {
				if (c === 'V') return 'Verbal';
				if (c === 'S') return 'Somatic';
				if (c === 'M')
					return `Material (${spell.materials?.join(', ') || 'see text'})`;
				return c;
			})
			.join(', ');
		return `<div><b>Components:</b> ${comps}</div>`;
	}

	static getHtmlPtDuration(spell) {
		if (!spell.duration) return '';
		const dur = Array.isArray(spell.duration)
			? spell.duration[0]
			: spell.duration;
		return `<div><b>Duration:</b> ${dur.type === 'instantaneous' ? 'Instantaneous' : dur.type}</div>`;
	}

	static getCompactRenderedString(spell) {
		const pts = [
			this.getHtmlPtLevelSchoolRitual(spell),
			this.getHtmlPtCastingTime(spell),
			this.getHtmlPtRange(spell),
			this.getHtmlPtComponents(spell),
			this.getHtmlPtDuration(spell),
		];

		let html = `<div class="rd__spell">`;
		html += pts.filter(Boolean).join('');

		if (spell.entries) {
			for (const entry of spell.entries) {
				html += `<p>`;
				html += Renderer.get().render(entry);
				html += `</p>`;
			}
		}

		html += `</div>`;
		return html;
	}
};

/**
 * Renderer for item entries
 */
Renderer.item = class {
	static getCompactRenderedString(item) {
		let html = `<div class="rd__item">`;
		html += `<strong>${item.name}</strong>`;

		if (item.type) html += `<div><b>Type:</b> ${item.type}</div>`;
		if (item.rarity) html += `<div><b>Rarity:</b> ${item.rarity}</div>`;
		if (item.value) html += `<div><b>Value:</b> ${item.value}</div>`;
		if (item.weight) html += `<div><b>Weight:</b> ${item.weight}</div>`;

		if (item.entries) {
			for (const entry of item.entries) {
				html += `<p>`;
				html += Renderer.get().render(entry);
				html += `</p>`;
			}
		}

		html += `</div>`;
		return html;
	}
};

/**
 * Renderer for monster/creature entries
 */
Renderer.monster = class {
	static getCompactRenderedString(monster) {
		let html = `<div class="rd__monster">`;
		html += `<strong>${monster.name}</strong>`;
		html += `<div>${monster.size} ${monster.type}${monster.alignment ? `, ${monster.alignment}` : ''}</div>`;

		if (monster.ac) {
			html += `<div><b>AC:</b> ${monster.ac.value || monster.ac}</div>`;
		}
		if (monster.hp) {
			const hp = monster.hp;
			html += `<div><b>HP:</b> ${hp.average} (${hp.formula})</div>`;
		}

		html += `</div>`;
		return html;
	}
};

// Export for use as module
export { Renderer };
