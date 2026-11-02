import { describe, expect, it } from 'vitest';
import { endsProblem } from './hook';

const told = 'Hurricane Patricia hit winds of 185 knots in 2015. SIPRI counts 2,051 explosions from 1945 to 1998.';

describe('endsProblem', () => {
  it('passes a hook that tells the fact and an outro that names TAKIP', () => {
    expect(endsProblem({ hook: 'In 2015, Hurricane Patricia hit winds of 185 knots.', outro: 'Every storm since 1842 is on TAKIP.' }, told)).toBeNull();
    expect(endsProblem({ hook: '2,051 nuclear explosions, and every one is on record.', outro: 'See where each one was on TAKIP.' }, told)).toBeNull();
  });

  it('sends back the old hooks: the map praised, the day, hype', () => {
    expect(endsProblem({ hook: 'Nobody believes this map is free. Today: earthquakes.', outro: 'It is all on TAKIP.' }, told)).toMatch(/Nobody believes/);
    expect(endsProblem({ hook: 'I found a map that shows way too much.', outro: 'It is all on TAKIP.' }, told)).toMatch(/I found/);
    expect(endsProblem({ hook: 'This insane storm hit 185 knots off Mexico.', outro: 'It is all on TAKIP.' }, told)).toMatch(/insane/);
  });

  it('reads "World War I" as a war, not as the narrator', () => {
    expect(endsProblem({ hook: 'In 2015, World War I was a century gone.', outro: 'Every war is on TAKIP.' }, told)).toBeNull();
  });

  it('refuses a number the video never says', () => {
    expect(endsProblem({ hook: 'Patricia hit 185 knots, 340 km an hour.', outro: 'Every storm is on TAKIP.' }, told)).toMatch(/340/);
  });

  it('wants a whole outro that names TAKIP once, and the name kept out of the hook', () => {
    expect(endsProblem({ hook: 'In 2015, Hurricane Patricia hit winds of 185 knots.', outro: "That's TAKIP, and honestly," }, told)).toMatch(/whole sentence/);
    expect(endsProblem({ hook: 'In 2015, Hurricane Patricia hit winds of 185 knots.', outro: 'Every storm since 1842, all free.' }, told)).toMatch(/TAKIP exactly once/);
    expect(endsProblem({ hook: 'On TAKIP, Patricia hits 185 knots in 2015.', outro: 'Every storm is on TAKIP.' }, told)).toMatch(/out of the hook/);
  });

  it('keeps tolls out of both lines', () => {
    expect(endsProblem({ hook: 'In 2015, a storm of 185 knots killed thousands.', outro: 'Every storm is on TAKIP.' }, told)).toMatch(/death tolls/);
  });
});
