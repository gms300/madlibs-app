import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import './Administration.css';
import { applyModifiers, findCaseInsensitiveKey, isKnownModifier, namesMatch, parsePlaceholder } from './storyModifiers.mjs';

const passcode = import.meta.env.VITE_ADMIN_PASSCODE ?? '1234';
const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
const copy = value => JSON.parse(JSON.stringify(value));

function renderStoryPreview(template, fields, types, sampleMode, sampleValues, activeVariable, onVariableEnter, onVariableKeep, onVariableLeave, onSelectorFocus, onSelectorBlur, onSampleValueChange) {
  return template.split(/(\{[^{}]+\})/g).map((part, index) => {
    if (!/^\{[^{}]+\}$/.test(part)) return part;
    const parsed = parsePlaceholder(part.slice(1, -1));
    if (!parsed) return <strong
      className={`admin-story-variable${sampleMode ? ' admin-story-variable-unresolved' : ''}`}
      key={index}
    >{part}</strong>;
    const { key, attribute, modifierNames } = parsed;
    const field = fields.find(item => namesMatch(item.key, key));
    const options = field ? types[field.type] ?? [] : [];
    const selectedIndex = sampleValues[field?.key ?? key] ?? 0;
    const selectedOption = options[selectedIndex];
    const attributeKey = attribute && selectedOption
      ? findCaseInsensitiveKey(selectedOption.attributes ?? {}, attribute)
      : undefined;
    const hasSampleValue = Boolean(selectedOption && (!attribute || attributeKey !== undefined));
    const sampleValue = sampleMode && hasSampleValue
      ? attribute ? selectedOption.attributes[attributeKey] : selectedOption.value
      : part;
    const modifiedSampleValue = sampleMode && hasSampleValue
      ? applyModifiers(sampleValue, modifierNames)
      : null;
    const isUnresolved = sampleMode && (!field || !hasSampleValue || modifiedSampleValue === null);
    const value = sampleMode && !isUnresolved ? modifiedSampleValue : part;
    const variableClassName = `admin-story-variable${isUnresolved ? ' admin-story-variable-unresolved' : ''}`;
    const isSampleVariable = sampleMode && options.length > 0;

    if (isSampleVariable) {
      return <span
        className="admin-story-sample-variable"
        key={index}
        onMouseEnter={() => onVariableEnter(index)}
        onMouseLeave={onVariableLeave}
        onFocus={() => onVariableEnter(index)}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) onVariableLeave();
        }}
      >
        <strong className={variableClassName} tabIndex={0}>{value}</strong>
        {activeVariable === index && <select
          className="admin-story-sample-select"
          aria-label={`Sample value for ${key}${attribute ? ` ${attribute}` : ''}`}
          value={selectedIndex}
          onChange={event => onSampleValueChange(field.key, Number(event.target.value))}
          onMouseEnter={onVariableKeep}
          onMouseLeave={onVariableLeave}
          onFocus={onSelectorFocus}
          onBlur={onSelectorBlur}
        >
          {options.map((option, optionIndex) => {
            const optionAttributeKey = attribute
              ? findCaseInsensitiveKey(option.attributes ?? {}, attribute)
              : undefined;
            return <option key={optionIndex} value={optionIndex}>
              {attribute
                ? `${option.value} — ${optionAttributeKey === undefined ? '' : option.attributes[optionAttributeKey]}`
                : option.value}
            </option>;
          })}
        </select>}
      </span>;
    }
    return <strong className={variableClassName} key={index}>{value}</strong>;
  });
}

function validateStory(story, types) {
  if (!story.title.trim() || !story.template.trim()) return 'Enter a title and story text.';
  if (!story.fields.length) return 'Add at least one type to the story.';
  const keys = story.fields.map(field => field.key);
  if (new Set(keys.map(key => typeof key === 'string' ? key.toLowerCase() : key)).size !== keys.length) return 'Each field key must be unique.';
  for (const field of story.fields) {
    if (!identifier.test(field.key) || !field.prompt.trim()) return 'Each field needs a valid key and a prompt.';
    if (!Object.hasOwn(types, field.type) || !types[field.type].length) return 'Choose a nonempty type for every field.';
  }
  const checkText = (text, available) => {
    for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
      const parsed = parsePlaceholder(match[1]);
      const field = parsed && available.find(item => namesMatch(item.key, parsed.key));
      if (!field || !parsed.modifierNames.every(isKnownModifier) ||
        (parsed.attribute !== undefined && !types[field.type].every(option =>
          findCaseInsensitiveKey(option.attributes ?? {}, parsed.attribute) !== undefined))) {
        return `Unknown or unavailable placeholder: ${match[0]}`;
      }
    }
    return '';
  };
  for (let index = 0; index < story.fields.length; index++) {
    const error = checkText(story.fields[index].prompt, story.fields.slice(0, index));
    if (error) return error;
  }
  return checkText(story.template, story.fields);
}

export default function Administration({ catalog, onSave, onClose }) {
  const [unlocked, setUnlocked] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [selection, setSelection] = useState(null);
  const [draft, setDraft] = useState(null);
  const [attributeName, setAttributeName] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storyMode, setStoryMode] = useState('view');
  const [sampleValues, setSampleValues] = useState({});
  const [activeSampleVariable, setActiveSampleVariable] = useState(null);
  const sampleHoverTimeout = useRef(null);
  const sampleHideTimeout = useRef(null);
  const sampleSelectorFocused = useRef(false);

  useEffect(() => () => {
    clearTimeout(sampleHoverTimeout.current);
    clearTimeout(sampleHideTimeout.current);
  }, []);

  const canLeave = () => !saving && (!dirty || window.confirm('Discard unsaved changes?'));
  const close = () => { if (canLeave()) onClose(); };
  const select = (kind, key = null) => {
    if (!canLeave()) return;
    setSelection({ kind, key });
    setDraft(kind === 'type'
      ? { name: key ?? '', options: key ? copy(catalog.types[key]) : [], attributeNames: key ? [...new Set(catalog.types[key].flatMap(option => Object.keys(option.attributes ?? {})))] : [] }
      : key ? copy(catalog.stories.find(story => story.id === key)) : { title: '', description: '', fields: [], template: '' });
    setDirty(false);
    setAttributeName('');
    setStoryMode('view');
    setSampleValues({});
    setActiveSampleVariable(null);
    sampleSelectorFocused.current = false;
    clearTimeout(sampleHideTimeout.current);
    setError('');
    setStatus('');
  };
  const update = changes => { setDraft(previous => ({ ...previous, ...changes })); setDirty(true); setStatus(''); setError(''); };
  const showSampleSelector = index => {
    clearTimeout(sampleHoverTimeout.current);
    clearTimeout(sampleHideTimeout.current);
    sampleHoverTimeout.current = setTimeout(() => setActiveSampleVariable(index), 500);
  };
  const keepSampleSelector = () => {
    clearTimeout(sampleHoverTimeout.current);
    clearTimeout(sampleHideTimeout.current);
  };
  const focusSampleSelector = () => {
    sampleSelectorFocused.current = true;
    keepSampleSelector();
  };
  const hideSampleSelector = () => {
    clearTimeout(sampleHoverTimeout.current);
    if (sampleSelectorFocused.current) return;
    clearTimeout(sampleHideTimeout.current);
    sampleHideTimeout.current = setTimeout(() => setActiveSampleVariable(null), 500);
  };
  const blurSampleSelector = () => {
    sampleSelectorFocused.current = false;
    hideSampleSelector();
  };
  const attributes = selection?.kind === 'type' ? draft.attributeNames : [];
  const updateOption = (index, value, attribute) => index === draft.options.length
    ? value && update({ options: [...draft.options, { value, ...(attributes.length ? { attributes: Object.fromEntries(attributes.map(name => [name, ''])) } : {}) }] })
    : update({ options: draft.options.map((option, row) => row !== index ? option : attribute === undefined
    ? { ...option, value }
    : { ...option, attributes: { ...option.attributes, [attribute]: value } }) });
  const commitAttribute = () => {
    const name = attributeName.trim();
    if (!name) return draft;
    if (!identifier.test(name) || attributes.some(attribute => namesMatch(attribute, name))) {
      setError('Enter a unique attribute name using letters, numbers, or underscores, starting with a letter.');
      return null;
    }
    const next = { ...draft, attributeNames: [...attributes, name], options: draft.options.map(option => ({ ...option, attributes: { ...option.attributes, [name]: '' } })) };
    update(next);
    setAttributeName('');
    return next;
  };
  const updateField = (index, changes) => index === draft.fields.length
    ? update({ fields: [...draft.fields, { key: '', type: '', prompt: '', ...changes }] })
    : update({ fields: draft.fields.map((field, row) => row === index ? { ...field, ...changes } : field) });
  const moveField = (index, offset) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= draft.fields.length) return;
    const fields = [...draft.fields];
    [fields[index], fields[nextIndex]] = [fields[nextIndex], fields[index]];
    update({ fields });
  };

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    let next;
    let key = selection.key;
    if (selection.kind === 'type') {
      const typeDraft = commitAttribute();
      if (!typeDraft) return;
      const name = typeDraft.name.trim();
      if (!identifier.test(name)) return setError('Use a type name starting with a letter, followed by letters, numbers, or underscores.');
      if (!key && Object.hasOwn(catalog.types, name)) return setError('A type with that name already exists.');
      if (!typeDraft.options.length || typeDraft.options.some(option => !option.value.trim())) return setError('Add at least one value and fill in every value.');
      if (new Set(typeDraft.options.map(option => option.value.trim())).size !== typeDraft.options.length) return setError('Values must be unique within a type.');
      const options = typeDraft.options.map(option => ({ value: option.value.trim(), ...(typeDraft.attributeNames.length ? { attributes: Object.fromEntries(typeDraft.attributeNames.map(attribute => [attribute, option.attributes?.[attribute] ?? ''])) } : {}) }));
      next = { ...catalog, types: { ...catalog.types, [name]: options } };
      for (const story of catalog.stories) {
        if (story.fields.some(field => field.type === name)) {
          const problem = validateStory(story, next.types);
          if (problem) return setError(`${story.title}: ${problem}`);
        }
      }
      key = name;
    } else {
      const problem = validateStory(draft, catalog.types);
      if (problem) return setError(problem);
      key = key ?? crypto.randomUUID();
      const story = { ...draft, id: key, title: draft.title.trim() };
      next = { ...catalog, stories: selection.key ? catalog.stories.map(item => item.id === key ? story : item) : [...catalog.stories, story] };
    }
    try {
      setSaving(true);
      await onSave(next, { kind: selection.kind, key }, enteredCode);
      setSelection({ ...selection, key });
      setDirty(false);
      setError('');
      setStatus('Saved to JSON file.');
    } catch (error) {
      setError(`Unable to save. ${error.message || 'Check the local server connection.'} Your changes have not been saved.`);
    } finally {
      setSaving(false);
    }
  };

  if (!unlocked) return (
    <main className="admin-login">
      <form className="admin-login-form" onSubmit={event => {
        event.preventDefault();
        if (enteredCode === passcode) { setUnlocked(true); setError(''); }
        else setError('Incorrect passcode. Try again.');
      }}>
        <h1>Administration</h1>
        <label htmlFor="admin-passcode">Passcode</label>
        <input id="admin-passcode" type="password" autoComplete="current-password" value={enteredCode} onChange={event => setEnteredCode(event.target.value)} required />
        {error && <p role="alert">{error}</p>}
        <button className="admin-primary" type="submit">Unlock</button>
        <button type="button" onClick={onClose}>Back to stories</button>
      </form>
    </main>
  );

  return (
    <div className="admin-shell">
      <header className="admin-header"><h1>Administration</h1><button type="button" onClick={close}>Lock and return</button></header>
      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Story and type navigation">
          <div className="admin-add-actions"><button onClick={() => select('type')}>Add Type</button><button onClick={() => select('story')}>Add Story</button></div>
          <nav aria-label="Content tree">
            <details open><summary>Types <span>{Object.keys(catalog.types).length}</span></summary><ul>{Object.keys(catalog.types).sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' })).map(name => <li key={name}><button aria-current={selection?.kind === 'type' && selection.key === name ? 'page' : undefined} onClick={() => select('type', name)}>{name}</button></li>)}</ul></details>
            <details open><summary>Stories <span>{catalog.stories.length}</span></summary><ul>{[...catalog.stories].sort((first, second) => first.title.localeCompare(second.title, undefined, { sensitivity: 'base' })).map(story => <li key={story.id}><button aria-current={selection?.kind === 'story' && selection.key === story.id ? 'page' : undefined} onClick={() => select('story', story.id)}>{story.title}</button></li>)}</ul></details>
          </nav>
        </aside>
        <main className="admin-editor">
          {!selection ? <h2>Select a type or story</h2> : <form onSubmit={save}>
            <fieldset className="admin-fields" disabled={saving}>
            <div className="admin-editor-heading"><h2>{selection.kind === 'type' ? 'Type settings' : 'Story settings'}</h2><button className="admin-primary" type="submit">{saving ? 'Saving...' : 'Save changes'}</button></div>
            {error && <p role="alert">{error}</p>}
            <p className="admin-status" role="status">{status || (dirty ? 'Unsaved changes' : '')}</p>
            {selection.kind === 'type' ? <>
              <label>Type name<input value={draft.name} readOnly={Boolean(selection.key)} onChange={event => update({ name: event.target.value })} required /></label>
              <div className="admin-section-heading"><h3>Values</h3></div>
              <div className="admin-table-scroll"><table><thead><tr><th scope="col">Value</th>{attributes.map(attribute => <th scope="col" key={`attribute-${attribute}`}><div className="admin-attribute-heading"><span>{attribute}</span><button type="button" className="admin-icon-button" aria-label={`Remove attribute ${attribute}`} title={`Remove attribute ${attribute}`} onClick={() => update({ attributeNames: attributes.filter(name => name !== attribute), options: draft.options.map(option => ({ ...option, attributes: Object.fromEntries(Object.entries(option.attributes ?? {}).filter(([name]) => name !== attribute)) })) })}><Trash2 size={18} aria-hidden="true" /></button></div></th>)}<th scope="col" key="new-attribute"><input aria-label="New attribute name" value={attributeName} onChange={event => { setAttributeName(event.target.value); setDirty(true); setStatus(''); setError(''); }} onBlur={commitAttribute} onKeyDown={event => {
                if (event.key === 'Enter') { event.preventDefault(); commitAttribute(); }
              }} /></th><th scope="col" key="actions" className="admin-value-actions" aria-label="Value controls" /></tr></thead><tbody>{[...draft.options, { value: '' }].map((option, index) => {
                const isNew = index === draft.options.length;
                return <tr key={index}>
                  <td><input aria-label={isNew ? 'New value' : `Value ${index + 1}`} value={option.value} onChange={event => updateOption(index, event.target.value)} required={!isNew} /></td>
                  {attributes.map(attribute => <td key={`attribute-${attribute}`}><input aria-label={`${attribute} ${index + 1}`} value={option.attributes?.[attribute] ?? ''} disabled={isNew} onChange={event => updateOption(index, event.target.value, attribute)} /></td>)}
                  <td key="new-attribute" />
                  <td key="actions" className="admin-value-actions">{!isNew && <button type="button" className="admin-icon-button" aria-label={`Remove value ${index + 1}`} title="Remove value" onClick={() => update({ options: draft.options.filter((_, row) => row !== index) })}><Trash2 size={18} aria-hidden="true" /></button>}</td>
                </tr>;
              })}</tbody></table></div>
            </> : <>
              <label>Title<input value={draft.title} onChange={event => update({ title: event.target.value })} required /></label>
              <label>Description<input value={draft.description} onChange={event => update({ description: event.target.value })} /></label>
              <div className="admin-section-heading"><h3>Fields</h3></div>
              <div className="admin-table-scroll"><table><thead><tr><th scope="col">Key</th><th scope="col">Type</th><th scope="col">Prompt</th><th scope="col">Actions</th></tr></thead><tbody>{[...draft.fields, { key: '', type: '', prompt: '' }].map((field, index) => {
                const isNew = index === draft.fields.length;
                return <tr key={index}>
                <td><input aria-label={`Field key ${index + 1}`} value={field.key} onChange={event => updateField(index, { key: event.target.value })} required={!isNew} /></td>
                <td><select aria-label={`Field type ${index + 1}`} value={field.type} onChange={event => updateField(index, { type: event.target.value })} required={!isNew}><option value="">Choose a type</option>{Object.keys(catalog.types).sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' })).map(type => <option key={type}>{type}</option>)}</select></td>
                <td><input aria-label={`Field prompt ${index + 1}`} value={field.prompt} onChange={event => updateField(index, { prompt: event.target.value })} required={!isNew} /></td>
                <td className="admin-field-actions">{!isNew && <>
                  <button type="button" className="admin-icon-button" aria-label={`Move field ${index + 1} up`} title="Move field up" disabled={index === 0} onClick={() => moveField(index, -1)}><ChevronUp size={18} aria-hidden="true" /></button>
                  <button type="button" className="admin-icon-button" aria-label={`Move field ${index + 1} down`} title="Move field down" disabled={index === draft.fields.length - 1} onClick={() => moveField(index, 1)}><ChevronDown size={18} aria-hidden="true" /></button>
                  <button type="button" className="admin-icon-button" aria-label={`Remove field ${index + 1}`} title="Remove field" onClick={() => update({ fields: draft.fields.filter((_, row) => row !== index) })}><Trash2 size={18} aria-hidden="true" /></button>
                </>}</td>
              </tr>;
              })}</tbody></table></div>
              <div className="admin-story-heading">
                <span className="admin-story-label">Story</span>
                <div className="admin-story-modes" role="group" aria-label="Story mode">
                  {[
                    ['view', 'View Mode'],
                    ['sample', 'Sample Mode'],
                    ['edit', 'Edit Mode']
                  ].map(([mode, label]) => (
                    <button key={mode} type="button" aria-pressed={storyMode === mode} onClick={() => setStoryMode(mode)}>{label}</button>
                  ))}
                </div>
              </div>
              {storyMode === 'edit'
                ? <textarea id="admin-story-template" aria-label="Story" rows={14} value={draft.template} onChange={event => update({ template: event.target.value })} required />
                : <div className="admin-story-preview" role="region" aria-label="Story">
                  {renderStoryPreview(
                    draft.template,
                    draft.fields,
                    catalog.types,
                    storyMode === 'sample',
                    sampleValues,
                    storyMode === 'sample' ? activeSampleVariable : null,
                    showSampleSelector,
                    keepSampleSelector,
                    hideSampleSelector,
                    focusSampleSelector,
                    blurSampleSelector,
                    (key, index) => setSampleValues(previous => ({ ...previous, [key]: index }))
                  )}
                </div>}
            </>}
            </fieldset>
          </form>}
        </main>
      </div>
    </div>
  );
}