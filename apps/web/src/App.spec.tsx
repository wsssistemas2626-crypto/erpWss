import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { messages } from './messages';

describe('F0-01 App', () => {
  it('renderiza o nome da aplicação e o texto do shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: messages.appName })).toBeDefined();
    expect(screen.getByText(messages.shellPlaceholder)).toBeDefined();
  });
});
