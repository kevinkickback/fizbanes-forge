import { produce, setAutoFreeze } from 'immer';
import { eventBus, EVENTS } from '../lib/EventBus.js';

setAutoFreeze(false);

class AppStateImpl {
	constructor() {
		this.state = {
			isLoading: false,
			currentPage: 'home',
			isLoadingCharacter: false,
			isNavigating: false,
			failedServices: [],
			currentCharacter: null,
			characters: [],
			hasUnsavedChanges: false,
			loadedData: {
				classes: null,
				races: null,
				backgrounds: null,
				spells: null,
				equipment: null,
				feats: null,
			},
		};

		console.debug('AppState', 'Initialized');
	}

	getState() {
		return this.state;
	}

	get(key) {
		const keys = key.split('.');
		let value = this.state;

		for (const k of keys) {
			value = value?.[k];
		}

		return value;
	}

	setState(updates) {
		const oldState = this.state;

		this.state = produce(this.state, (draft) => {
			Object.assign(draft, updates);
		});

		eventBus.emit(EVENTS.STATE_CHANGED, this.state, oldState);

		Object.keys(updates).forEach((key) => {
			if (oldState[key] !== this.state[key]) {
				const eventName = `state:${key}:changed`;
				eventBus.emit(eventName, this.state[key], oldState[key]);
			}
		});
	}

	setCurrentCharacter(character, options = {}) {
		console.debug('AppState', 'Setting current character:', character?.id);
		this.setState({ currentCharacter: character });
		if (!options.skipEvent) {
			eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
		}
	}

	getCurrentCharacter() {
		return this.state.currentCharacter;
	}

	setHasUnsavedChanges(hasChanges) {
		if (this.state.hasUnsavedChanges !== hasChanges) {
			this.setState({ hasUnsavedChanges: hasChanges });
		}
	}

	setCurrentPage(page) {
		this.setState({ currentPage: page });
		eventBus.emit(EVENTS.PAGE_CHANGED, page);
	}

	getCurrentPage() {
		return this.state.currentPage;
	}

	setLoading(loading) {
		this.setState({ isLoading: loading });
	}

	setFailedServices(services) {
		const normalized = Array.isArray(services) ? [...services] : [];
		this.setState({ failedServices: normalized });
	}

	getFailedServices() {
		return this.state.failedServices || [];
	}

	setCharacters(characters) {
		this.setState({ characters });
	}

	getCharacters() {
		return this.state.characters;
	}

	setLoadedData(dataType, data) {
		this.setState({
			loadedData: {
				...this.state.loadedData,
				[dataType]: data,
			},
		});
		eventBus.emit(EVENTS.DATA_LOADED, dataType, data);
	}

	getLoadedData(dataType) {
		return this.state.loadedData[dataType];
	}

	clear() {
		console.warn('AppState', 'Clearing all state');
		const initialState = new AppStateImpl().state;
		this.state = initialState;
		eventBus.emit(EVENTS.STATE_CHANGED, this.state, {});
	}
}

export const AppState = new AppStateImpl();
