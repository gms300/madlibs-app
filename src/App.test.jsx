import { act, fireEvent, render, screen } from '@testing-library/react';
import App, { renderStory } from './App';
import stories from './data';
import typeOptions from './data/TypeOptions.json';
import { vi } from 'vitest';

test('renders the story selection page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: "Let's make a story!" })).toBeInTheDocument();
});

test('selecting a story opens its first question', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /going up the hill/i }));

  expect(screen.getByRole('heading', { name: "What is a person's name?" })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /let's go/i })).not.toBeInTheDocument();
});

test('prompts resolve values collected from earlier questions', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'underwater-party');
  const nameOption = typeOptions.personName[0];
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));
  fireEvent.click(screen.getByRole('button', { name: nameOption.value, exact: true }));
  act(() => vi.advanceTimersByTime(500));

  expect(screen.getByRole('heading', { name: `How old is ${nameOption.value} turning?` })).toBeInTheDocument();
  vi.useRealTimers();
});

test('uses shared options for each field type', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'going-up-the-hill');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));

  selectedStory.fields.forEach(field => {
    const options = typeOptions[field.type];
    options.forEach(option => {
      expect(screen.getByRole('button', { name: option.value })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: options[0].value }));
    act(() => vi.advanceTimersByTime(500));
  });

  expect(screen.getByRole('heading', { name: 'Going Up the Hill' })).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Start Over' }));
  expect(screen.getByRole('heading', { name: "Let's make a story!" })).toBeInTheDocument();
  vi.useRealTimers();
});

test('completed story preserves template line breaks and spacing before Start Over', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'rogue-bus');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));

  selectedStory.fields.forEach(field => {
    const option = typeOptions[field.type][0];
    fireEvent.click(screen.getByRole('button', { name: option.value, exact: true }));
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
  const option = typeOptions[selectedStory.fields[0].type][0];
  const firstOption = option.value;
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));
  fireEvent.click(screen.getByRole('button', { name: firstOption, exact: true }));

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

test('leaves unknown fields and attributes unchanged', () => {
  expect(renderStory('{missing} {name1.unknown} {food.pronoun} {name1.constructor}', {
    name1: typeOptions.personName[0], food: { value: 'pizza' }
  })).toBe('{missing} {name1.unknown} {food.pronoun} {name1.constructor}');
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
