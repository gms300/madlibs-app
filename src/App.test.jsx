import { act, fireEvent, render, screen } from '@testing-library/react';
import App, { getRandomOptions, renderStory } from './App';
import stories from './data';
import typeOptions from './data/TypeOptions.json';
import { vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => vi.unstubAllGlobals());

async function saveChanges() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
  expect(screen.getByRole('status')).toHaveTextContent('Saved to JSON file.');
}

function unlockAdministration() {
  fireEvent.click(screen.getByRole('link', { name: 'Administration' }));
  fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: '1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
}

test('administration requires the passcode before showing editors', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Administration' }));
  expect(screen.queryByRole('button', { name: 'Add Type' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Incorrect passcode');
  fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: '1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  expect(screen.getByRole('button', { name: 'Add Type' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Story' })).toBeInTheDocument();
});

test('story modes preview variables and sample values while keeping the story box read-only', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'The Day the School Bus Went Crazy' }));

  const preview = screen.getByRole('region', { name: 'Story' });
  expect(preview.querySelector('.admin-story-variable')).toHaveTextContent('{name}');
  expect(screen.queryByRole('textbox', { name: 'Story' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Sample Mode' }));
  expect(preview).toHaveTextContent('Gideon');
  expect(preview).not.toHaveTextContent('{friend}');
  expect(preview.querySelector('.admin-story-variable')).toHaveTextContent('Gideon');

  fireEvent.click(screen.getByRole('button', { name: 'Edit Mode' }));
  expect(screen.getByRole('textbox', { name: 'Story' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Story' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'View Mode' }));
  expect(screen.getByRole('region', { name: 'Story' })).toHaveTextContent('{name}');
  vi.restoreAllMocks();
});

test('sample mode selects a random option for each field on entry', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.999999);
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'Trip to the Zoo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sample Mode' }));

  const preview = screen.getByRole('region', { name: 'Story' });
  expect(preview.querySelector('.admin-story-variable')).toHaveTextContent(typeOptions.personName.at(-1).value);
  expect(preview).toHaveTextContent('She');
  vi.restoreAllMocks();
});

test('sample mode applies modifiers to attribute values', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const story = stories.find(item => item.id === 'trip-to-the-zoo');
  const originalTemplate = story.template;
  story.template = '{NAME.PRonoun | CapitalizeFirst}.';
  try {
    render(<App />);
    unlockAdministration();
    fireEvent.click(screen.getByRole('button', { name: 'Trip to the Zoo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sample Mode' }));
    expect(screen.getByRole('region', { name: 'Story' })).toHaveTextContent('He.');
  } finally {
    story.template = originalTemplate;
    vi.restoreAllMocks();
  }
});

test('sample mode marks unresolved variables red', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const story = stories.find(item => item.id === 'trip-to-the-zoo');
  const originalTemplate = story.template;
  story.template = '{missing} {name.unknown} {name | UnknownModifier} {name}.';
  try {
    render(<App />);
    unlockAdministration();
    fireEvent.click(screen.getByRole('button', { name: 'Trip to the Zoo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sample Mode' }));

    const unresolvedVariables = screen.getAllByText(/\{(?:missing|name\.unknown|name \| UnknownModifier)\}/, {
      selector: '.admin-story-variable-unresolved'
    });
    expect(unresolvedVariables).toHaveLength(3);
    expect(screen.getAllByText('Gideon', { selector: '.admin-story-variable' })
      .every(variable => !variable.classList.contains('admin-story-variable-unresolved'))).toBe(true);
  } finally {
    story.template = originalTemplate;
    vi.restoreAllMocks();
  }
});

test('sample mode lets a hovered attribute value select a matching option', () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const story = stories.find(item => item.id === 'trip-to-the-zoo');
  const originalTemplate = story.template;
  story.template = '{name.pronoun}.';
  try {
    render(<App />);
    unlockAdministration();
    fireEvent.click(screen.getByRole('button', { name: 'Trip to the Zoo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sample Mode' }));

    const friendPronoun = screen.getByText('he', { selector: '.admin-story-variable' });
    fireEvent.mouseEnter(friendPronoun.parentElement);
    act(() => vi.advanceTimersByTime(500));

    const selector = screen.getByRole('combobox', { name: 'Sample value for name pronoun' });
    expect([...selector.options].map(option => option.textContent)).toEqual(
      typeOptions.personName
        .map(option => `${option.value} — ${option.attributes.pronoun}`)
        .sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }))
    );
    fireEvent.mouseLeave(friendPronoun.parentElement);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole('combobox', { name: 'Sample value for name pronoun' })).toBeInTheDocument();
    fireEvent.mouseEnter(selector);
    fireEvent.change(selector, { target: { value: '1' } });
    expect(screen.getByRole('region', { name: 'Story' })).toHaveTextContent('Harleigh');
    expect(screen.getByRole('region', { name: 'Story' })).toHaveTextContent('she');
    fireEvent.focus(selector);
    fireEvent.mouseLeave(selector);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('combobox', { name: 'Sample value for name pronoun' })).toBeInTheDocument();
    fireEvent.blur(selector);
    act(() => vi.advanceTimersByTime(499));
    expect(screen.getByRole('combobox', { name: 'Sample value for name pronoun' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('combobox', { name: 'Sample value for name pronoun' })).not.toBeInTheDocument();
  } finally {
    story.template = originalTemplate;
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});

test('edited types are sent to the JSON endpoint, and returning locks administration', async () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'personName', exact: true }));
  expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Value', 'pronoun', 'possessivePronoun', '', '']);
  const removeAttribute = screen.getByRole('button', { name: 'Remove attribute pronoun', exact: true });
  expect(removeAttribute).toHaveClass('admin-icon-button');
  expect(removeAttribute.textContent).toBe('');
  expect(removeAttribute.querySelector('svg')).toBeInTheDocument();
  expect(removeAttribute.previousElementSibling).toHaveTextContent('pronoun');
  fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'Alex' } });
  fireEvent.change(screen.getByLabelText('pronoun 1'), { target: { value: 'they' } });
  await saveChanges();
  expect(fetch).toHaveBeenCalledWith('/api/admin/types', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-passcode': '1234' }
  }));
  expect(JSON.parse(fetch.mock.calls[0][1].body).options[0]).toEqual(expect.objectContaining({ value: 'Alex', attributes: expect.objectContaining({ pronoun: 'they' }) }));
  fireEvent.click(screen.getByRole('button', { name: 'Lock and return' }));
  fireEvent.click(screen.getByRole('link', { name: 'Administration' }));
  expect(screen.getByLabelText('Passcode')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to stories' }));
  fireEvent.click(screen.getByRole('button', { name: /going up the hill/i }));
  expect(screen.getByRole('button', { name: 'Alex', exact: true })).toBeInTheDocument();
  expect(localStorage.getItem('madlibs.catalog.v1')).toBeNull();
});

test('adds a type and playable story through their JSON endpoints', async () => {
  vi.useFakeTimers();
  try {
    render(<App />);
    unlockAdministration();
    fireEvent.click(screen.getByRole('button', { name: 'Add Type' }));
    fireEvent.change(screen.getByLabelText('Type name'), { target: { value: 'spacePet' } });
    fireEvent.change(screen.getByLabelText('New value'), { target: { value: 'Moon cat' } });
    fireEvent.change(screen.getByLabelText('New attribute name'), { target: { value: 'sound' } });
    fireEvent.blur(screen.getByLabelText('New attribute name'));
    fireEvent.change(screen.getByLabelText('sound 1'), { target: { value: 'meow' } });
    await saveChanges();
    fireEvent.click(screen.getByRole('button', { name: 'Add Story' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Space friends' } });
    expect(screen.getByRole('heading', { name: 'Fields' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Field' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Field key 1'), { target: { value: 'pet' } });
    fireEvent.change(screen.getByLabelText('Field type 1'), { target: { value: 'spacePet' } });
    fireEvent.change(screen.getByLabelText('Field prompt 1'), { target: { value: 'Pick a pet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mode' }));
    fireEvent.change(screen.getByLabelText('Story', { exact: true }), { target: { value: '{pet} says {pet.sound}.' } });
    await saveChanges();
    expect(fetch.mock.calls[1][0]).toBe('/api/admin/stories');
    expect(JSON.parse(fetch.mock.calls[1][1].body).story).toEqual(expect.objectContaining({ title: 'Space friends', template: '{pet} says {pet.sound}.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock and return' }));
    fireEvent.click(screen.getByRole('button', { name: 'Space friends' }));
    fireEvent.click(screen.getByRole('button', { name: 'Moon cat' }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText('Moon cat says meow.')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('story fields can be reordered and the blank field row adds fields automatically', async () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'Going Up the Hill', exact: true }));

  const fieldTypeOptions = [...screen.getByLabelText('Field type 1').options]
    .slice(1)
    .map(option => option.textContent);
  expect(fieldTypeOptions).toEqual([...fieldTypeOptions].sort((first, second) =>
    first.localeCompare(second, undefined, { sensitivity: 'base' })
  ));

  expect(screen.getAllByLabelText(/Field key/).at(-1)).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Move field 2 up' }));
  expect(screen.getByLabelText('Field key 1')).toHaveValue('name2');
  expect(screen.getByLabelText('Field key 2')).toHaveValue('name1');

  await saveChanges();
  const savedStory = JSON.parse(fetch.mock.calls[0][1].body).story;
  expect(savedStory.fields.slice(0, 2).map(field => field.key)).toEqual(['name2', 'name1']);
});

test('type values have icon-only delete buttons in the last column', () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'personName', exact: true }));
  const header = screen.getByLabelText('New attribute name').closest('th');
  expect(header.nextElementSibling).toHaveAttribute('aria-label', 'Value controls');
  expect(header.nextElementSibling).toHaveTextContent('');
  const remove = screen.getByRole('button', { name: 'Remove value 1', exact: true });
  expect(remove).toHaveClass('admin-icon-button');
  expect(remove.textContent).toBe('');
  expect(remove.querySelector('svg')).toBeInTheDocument();
  expect(remove).toHaveAttribute('title', 'Remove value');
  expect(remove.closest('td').nextElementSibling).toBeNull();
  fireEvent.click(remove);
  expect(screen.getByLabelText('Value 1')).toHaveValue(typeOptions.personName[1].value);
  expect(screen.getByLabelText('New value')).toHaveValue('');
});

test('inline type creation keeps a blank row and accepts attributes before values', async () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'Add Type' }));
  expect(screen.queryByRole('button', { name: 'Add Value' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Attribute' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Type name'), { target: { value: 'robots' } });
  fireEvent.change(screen.getByLabelText('New attribute name'), { target: { value: 'sound' } });
  fireEvent.keyDown(screen.getByLabelText('New attribute name'), { key: 'Enter' });
  expect(screen.getByLabelText('New attribute name')).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
  expect(fetch).not.toHaveBeenCalled();
  const blankRow = screen.getByLabelText('New value');
  blankRow.focus();
  fireEvent.change(blankRow, { target: { value: 'R' } });
  expect(screen.getByLabelText('Value 1')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'Rover' } });
  fireEvent.change(screen.getByLabelText('sound 1'), { target: { value: 'beep' } });
  fireEvent.change(screen.getByLabelText('New value'), { target: { value: 'Scout' } });
  expect(screen.getByLabelText('New value')).toHaveValue('');
  await saveChanges();
  expect(JSON.parse(fetch.mock.calls[0][1].body).options).toEqual([
    { value: 'Rover', attributes: { sound: 'beep' } },
    { value: 'Scout', attributes: { sound: '' } }
  ]);
});

test('inline attribute headers reject duplicates and invalid names and save pending names', async () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'personName', exact: true }));
  fireEvent.change(screen.getByLabelText('New attribute name'), { target: { value: 'PRONOUN' } });
  fireEvent.blur(screen.getByLabelText('New attribute name'));
  expect(screen.getByRole('alert')).toHaveTextContent('unique attribute name');
  fireEvent.change(screen.getByLabelText('New attribute name'), { target: { value: 'not valid' } });
  fireEvent.keyDown(screen.getByLabelText('New attribute name'), { key: 'Enter' });
  expect(screen.getByRole('alert')).toHaveTextContent('unique attribute name');
  fireEvent.change(screen.getByLabelText('New attribute name'), { target: { value: 'nickname' } });
  await saveChanges();
  expect(JSON.parse(fetch.mock.calls[0][1].body).options.every(option => option.attributes.nickname === '')).toBe(true);
});

test('story editing saves invalid fields and keeps validation errors visible', async () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'Going Up the Hill', exact: true }));
  fireEvent.change(screen.getByLabelText('Field prompt 1'), { target: { value: '' } });
  await saveChanges();
  expect(screen.getByRole('alert')).toHaveTextContent('Each field needs a valid key and a prompt.');
  expect(JSON.parse(fetch.mock.calls[0][1].body).story.fields[0].prompt).toBe('');
});

test('story editing accepts case-insensitive field and attribute placeholders', async () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'Trip to the Zoo', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Mode' }));
  fireEvent.change(screen.getByLabelText('Story', { exact: true }), { target: { value: '{NAME.PRONOUN}.' } });
  await saveChanges();
  expect(JSON.parse(fetch.mock.calls[0][1].body).story.template).toBe('{NAME.PRONOUN}.');
});

test('type editing rejects removal of attributes referenced by saved stories', () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'verb', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove attribute ingTense' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Unknown or unavailable placeholder:');
  expect(fetch).not.toHaveBeenCalled();
});

test('file-save failure keeps the draft available and reports the server error', async () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'food', exact: true }));
  fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'Space tacos' } });
  fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Permission denied' }) });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to save. Permission denied');
  expect(screen.getByLabelText('Value 1')).toHaveValue('Space tacos');
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});

test('waits for file-save confirmation and disables editing during the request', async () => {
  let complete;
  fetch.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'food', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  expect(screen.getByLabelText('Value 1')).toBeDisabled();
  expect(screen.getByRole('status')).not.toHaveTextContent('Saved to JSON file.');
  await act(async () => complete({ ok: true }));
  expect(screen.getByRole('status')).toHaveTextContent('Saved to JSON file.');
});

test('loads source JSON instead of stale browser-local edits', () => {
  localStorage.setItem('madlibs.catalog.v1', JSON.stringify({ stories: [], types: {} }));
  render(<App />);
  expect(screen.getByRole('button', { name: /going up the hill/i })).toBeInTheDocument();
});

test('renders the story selection page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: "Let's make a story!" })).toBeInTheDocument();
});

test('selecting a story opens its first question', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /going up the hill/i }));

  expect(screen.getByRole('heading', { name: "Choose a person." })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /let's go/i })).not.toBeInTheDocument();
});

test('story settings show Story before collapsible Fields sections', () => {
  render(<App />);
  unlockAdministration();
  fireEvent.click(screen.getByRole('button', { name: 'Going Up the Hill', exact: true }));

  const sections = [...document.querySelectorAll('.admin-settings-section')];
  expect(sections.map(section => section.querySelector('.admin-section-title').textContent)).toEqual(['Story', 'Fields']);
  sections.forEach(section => expect(section).toHaveAttribute('open'));

  const storySummary = screen.getByRole('heading', { name: 'Story' }).closest('summary');
  fireEvent.click(storySummary);
  expect(sections[0]).not.toHaveAttribute('open');

  const fieldsSummary = screen.getByRole('heading', { name: 'Fields' }).closest('summary');
  fireEvent.click(fieldsSummary);
  expect(sections[1]).not.toHaveAttribute('open');
});

test('prompts resolve values collected from earlier questions', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'underwater-party');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));
  const nameOption = screen.getAllByRole('button').find(button => button.textContent !== '← Back').textContent.trim();
  fireEvent.click(screen.getByRole('button', { name: nameOption, exact: true }));
  act(() => vi.advanceTimersByTime(500));

  expect(screen.getByRole('heading', { name: `How old is ${nameOption} turning?` })).toBeInTheDocument();
  vi.useRealTimers();
});

test('uses shared options for each field type', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'going-up-the-hill');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));

  selectedStory.fields.forEach(field => {
    const options = typeOptions[field.type];
    const choiceButtons = screen.getAllByRole('button').filter(button => button.textContent !== '← Back');
    expect(choiceButtons).toHaveLength(Math.min(options.length, 10));
    choiceButtons.forEach(button => {
      expect(options.some(option => option.value === button.textContent.trim())).toBe(true);
    });
    fireEvent.click(choiceButtons[0]);
    act(() => vi.advanceTimersByTime(500));
  });

  expect(screen.getByRole('heading', { name: 'Going Up the Hill' })).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Start Over' }));
  expect(screen.getByRole('heading', { name: "Let's make a story!" })).toBeInTheDocument();
  vi.useRealTimers();
});

test('randomizes choices and limits each prompt to ten without changing source options', () => {
  const options = typeOptions.adjective;
  const originalOptions = [...options];
  const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

  try {
    const randomizedOptions = getRandomOptions(options);
    const shortOptions = typeOptions.schoolSubject;
    const randomizedShortOptions = getRandomOptions(shortOptions);

    expect(randomizedOptions).toHaveLength(10);
    expect(randomizedOptions).not.toEqual(options.slice(0, 10));
    expect(new Set(randomizedOptions).size).toBe(10);
    randomizedOptions.forEach(option => expect(options).toContain(option));
    expect(options).toEqual(originalOptions);
    expect(randomizedShortOptions).toHaveLength(shortOptions.length);
    expect(randomizedShortOptions).not.toEqual(shortOptions);
  } finally {
    randomSpy.mockRestore();
  }
});

test('completed story preserves template line breaks and spacing before Start Over', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'crazy-bus');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));

  selectedStory.fields.forEach(field => {
    const firstChoice = screen.getAllByRole('button').find(button => button.textContent !== '← Back');
    fireEvent.click(firstChoice);
    act(() => vi.advanceTimersByTime(500));
  });

  const storyText = screen.getByText(/Monday morning/);
  expect(storyText.textContent.split('\n\n')).toHaveLength(selectedStory.template.split('\n\n').length);
  expect(storyText).toHaveStyle('white-space: pre-line');
  expect(storyText.style.marginBottom).toBe('2rem');
  expect(screen.getByRole('button', { name: 'Start Over' })).toBeInTheDocument();
  vi.useRealTimers();
});

test('selection pauses before advancing and Back preserves answers for corrections', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'going-up-the-hill');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));
  const firstChoice = screen.getAllByRole('button').find(button => button.textContent !== '← Back');
  const firstOption = firstChoice.textContent.trim();
  fireEvent.click(firstChoice);

  expect(screen.getByRole('heading', { name: selectedStory.fields[0].prompt })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /next|see story/i })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole('heading', { name: selectedStory.fields[1].prompt })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /back/i }));
  expect(screen.getByRole('heading', { name: selectedStory.fields[0].prompt })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: `✓ ${firstOption}` })).toBeInTheDocument();
  vi.useRealTimers();
});

test('selected option attributes appear in the completed story', () => {
  vi.useFakeTimers();
  const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999999);
  const selectedStory = stories.find(story => story.id === 'going-up-the-hill');
  const originalTemplate = selectedStory.template;
  const nameField = selectedStory.fields.find(field => field.type === 'personName');
  const person = typeOptions.personName[1];
  selectedStory.template = `{${nameField.key}} said {${nameField.key}.pronoun} lost {${nameField.key}.possessivePronoun} hat.`;

  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));
    selectedStory.fields.forEach(field => {
      const option = field.key === nameField.key ? person : typeOptions[field.type][0];
      fireEvent.click(screen.getByRole('button', { name: option.value, exact: true }));
      act(() => vi.advanceTimersByTime(500));
    });

    expect(screen.getByText(`${person.value} said ${person.attributes.pronoun} lost ${person.attributes.possessivePronoun} hat.`)).toBeInTheDocument();
  } finally {
    selectedStory.template = originalTemplate;
    vi.useRealTimers();
    randomSpy.mockRestore();
  }
});

test('resolves values and attributes without reinterpreting replacement text', () => {
  expect(renderStory(
    '{name1} said {name1.pronoun} brought {name1.possessivePronoun} {food}. {name1.pronoun} smiled.',
    {
      name1: { value: 'Alex', attributes: { pronoun: 'she', possessivePronoun: 'her' } },
      food: { value: '$& {name1}' }
    }
  )).toBe('Alex said she brought her $& {name1}. she smiled.');
});

test('resolves field and attribute names without case sensitivity', () => {
  expect(renderStory('{NAME1} said {nAmE1.PrOnOuN}.', {
    name1: { value: 'Alex', attributes: { pronoun: 'they' } }
  })).toBe('Alex said they.');
});

test('applies modifiers to values and attributes, including chained modifiers', () => {
  const answers = {
    name1: { value: 'alex', attributes: { pronoun: 'they' } }
  };
  expect(renderStory(
    '{name1 | capitalizefirst} said {name1.pronoun | cAPITALIZEfIRST}.',
    answers
  )).toBe('Alex said They.');
  expect(renderStory('{name1 | CapitalizeFirst | CAPITALIZEFIRST}', answers)).toBe('Alex');
});

test('leaves unknown fields and attributes unchanged', () => {
  expect(renderStory('{missing} {name1.unknown} {food.pronoun} {name1.constructor}', {
    name1: typeOptions.personName[0], food: { value: 'pizza' }
  })).toBe('{missing} {name1.unknown} {food.pronoun} {name1.constructor}');
  expect(renderStory('{name1 | UnknownModifier}', {
    name1: typeOptions.personName[0]
  })).toBe('{name1 | UnknownModifier}');
});

test('types contain only value objects with optional consistent attributes', () => {
  Object.values(typeOptions).forEach(options => {
    expect(Array.isArray(options)).toBe(true);
    const attributeNames = Object.keys(options[0].attributes ?? {}).sort();
    options.forEach(option => {
      expect(option).not.toBeNull();
      expect(typeof option).toBe('object');
      expect(Array.isArray(option)).toBe(false);
      expect(Object.hasOwn(option, 'value')).toBe(true);
      expect(typeof option.value).toBe('string');
      if (Object.hasOwn(option, 'attributes')) {
        expect(option.attributes).not.toBeNull();
        expect(typeof option.attributes).toBe('object');
        expect(Array.isArray(option.attributes)).toBe(false);
      }
      expect(Object.keys(option.attributes ?? {}).sort()).toEqual(attributeNames);
    });
  });
});

test('silly adjective options are merged into adjective with article attributes', () => {
  expect(typeOptions).not.toHaveProperty('sillyAdjective');
  expect(typeOptions.adjective).toHaveLength(24);
  expect(typeOptions.adjective.find(option => option.value === 'itchy').attributes.article).toBe('an');
  expect(typeOptions.adjective.find(option => option.value === 'enormous').attributes.article).toBe('an');
});

test('silly object options are merged into thing with plural attributes', () => {
  expect(typeOptions).not.toHaveProperty('sillyObject');
  expect(typeOptions.thing).toHaveLength(26);
  expect(typeOptions.thing.find(option => option.value === 'rubber chicken').attributes.plural).toBe('rubber chickens');
});

test('silly animal options are merged into animal', () => {
  expect(typeOptions).not.toHaveProperty('sillyAnimal');
  expect(typeOptions.animal).toHaveLength(28);
  expect(typeOptions.animal.find(option => option.value === 'llama')).toBeDefined();
  expect(typeOptions.animal.find(option => option.value === 'eagle')).toBeDefined();
});

test('number options provide grammatical birthday ordinals and day counts', () => {
  expect(typeOptions.number.map(option => option.attributes)).toEqual([
    { ordinal: '1st', dayCount: '1 day' },
    { ordinal: '2nd', dayCount: '2 days' },
    { ordinal: '3rd', dayCount: '3 days' },
    { ordinal: '4th', dayCount: '4 days' },
    { ordinal: '5th', dayCount: '5 days' },
    { ordinal: '6th', dayCount: '6 days' },
    { ordinal: '7th', dayCount: '7 days' },
    { ordinal: '10th', dayCount: '10 days' },
    { ordinal: '30th', dayCount: '30 days' },
    { ordinal: '42nd', dayCount: '42 days' },
    { ordinal: '55th', dayCount: '55 days' },
    { ordinal: '100th', dayCount: '100 days' }
  ]);
});

test('story wording stays grammatical with vowel-starting values and singular numbers', () => {
  const dragonStory = stories.find(story => story.id === 'dragon-homework');
  const dragonAnswers = Object.fromEntries(dragonStory.fields.map(field => [
    field.key,
    typeOptions[field.type][0]
  ]));
  dragonAnswers.color = typeOptions.color.find(option => option.value === 'orange');
  expect(renderStory(dragonStory.template, dragonAnswers)).toContain('is a dragon with orange scales');

  const busStory = stories.find(story => story.id === 'crazy-bus');
  const busAnswers = Object.fromEntries(busStory.fields.map(field => [
    field.key,
    typeOptions[field.type][0]
  ]));
  busAnswers.adjective = typeOptions.adjective.find(option => option.value === 'angry');
  expect(renderStory(busStory.template, busAnswers)).toContain('felt angry while waiting');

  const moonStory = stories.find(story => story.id === 'moon-cheese');
  const moonAnswers = Object.fromEntries(moonStory.fields.map(field => [
    field.key,
    typeOptions[field.type][0]
  ]));
  moonAnswers.number = typeOptions.number[0];
  expect(renderStory(moonStory.template, moonAnswers)).toContain('After 1 day of floating');

  const birthdayStory = stories.find(story => story.id === 'underwater-party');
  const birthdayAnswers = Object.fromEntries(birthdayStory.fields.map(field => [
    field.key,
    typeOptions[field.type][0]
  ]));
  birthdayAnswers.number = typeOptions.number[0];
  birthdayAnswers.seacreature = typeOptions.seaCreature.find(option => option.value === 'octopus');
  const birthdayText = renderStory(birthdayStory.template, birthdayAnswers);
  expect(birthdayText).toContain("Gideon's 1st birthday");
  expect(birthdayText).not.toContain('a octopus');
});

test('every story renders every field option without testing all combinations', () => {
  let sampleCount = 0;

  stories.forEach(story => {
    const defaultAnswers = Object.fromEntries(story.fields.map(field => [
      field.key,
      typeOptions[field.type][0]
    ]));

    story.fields.forEach(field => {
      typeOptions[field.type].forEach(option => {
        const rendered = renderStory(story.template, {
          ...defaultAnswers,
          [field.key]: option
        });

        expect(rendered).not.toMatch(/\{[^{}]+\}/);
        expect([option.value, ...Object.values(option.attributes ?? {})].some(value =>
          rendered.includes(value)
        )).toBe(true);
        sampleCount++;
      });
    });
  });

  expect(sampleCount).toBe(stories.reduce((total, story) => total + story.fields.reduce(
    (storyTotal, field) => storyTotal + typeOptions[field.type].length,
    0
  ), 0));
});
