import { describe, expect, it } from 'vitest';
import { chronicleToll } from './chronicle';
import { undatedIn } from './events';
import { glibIn, tollIn } from '../narrate/style';

describe('tollIn', () => {
  it('refuses a line that tells a toll', () => {
    expect(tollIn(['Krakatau erupts in 1883, killing 36,417 people.'])).toMatch(/killing/);
    expect(tollIn(['Haiti, 2010: 316,000 deaths.'])).toMatch(/deaths/);
    expect(tollIn(['Pelee wipes out 28,000 lives in 1902.'])).toMatch(/lives/);
  });
  it('passes a line told by physical size', () => {
    expect(tollIn(['Chile, 1960: magnitude 9.5, the strongest on the map.', 'Tambora, 1815: explosivity 7 of 8.'])).toBeNull();
  });
});

describe('chronicleToll', () => {
  it('refuses mass deaths told by a number or as most', () => {
    expect(chronicleToll(['Two atomic bombs killed 150,000 to 246,000 people, mostly civilians.'])).toMatch(/atomic/);
    expect(chronicleToll(['After four hours and 94 deaths, the Bastille fell.'])).toMatch(/Bastille/);
    expect(chronicleToll(['Harald Hardrada and most Norwegians are killed.'])).toMatch(/Hardrada/);
  });
  it('lets a single named death through', () => {
    expect(chronicleToll(["In Nebuchadnezzar's palace in Babylon, he dies at 32.", 'Within weeks, Baghdad fell and its caliph was killed.'])).toBeNull();
  });
});

describe('glibIn', () => {
  it('refuses idioms that make light of a disaster', () => {
    expect(glibIn(["Let's watch the world burn."])).toMatch(/world burn/);
    expect(glibIn(["Let's watch the planet shake."])).toMatch(/planet shake/);
    expect(glibIn(["Final score: Norway's Amundsen beat Scott's British party by five weeks."])).toMatch(/Final score/);
  });
  it('passes a plain hook', () => {
    expect(glibIn(['Today: great fires through history.', "Let's watch Africa redrawn."])).toBeNull();
  });
});

describe('undatedIn', () => {
  const legs = [{ from: 1957, to: 1979, count: 1520, where: ['Plesetsk (724)', 'Baikonur (402)'] }];
  it('refuses a count without its stretch', () => {
    expect(undatedIn(legs, { 'leg-1': 'Plesetsk launches 724 rockets, more than anywhere.' })).toMatch(/From 1957 to 1979/);
    expect(undatedIn(legs, { 'leg-1': 'In 1979, Plesetsk launches 724 rockets.' })).toMatch(/count/);
  });
  it('refuses an event without its year', () => {
    expect(undatedIn(legs, { 'leg-1': 'Sputnik 1 lifts off from Baikonur.' })).toMatch(/year/);
  });
  it('passes a count with its stretch, and an event with its year', () => {
    expect(undatedIn(legs, { 'leg-1': 'From 1957 to 1979, Plesetsk launches 724 rockets, more than anywhere.' })).toBeNull();
    expect(undatedIn(legs, { 'leg-1': 'In 1957, Sputnik 1 lifts off from Baikonur.' })).toBeNull();
    expect(undatedIn(legs, { 'leg-1': 'From 1957 to 1980, 1,520 launches.' })).toBeNull();
    expect(undatedIn([{ from: 1960, to: 1969, count: 706, where: [] }], { 'leg-1': 'The 1960s bring 706 explosions.' })).toBeNull();
    expect(undatedIn([{ from: 1850, to: 1889, count: 30, where: ['Indonesia (6)'] }], { 'leg-1': 'Krakatau blows in 1883, a 6 out of 8.' })).toBeNull();
  });
});
