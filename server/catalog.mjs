import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { findCaseInsensitiveKey, isKnownModifier, namesMatch, parsePlaceholder } from '../src/storyModifiers.mjs';

const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
const storyId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateType(name, options) {
  if (!identifier.test(name) || !Array.isArray(options) || !options.length) return false;
  const attributes = Object.keys(options[0]?.attributes ?? {}).sort();
  return new Set(options.map(option => option?.value)).size === options.length && options.every(option =>
    isObject(option) && typeof option.value === 'string' && option.value.trim() &&
    Object.keys(option).every(key => key === 'value' || key === 'attributes') &&
    (option.attributes === undefined || isObject(option.attributes)) &&
    JSON.stringify(Object.keys(option.attributes ?? {}).sort()) === JSON.stringify(attributes) &&
    Object.entries(option.attributes ?? {}).every(([key, value]) => identifier.test(key) && typeof value === 'string') &&
    new Set(Object.keys(option.attributes ?? {}).map(key => key.toLowerCase())).size === Object.keys(option.attributes ?? {}).length
  );
}

function validateStory(story, types) {
  if (!isObject(story) || typeof story.id !== 'string' || !storyId.test(story.id) || typeof story.title !== 'string' || !story.title.trim() ||
    typeof story.description !== 'string' || typeof story.template !== 'string' || !story.template.trim() ||
    !Array.isArray(story.fields) || !story.fields.length) return false;
  const keys = story.fields.map(field => field?.key);
  if (new Set(keys.map(key => typeof key === 'string' ? key.toLowerCase() : key)).size !== keys.length) return false;
  if (!story.fields.every(field => isObject(field) && typeof field.key === 'string' && identifier.test(field.key) &&
    typeof field.prompt === 'string' && field.prompt.trim() && Object.hasOwn(types, field.type) && types[field.type].length)) return false;
  const validText = (text, fields) => [...text.matchAll(/\{([^{}]+)\}/g)].every(match => {
    const parsed = parsePlaceholder(match[1]);
    const field = parsed && fields.find(item => namesMatch(item.key, parsed.key));
    return field && parsed.modifierNames.every(isKnownModifier) &&
      (parsed.attribute === undefined || types[field.type].every(option =>
        findCaseInsensitiveKey(option.attributes ?? {}, parsed.attribute) !== undefined));
  });
  return validText(story.template, story.fields) && story.fields.every((field, index) => validText(field.prompt, story.fields.slice(0, index)));
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function saveJson(file, value, onCatalogWrite) {
  try {
    if (JSON.stringify(await readJson(file)) === JSON.stringify(value)) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    onCatalogWrite(file);
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function createCatalogMiddleware({ root, passcode, onCatalogWrite = () => {} }) {
  const typesFile = resolve(root, 'src/data/TypeOptions.json');
  const storiesDirectory = resolve(root, 'src/data/stories');
  let pending = Promise.resolve();

  return async (request, response, next) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/api/admin/types' && pathname !== '/api/admin/stories') return next();
    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return send(405, { error: 'Use POST to save changes.' });
    }
    if (request.headers['x-admin-passcode'] !== passcode) return send(401, { error: 'Incorrect passcode. Unlock administration again.' });
    if (request.headers.origin) {
      try {
        if (new URL(request.headers.origin).host !== request.headers.host) return send(403, { error: 'Cross-origin saves are not allowed.' });
      } catch {
        return send(403, { error: 'Invalid request origin.' });
      }
    }
    let body;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024 * 1024) return send(413, { error: 'Save request is too large.' });
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!isObject(body)) return send(400, { error: 'Expected a JSON object.' });
    } catch {
      return send(400, { error: 'Invalid JSON request.' });
    }
    const save = async () => {
      const types = await readJson(typesFile);
      const files = (await readdir(storiesDirectory)).filter(file => file.endsWith('.json'));
      const stories = await Promise.all(files.map(async file => ({ file, story: await readJson(join(storiesDirectory, file)) })));
      if (pathname === '/api/admin/types') {
        if (typeof body.name !== 'string' || !validateType(body.name, body.options)) return send(400, { error: 'Invalid type name, values, or attributes.' });
        const updated = { ...types, [body.name]: body.options };
        const invalidStory = stories.find(({ story }) => story.fields.some(field => field.type === body.name) && !validateStory(story, updated));
        if (invalidStory) return send(400, { error: `This change would break story: ${invalidStory.story.title}` });
        await saveJson(typesFile, updated, onCatalogWrite);
      } else {
        if (!validateStory(body.story, types)) return send(400, { error: 'Invalid story, field types, or placeholders.' });
        const existing = stories.find(({ story }) => story.id === body.story.id);
        const filename = existing?.file ?? `${body.story.id}.json`;
        await saveJson(join(storiesDirectory, filename), body.story, onCatalogWrite);
      }
      send(200, { saved: true });
    };
    const operation = pending.then(save);
    pending = operation.catch(() => {});
    try {
      await operation;
    } catch {
      send(500, { error: 'Unable to write the JSON file. Check server file permissions and JSON data.' });
    }
  };
}

export function catalogFilesPlugin(passcode) {
  let root;
  const recentlySavedCatalogFiles = new Map();
  return {
    name: 'madlibs-catalog-files',
    configResolved(config) {
      root = config.root;
    },
    hotUpdate({ file }) {
      const savedAt = recentlySavedCatalogFiles.get(resolve(file));
      if (savedAt !== undefined && Date.now() - savedAt < 10000) {
        return [];
      }
    },
    configureServer(server) {
      server.middlewares.use(createCatalogMiddleware({
        root: server.config.root,
        passcode,
        onCatalogWrite: file => recentlySavedCatalogFiles.set(resolve(file), Date.now())
      }));
    }
  };
}