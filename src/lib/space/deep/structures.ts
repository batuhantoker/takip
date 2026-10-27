/**
 * TAKIP — the named clusters, superclusters, walls and voids the space view labels, placed by tools/build-cosmos.mjs
 * (cosmos.json) at the comoving distance of their redshift; here each gets the id its feature, page and 3D link share.
 */

import { msg } from '@/lib/core/i18n/translator';
import cosmos from '../../../../public/data/cosmos/cosmos.json';

export type StructureKind = 'cluster' | 'supercluster' | 'wall' | 'void';

export interface Structure {
  id: string;
  /** As cosmos.json names it. */
  name: string;
  /** What the view and the pages call it, translated. */
  title: string;
  kind: StructureKind;
  /** English Wikipedia title. */
  wiki: string;
  note: string;
  ra: number;
  dec: number;
  z: number;
  mly: number;
}

/** A name's URL slug: accents dropped, lower case, words joined by hyphens (Boötes → bootes). */
export const slugOf = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ABOUT: Record<string, { id?: string; title: string; kind: StructureKind; wiki: string; note: string }> = {
  'Virgo Cluster': { title: msg('Virgo Cluster'), kind: 'cluster', wiki: 'Virgo Cluster', note: msg('The nearest large cluster of galaxies, some 1,300 of them round the giant elliptical M87, whose black hole was the first ever imaged. The Local Group lies on its outskirts.') },
  'Fornax Cluster': { title: msg('Fornax Cluster'), kind: 'cluster', wiki: 'Fornax Cluster', note: msg('The second nearest rich cluster after Virgo, in the southern sky: about 60 large galaxies round the elliptical NGC 1399.') },
  'Centaurus Cluster': { title: msg('Centaurus Cluster'), kind: 'cluster', wiki: 'Centaurus Cluster', note: msg('A large cluster round the giant elliptical NGC 4696, in the Hydra–Centaurus Supercluster.') },
  'Norma Cluster (Great Attractor)': { title: msg('Norma Cluster (Great Attractor)'), id: 'norma-cluster', kind: 'cluster', wiki: 'Norma Cluster', note: msg('A massive cluster hidden behind the plane of the Milky Way, at the heart of the Great Attractor, the concentration of mass that the Local Group and its neighbours are flowing toward.') },
  'Hydra Cluster': { title: msg('Hydra Cluster'), kind: 'cluster', wiki: 'Hydra Cluster', note: msg('A cluster of more than 150 galaxies round the ellipticals NGC 3309 and NGC 3311, in the Hydra–Centaurus Supercluster.') },
  'Perseus Cluster': { title: msg('Perseus Cluster'), kind: 'cluster', wiki: 'Perseus Cluster', note: msg('One of the most massive clusters near us and the brightest in X-rays. Sound waves from its central black hole ripple through its hot gas, 57 octaves below middle C.') },
  'Coma Cluster': { title: msg('Coma Cluster'), kind: 'cluster', wiki: 'Coma Cluster', note: msg('A rich cluster of more than 1,000 galaxies. In 1933 Fritz Zwicky found its galaxies moving too fast for the matter that can be seen: the first sign of dark matter.') },
  'Leo Cluster (Abell 1367)': { title: msg('Leo Cluster (Abell 1367)'), id: 'leo-cluster', kind: 'cluster', wiki: 'Abell 1367', note: msg('A young, irregular cluster joined to the Coma Cluster in the Coma Supercluster, with galaxies still falling into it.') },
  'Hercules Cluster': { title: msg('Hercules Cluster'), kind: 'cluster', wiki: 'Hercules Cluster', note: msg('A cluster rich in spiral and colliding galaxies, part of the Hercules Superclusters.') },
  'Shapley Supercluster': { title: msg('Shapley Supercluster'), kind: 'supercluster', wiki: 'Shapley Supercluster', note: msg('The greatest concentration of galaxies within a billion light-years, more than 8,000 of them, pulling on the Local Group from beyond the Great Attractor.') },
  'Pisces–Perseus Supercluster': { title: msg('Pisces–Perseus Supercluster'), id: 'pisces-perseus-supercluster', kind: 'supercluster', wiki: 'Perseus–Pisces Supercluster', note: msg('One of the two largest structures near us, a chain of clusters across the northern sky from Pisces to Perseus, across the sky from the Great Attractor.') },
  'CfA2 Great Wall': { title: msg('CfA2 Great Wall'), kind: 'wall', wiki: 'CfA2 Great Wall', note: msg('A sheet of galaxies about 500 million light-years long, found by the CfA2 redshift survey in 1989, one of the first great walls mapped. It runs through the Coma Cluster, where it is placed here.') },
  'Sloan Great Wall': { title: msg('Sloan Great Wall'), kind: 'wall', wiki: 'Sloan Great Wall', note: msg('A wall of galaxies more than a billion light-years long, found by the Sloan Digital Sky Survey in 2003. It is placed here on its richest supercluster.') },
  'Boötes Void': { title: msg('Boötes Void'), kind: 'void', wiki: 'Boötes Void', note: msg('One of the largest voids known, about 330 million light-years across, found in 1981. Only some 60 galaxies have been found inside it.') },
  // The Local Void's feature, note and all, is lib/space/deep/features.ts's own.
  'Local Void': { title: msg('Local Void'), id: 'local-void', kind: 'void', wiki: 'Local Void', note: '' },
};

export const STRUCTURES: Structure[] = cosmos.structures.map(s => {
  const about = ABOUT[s.name];
  if (!about) throw new Error(`structures: nothing said about ${s.name}`);
  return { ...s, id: about.id ?? slugOf(s.name), title: about.title, kind: about.kind, wiki: about.wiki, note: about.note };
});

export const structureByName = (name: string) => STRUCTURES.find(s => s.name === name) ?? null;
