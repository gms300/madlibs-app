import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogFilesPlugin } from './catalog.mjs';

let root;
let server;
let url;
let plugin;
const initialTypes = { personName: [{ value: 'Alex', attributes: { pronoun: 'they' } }] };
const initialStory = { id: 'test-story', title: 'Test story', description: '', fields: [{ key: 'person', type: 'personName', prompt: 'Pick a name' }], template: '{person} said {person.pronoun} smiled.' };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'madlibs-catalog-'));
  await mkdir(join(root, 'src/data/stories'), { recursive: true });
  await writeFile(join(root, 'src/data/TypeOptions.json'), JSON.stringify(initialTypes));
  await writeFile(join(root, 'src/data/stories/test-story.json'), JSON.stringify(initialStory));
  plugin = catalogFilesPlugin('1234');
  plugin.configResolved({ root });
  let middleware;
  plugin.configureServer({
    config: { root },
    middlewares: { use: handler => { middleware = handler; } }
  });
  server = createServer((request, response) => middleware(request, response, () => { response.writeHead(404); response.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (root) await rm(root, { recursive: true, force: true });
});

const post = (path, body, headers = {}) => fetch(`${url}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-passcode': '1234', ...headers },
  body: JSON.stringify(body)
});

test('saves type values and attributes into the source JSON file', async () => {
  const options = [{ value: 'Sam', attributes: { pronoun: 'she' } }];
  const response = await post('/api/admin/types', { name: 'personName', options });
  expect(response.status).toBe(200);
  expect(JSON.parse(await readFile(join(root, 'src/data/TypeOptions.json'), 'utf8'))).toEqual({ personName: options });
});

test('updates existing stories and adds new stories as separate JSON files', async () => {
  const updated = { ...initialStory, title: 'Updated title' };
  expect((await post('/api/admin/stories', { story: updated })).status).toBe(200);
  expect(JSON.parse(await readFile(join(root, 'src/data/stories/test-story.json'), 'utf8'))).toEqual(updated);
  expect(plugin.hotUpdate({ file: join(root, 'src/data/stories/test-story.json') })).toEqual([]);
  const added = { ...initialStory, id: 'new-story', title: 'New story' };
  expect((await post('/api/admin/stories', { story: added })).status).toBe(200);
  expect(JSON.parse(await readFile(join(root, 'src/data/stories/new-story.json'), 'utf8'))).toEqual(added);
  expect(plugin.hotUpdate({ file: join(root, 'src/data/stories/new-story.json') })).toEqual([]);
});

test('saves unknown modifiers in story placeholders for editor diagnostics', async () => {
  const modified = {
    ...initialStory,
    template: '{person | capitalizefirst} said {person.pronoun | CAPITALIZEFIRST}.'
  };
  expect((await post('/api/admin/stories', { story: modified })).status).toBe(200);
  const invalid = { ...modified, template: '{person | NotAModifier}' };
  expect((await post('/api/admin/stories', { story: invalid })).status).toBe(200);
  expect(JSON.parse(await readFile(join(root, 'src/data/stories/test-story.json'), 'utf8'))).toEqual(invalid);
});

test('saves stories with invalid field values while requiring a safe story structure', async () => {
  const invalid = {
    ...initialStory,
    fields: [{ key: 'not valid', type: 'missingType', prompt: '' }],
    template: '{unknown}'
  };
  expect((await post('/api/admin/stories', { story: invalid })).status).toBe(200);
  expect(JSON.parse(await readFile(join(root, 'src/data/stories/test-story.json'), 'utf8'))).toEqual(invalid);
  expect((await post('/api/admin/stories', {
    story: { ...invalid, fields: [null] }
  })).status).toBe(400);
});

test('matches placeholders case-insensitively and saves duplicate keys for editor diagnostics', async () => {
  const story = {
    ...initialStory,
    template: '{PERSON} said {PeRsOn.PrOnOuN} smiled.'
  };
  expect((await post('/api/admin/stories', { story })).status).toBe(200);
  const duplicateKeys = { ...story, fields: [...story.fields, { ...story.fields[0], key: 'PERSON' }] };
  expect((await post('/api/admin/stories', { story: duplicateKeys })).status).toBe(200);
  expect(JSON.parse(await readFile(join(root, 'src/data/stories/test-story.json'), 'utf8'))).toEqual(duplicateKeys);
});

test('rejects attribute names that differ only by case', async () => {
  const response = await post('/api/admin/types', {
    name: 'personName',
    options: [{ value: 'Sam', attributes: { pronoun: 'they', PRONOUN: 'them' } }]
  });
  expect(response.status).toBe(400);
});

test('rejects incorrect passcodes and cross-origin writes', async () => {
  expect((await post('/api/admin/types', { name: 'food', options: [{ value: 'pizza' }] }, { 'x-admin-passcode': 'wrong' })).status).toBe(401);
  expect((await post('/api/admin/types', { name: 'food', options: [{ value: 'pizza' }] }, { Origin: 'https://example.com' })).status).toBe(403);
  expect(JSON.parse(await readFile(join(root, 'src/data/TypeOptions.json'), 'utf8'))).toEqual(initialTypes);
});

test('rejects path traversal and invalid types while allowing broken story references', async () => {
  expect((await post('/api/admin/stories', { story: { ...initialStory, id: '../../outside' } })).status).toBe(400);
  const invalidStory = { ...initialStory, template: '{unknown}' };
  expect((await post('/api/admin/stories', { story: invalidStory })).status).toBe(200);
  expect(JSON.parse(await readFile(join(root, 'src/data/stories/test-story.json'), 'utf8'))).toEqual(invalidStory);
  expect((await post('/api/admin/types', { name: 'personName', options: [{ value: 'Sam' }] })).status).toBe(400);
  expect((await post('/api/admin/types', { name: 'food', options: [{ value: '' }] })).status).toBe(400);
  expect(JSON.parse(await readFile(join(root, 'src/data/TypeOptions.json'), 'utf8'))).toEqual(initialTypes);
});

test('prevents API-saved catalog changes from triggering a Vite page reload', async () => {
  const updated = [{ value: 'Sam', attributes: { pronoun: 'she' } }];
  expect((await post('/api/admin/types', { name: 'personName', options: updated })).status).toBe(200);
  expect(plugin.hotUpdate({ file: join(root, 'src/data/TypeOptions.json') })).toEqual([]);
  expect(plugin.hotUpdate({ file: join(root, 'src/data/stories/test-story.json') })).toBeUndefined();
  expect(plugin.hotUpdate({ file: join(root, 'src/App.jsx') })).toBeUndefined();
});