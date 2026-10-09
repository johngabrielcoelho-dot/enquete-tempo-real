import { describe, expect, it } from 'vitest';
import { percentages, pluralVotes, pollIdFromUrl, totalVotes } from '../src/util';

const opts = (...votes: number[]) => votes.map((v, i) => ({ id: String(i), text: `o${i}`, votes: v }));

describe('totalVotes', () => {
  it('soma os votos de todas as opções', () => {
    expect(totalVotes(opts(3, 2, 0))).toBe(5);
  });
});

describe('percentages', () => {
  it('é zero para todas as opções quando não há votos', () => {
    expect(percentages(opts(0, 0))).toEqual([0, 0]);
  });

  it('calcula a porcentagem arredondada', () => {
    expect(percentages(opts(1, 2))).toEqual([33, 67]);
    expect(percentages(opts(5, 0))).toEqual([100, 0]);
  });
});

describe('pluralVotes', () => {
  it('usa singular e plural', () => {
    expect(pluralVotes(0)).toBe('0 votos');
    expect(pluralVotes(1)).toBe('1 voto');
    expect(pluralVotes(7)).toBe('7 votos');
  });
});

describe('pollIdFromUrl', () => {
  it('lê o id da query string', () => {
    expect(pollIdFromUrl('?id=abc-123')).toBe('abc-123');
  });

  it('retorna null sem id ou com id vazio', () => {
    expect(pollIdFromUrl('')).toBeNull();
    expect(pollIdFromUrl('?id=')).toBeNull();
    expect(pollIdFromUrl('?id=%20')).toBeNull();
  });
});
