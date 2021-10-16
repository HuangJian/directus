exports.seed = function (knex) {
	return knex('directus_collections').insert([
		{ id: 1, collection: 'artists' },
		{ id: 2, collection: 'events' },
		{ id: 3, collection: 'guests' },
		{ id: 4, collection: 'tours' },
		{ id: 5, collection: 'organizers' },
	]);
};
