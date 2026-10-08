import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import stories from './stories';
import typeOptions from './stories/TypeOptions.json';
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

test('uses shared options for each field type', () => {
  vi.useFakeTimers();
  const selectedStory = stories.find(story => story.id === 'going-up-the-hill');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(selectedStory.title, 'i') }));

  selectedStory.fields.forEach(field => {
    const options = typeOptions[field.type];
    options.forEach(option => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: options[0] }));
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
    fireEvent.click(screen.getByRole('button', { name: typeOptions[field.type][0], exact: true }));
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
  const firstOption = typeOptions[selectedStory.fields[0].type][0];
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
