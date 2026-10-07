import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the MadLibs app', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /madlibs/i })).toBeInTheDocument();
});
