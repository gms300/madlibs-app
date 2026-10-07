import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('renders the MadLibs app', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /madlibs/i })).toBeInTheDocument();
});

test('selecting a story opens its first question', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /jack and jill/i }));

  expect(screen.getByRole('heading', { name: "What's a name of a person?" })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /let's go/i })).not.toBeInTheDocument();
});

test('uses shared options for each field type', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /jack and jill/i }));

  const optionSets = [
    ['Gideon', 'Harleigh', 'Juju', 'Cami', 'Emma'],
    ['Gideon', 'Harleigh', 'Juju', 'Cami', 'Emma'],
    ['bucket', 'pail', 'jar', 'bottle', 'basket', 'box'],
    ['water', 'milk', 'tacos', 'pizza'],
    ['arm', 'leg', 'head', 'foot', 'hand'],
  ];

  optionSets.forEach((options, index) => {
    options.forEach(option => {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: options[0] }));
    fireEvent.click(screen.getByRole('button', { name: index === optionSets.length - 1 ? /see story/i : /next/i }));
  });

  fireEvent.click(screen.getByRole('button', { name: /play again/i }));
  expect(screen.getByRole('heading', { name: "What's a name of a person?" })).toBeInTheDocument();
});
