import type { ApiGroup } from '../../api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const GRAPH: ApiGroup = {
  id: 'graph',
  title: msg('Entity graph'),
  blurb: 'Link analysis over entities surfaced elsewhere in the platform.',
  endpoints: [
    {
      path: '/api/v1/entity/expand',
      method: 'GET',
      summary: 'Expands one entity into its graph neighbours: the operators, owners, people, countries and sanctions entries connected to it.',
      params: [
        { name: 'type', required: true, desc: 'aircraft, vessel, company, person, ip or country; any case.', example: 'aircraft' },
        { name: 'id', required: true, desc: 'The entity, 2 to 200 characters.', example: 'N381DN' },
        { name: 'registration', desc: 'An aircraft registration, passed to the resolver.' },
        { name: 'model', desc: 'An aircraft model, passed to the resolver.' },
        { name: 'icao24', desc: "An aircraft's ICAO address, passed to the resolver." },
      ],
      returns: ['nodes', 'links', 'entity', 'source', 'sanctions_index_size', 'wikidata_cache_hits', 'timestamp'],
      notes: 'Served by the accounts API (see /api/v1/docs), which asks the intelligence service. 30 requests a minute per caller; 502 when the service cannot be reached. Needs an API key unless /api/v1/key-policy lists it as open.',
    },
  ],
};
