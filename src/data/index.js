const stories = Object.values(
	import.meta.glob('./stories/*.json', { eager: true, import: 'default' })
);

export default stories;
