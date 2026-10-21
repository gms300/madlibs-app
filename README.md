# MadLibs

## Development

Install dependencies and start the Vite development server:

```sh
npm install
npm start
```

## Tests and build

```sh
npm test
npm run build
npm run preview
```

## Option attributes

Types in `src/data/TypeOptions.json` must be arrays of objects with a required
`value` string and an optional `attributes` object. String entries are not supported:

```json
{
	"personName": [
		{"value": "Alex", "attributes": {"pronoun": "she", "possessivePronoun": "her"}},
		{"value": "Sam", "attributes": {"pronoun": "he", "possessivePronoun": "his"}}
	],
	"food": [
		{"value": "pizza"},
		{"value": "tacos"}
	]
}
```

Use the same attribute names for every option within a type. The tests check
this consistency. Attribute names are customizable; person names currently use
neutral `they`/`their` defaults that can be edited per person.

For a story field with key `name1` and type `personName`, `{name1}` inserts the
selected value, while `{name1.pronoun}` or `{name1.possessivePronoun}` inserts
the corresponding attribute. For example, `{name1} said {name1.pronoun} lost
{name1.possessivePronoun} hat.` becomes `Alex said she lost her hat.` Unknown
fields or attributes remain unchanged so template mistakes are visible.