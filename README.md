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

## Administration

Use the Administration link in the upper-right corner of the home page. The
default passcode is `1234`. To change it, set `VITE_ADMIN_PASSCODE` in your local
`.env.local` file or build environment, then restart Vite or rebuild the app.

The sidebar contains Types and Stories, with Add Type and Add Story actions.
Type settings edit values and attribute columns. Story settings edit the title,
description, ordered Fields (key, type, prompt), and story text. Use
`{key}` or `{key.attribute}` in story text; prompts can reference earlier fields.
The story box has View Mode (read-only with variables in bold blue), Sample Mode
(read-only with variables replaced by the first value of each type, still bold
blue), and Edit Mode. Save changes commits the current editor. Existing type
names remain fixed so story references stay valid.

With `npm start` running, Save changes writes directly to the source JSON files:

- Types update `src/data/TypeOptions.json`.
- Existing stories update their file in `src/data/stories/`.
- New stories create `src/data/stories/<id>.json`.

The editor waits for the server to confirm the write. Saved data is used by the
game immediately and loaded from source JSON on refresh. Browser local storage
is no longer used. Older browser-only edits are not automatically migrated;
their existing local-storage entry is left untouched. Unsaved changes are not
stored. Returning home locks administration again.

File saving is provided by the local Vite development server, which validates
the passcode, request origin, data, and story references before writing. The
source checkout must be writable. A static build or `npm run preview` cannot
save to these files; a deployed editor needs a writable backend. Rebuild after
editing source JSON to include the new data in a production build.

The passcode is included in the frontend bundle. This local editing tool is not
production-grade authentication; do not expose it as a public administration
service without proper server-side user authentication.

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

Place a modifier after `|` to transform a value or attribute. Modifiers can be
chained; the available modifier is `CapitalizeFirst`, which uppercases the
first character. For example, `{name1.pronoun | CapitalizeFirst}` renders
`They` when the selected pronoun is `they`, and `{name1 | CapitalizeFirst}`
capitalizes the selected name.