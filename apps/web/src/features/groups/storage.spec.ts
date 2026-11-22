import { pendingInvite, pendingShare } from './storage';

describe('invitation en attente', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('garde le jeton jusqu’à ce qu’on l’efface', () => {
    pendingInvite.set('abc');
    expect(pendingInvite.get()).toBe('abc');
    pendingInvite.clear();
    expect(pendingInvite.get()).toBeNull();
  });

  it('oublie un jeton de plus de 7 jours', () => {
    vi.useFakeTimers();
    pendingInvite.set('abc');
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
    expect(pendingInvite.get()).toBeNull();
  });

  it('ignore une valeur illisible', () => {
    localStorage.setItem('canapact.pendingInvite', '{pas du json');
    expect(pendingInvite.get()).toBeNull();
  });
});

describe('partage en attente', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('garde le lien jusqu’à ce qu’on l’efface', () => {
    pendingShare.set('https://youtu.be/dQw4w9WgXcQ');
    expect(pendingShare.get()).toBe('https://youtu.be/dQw4w9WgXcQ');
    pendingShare.clear();
    expect(pendingShare.get()).toBeNull();
  });

  it('oublie un lien de plus d’un jour', () => {
    vi.useFakeTimers();
    pendingShare.set('https://youtu.be/dQw4w9WgXcQ');
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(pendingShare.get()).toBeNull();
  });
});
