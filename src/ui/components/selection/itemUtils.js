// Shared helpers for equipment/item selection modals

export function buildItemId(item) {
	const name = (item?.name || '').toLowerCase();
	const source = (item?.source || 'PHB').toLowerCase();
	return `${name}|${source}`;
}

export function getItemTypeCodes(item) {
	const types = new Set();

	const addType = (val) => {
		if (!val) return;
		const normalized = String(val).split('|')[0].toUpperCase();
		if (normalized) types.add(normalized);
	};

	if (Array.isArray(item?.type)) {
		item.type.forEach(addType);
	} else {
		addType(item?.type);
	}

	if (item?.weaponCategory) types.add('W');
	if (item?.staff) types.add('ST');
	if (item?.wand) types.add('WD');
	if (item?.ring) types.add('RG');
	if (item?.rod) types.add('RD');
	if (item?.scroll) types.add('SC');
	return Array.from(types);
}

export function requiresAttunement(item) {
	if (!item) return false;
	const { reqAttune, reqAttuneAlt, requiresAttunement, reqAttuneTags } = item;
	if (reqAttune || reqAttuneAlt || requiresAttunement) return true;
	if (Array.isArray(reqAttuneTags) && reqAttuneTags.length > 0) return true;
	return false;
}

export function getItemTypeName(typeCode) {
	const types = {
		W: 'Weapon',
		A: 'Armor',
		G: 'Adventuring Gear',
		P: 'Potion',
		SC: 'Scroll',
		RG: 'Ring',
		RD: 'Rod',
		ST: 'Staff',
		WD: 'Wand',
		$: 'Treasure',
		TAH: 'Tack and Harness',
		TG: 'Trade Good',
		VEH: 'Vehicle',
	};
	return types[typeCode] || 'Item';
}

export function getItemCostInGold(item) {
	if (typeof item?.value === 'number') {
		return item.value / 100;
	}

	if (item?.cost) {
		const qty = Number(item.cost.quantity) || 0;
		const unit = (item.cost.unit || '').toLowerCase();
		const multipliers = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
		if (unit in multipliers) {
			return qty * multipliers[unit];
		}
	}

	return null;
}
