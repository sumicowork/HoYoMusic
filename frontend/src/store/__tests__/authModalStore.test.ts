import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthModalStore } from '../authModalStore';

describe('authModalStore', () => {
  beforeEach(() => {
    // Reset to defaults before each case.
    useAuthModalStore.setState({
      open: false,
      mode: 'login',
      redirectTo: null,
    });
  });

  it('starts closed with login mode and no redirect', () => {
    const state = useAuthModalStore.getState();
    expect(state.open).toBe(false);
    expect(state.mode).toBe('login');
    expect(state.redirectTo).toBeNull();
  });

  it('openLogin opens the modal in login mode and stores the redirect', () => {
    useAuthModalStore.getState().openLogin('/albums');
    const state = useAuthModalStore.getState();
    expect(state.open).toBe(true);
    expect(state.mode).toBe('login');
    expect(state.redirectTo).toBe('/albums');
  });

  it('openLogin defaults redirectTo to null when omitted', () => {
    useAuthModalStore.getState().openLogin();
    const state = useAuthModalStore.getState();
    expect(state.open).toBe(true);
    expect(state.redirectTo).toBeNull();
  });

  it('openRegister opens the modal in register mode', () => {
    useAuthModalStore.getState().openRegister();
    const state = useAuthModalStore.getState();
    expect(state.open).toBe(true);
    expect(state.mode).toBe('register');
  });

  it('setMode switches the mode while keeping the modal open', () => {
    useAuthModalStore.getState().openLogin();
    useAuthModalStore.getState().setMode('register');
    const state = useAuthModalStore.getState();
    expect(state.open).toBe(true);
    expect(state.mode).toBe('register');
  });

  it('close resets open and redirectTo', () => {
    useAuthModalStore.getState().openLogin('/profile');
    useAuthModalStore.getState().close();
    const state = useAuthModalStore.getState();
    expect(state.open).toBe(false);
    expect(state.redirectTo).toBeNull();
    // mode is left untouched by close.
    expect(state.mode).toBe('login');
  });
});
