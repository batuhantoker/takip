import { describe, expect, it } from 'vitest';
import { outletOf, slugHeadline, topicWords } from './slug';

// Article URLs from the 2026-10-13 00:00–01:00 GDELT exports.
describe('slugHeadline', () => {
  it('reads the slug as words', () => {
    expect(slugHeadline('https://www.aljazeera.com/news/2026/10/12/houthi-missile-attack-targets-saudi-capital-riyadh-for-third-day-in-a-row'))
      .toBe('Houthi missile attack targets saudi capital riyadh for third day in a row');
  });

  it('drops ids before and after the words', () => {
    expect(slugHeadline('https://www.rte.ie/news/2026/1012/1595129-france-supermarket-cyberattack/')).toBe('France supermarket cyberattack');
    expect(slugHeadline('https://www.cbc.ca/news/canada/canadian-cybersecurity-expert-arrested-fbi-shinyhunters-9.7378256'))
      .toBe('Canadian cybersecurity expert arrested fbi shinyhunters');
    expect(slugHeadline('https://www.smh.com.au/world/middle-east/the-hard-to-stop-houthi-missiles-that-might-make-trump-think-twice-about-helping-saudi-arabia-20261013-p614vl.html'))
      .toBe('The hard to stop houthi missiles that might make trump think twice about helping saudi arabia');
    expect(slugHeadline('https://www.bournemouthecho.co.uk/news/26628503.residents-wave-goodbye-barfleur-makes-final-crossing/'))
      .toBe('Residents wave goodbye barfleur makes final crossing');
  });

  it('keeps short codes that are part of the story', () => {
    expect(slugHeadline('http://www.cecildaily.com/ap/world/congos-former-president-kabila-launches-an-anti-government-front-including-m23-rebels/article_02181302-1e32-51c2-b227-cbeb4865b13b.html'))
      .toBe('Congos former president kabila launches an anti government front including m23 rebels');
  });

  it('gives up on URLs without a slug', () => {
    expect(slugHeadline('https://indiankanoon.org/doc/143499534/')).toBeNull();
    expect(slugHeadline('not a url')).toBeNull();
  });
});

describe('topicWords', () => {
  it('leaves out stop words and the words naming the place', () => {
    expect([...topicWords('https://abcnews4.com/news/nation-world/contradicting-trump-russia-says-its-not-interested-in-ceasefire', 'Moscow, Moskva, Russia')])
      .toEqual(['contradicting', 'trump', 'interested', 'ceasefire']);
  });
});

describe('outletOf', () => {
  it('drops www and the port', () => {
    expect(outletOf('https://www.kwqc.com:443/2026/10/12/man-arrested-california-waives-extradition-back-iowa/')).toBe('kwqc.com');
  });
});
