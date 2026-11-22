import { swipeChoice, swipeHint } from './swipe';

describe('glissé de la carte', () => {
  it('droite = sans moi ok, haut = ensemble, gauche = pas pour moi', () => {
    expect(swipeChoice(120, 10)).toBe('OK_ALONE');
    expect(swipeChoice(-10, -140)).toBe('TOGETHER');
    expect(swipeChoice(-120, -20)).toBe('NOT_INTERESTED');
  });

  it('trop court ou vers le bas : la carte revient', () => {
    expect(swipeChoice(40, 0)).toBeNull();
    expect(swipeChoice(0, -40)).toBeNull();
    expect(swipeChoice(20, 150)).toBeNull();
  });

  it('en diagonale, la direction dominante l’emporte', () => {
    expect(swipeChoice(100, -150)).toBe('TOGETHER');
    expect(swipeChoice(150, -100)).toBe('OK_ALONE');
  });

  it('annonce le choix avant le seuil', () => {
    expect(swipeHint(50, 0)).toBe('OK_ALONE');
    expect(swipeHint(10, 0)).toBeNull();
  });
});
