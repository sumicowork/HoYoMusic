import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';
import { useThemeStore } from '../../store/themeStore';

describe('ThemeToggle (smoke)', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'light' });
  });

  it('renders an antd Switch without crashing', () => {
    render(<ThemeToggle />);
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeInTheDocument();
  });

  it('reflects the current theme mode via the switch checked state', () => {
    useThemeStore.setState({ mode: 'dark' });
    render(<ThemeToggle />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles the theme store when the switch is clicked', () => {
    render(<ThemeToggle />);
    const switchEl = screen.getByRole('switch');
    expect(useThemeStore.getState().mode).toBe('light');

    fireEvent.click(switchEl);

    expect(useThemeStore.getState().mode).toBe('dark');
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the label text when showLabel is enabled', () => {
    render(<ThemeToggle showLabel />);
    expect(screen.getByText('浅色模式')).toBeInTheDocument();
  });
});
