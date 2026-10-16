/** The tools that start and show a TI forecast. */
import type { ToolDef } from './define';

export const FORECAST_DEFS = {
  forecast: {
    name: 'forecast', title: 'Start a forecast', surfaces: ['ti'], readOnly: false,
    about: 'Start a TI prediction: TI researches the question, casts the actors who decide it, and plays them against each other over dated periods to the horizon in several parallel simulated worlds, then writes the predicted path, what each actor does, and a calibrated figure (a probability, shares per outcome, or an estimate with a range). It makes 30 to 130 model calls on the reader\'s key, so only when they ask for a forecast, prediction or odds, or chose Forecast mode. Phrase the question so it resolves by a date.',
    params: { question: { type: 'string', about: 'The question.', required: true }, depth: { type: 'string', enum: ['quick', 'standard', 'deep'], about: 'How big a run.' } },
  },
  workspace: {
    name: 'workspace', title: 'The TI workspace', surfaces: ['ti'], readOnly: false,
    about: 'Open the full-screen TI workspace (open: false closes it) and choose what its centre shows: the live globe, or for the current forecast its research graph, the timeline of its simulated worlds, or tables of its objects. graph, timeline and table need a forecast.',
    params: { open: { type: 'boolean', about: 'Open or close.' }, view: { type: 'string', enum: ['globe', 'graph', 'timeline', 'table'], about: 'What the centre shows.' } },
  },
  select: {
    name: 'select', title: 'Open a forecast object', surfaces: ['ti'], readOnly: false,
    about: 'Open an object of the current forecast by name: an actor, a simulated world ("World A"), an event, a source, a scenario or a signpost (see the forecast\'s objects in CONTEXT). It opens in the object view and lights up on the globe and in the graph.',
    params: { name: { type: 'string', about: 'The object\'s name.', required: true } },
  },
} satisfies Record<string, ToolDef>;
