'use client';

import { Callout, Code, CodeBlock, Section } from './docsPrimitives';

export function OiGuideSection({ origin }: { origin: string }) {
  return (
    <Section id="oi" eyebrow="Guide" title="OI & MCP">
      <p>
        OI is the AI in OSIRIS, on your own model key, and it works two ways. <strong>Assist</strong> is a
        conversation (press <kbd>O</kbd>): ask in words, typed or spoken, and OI works the map for you. It flies
        to the place you name, switches the layers on, searches what is live (flights, military aircraft, ships,
        ports and chokepoints, earthquakes, fires, weather, disaster alerts, news, cameras, satellites), marks
        what it finds in cyan with the area it searched, and lists it in cards you can click through. It reads the
        markets, opens panels, and starts forecasts. Each step shows what it did as it does it; choose Navigate,
        Research or Forecast to steer it, or leave it on Auto.
      </p>
      <p>
        <strong>Forecast</strong> is OSIRIS&apos;s prediction engine. Ask it a question and it researches it, builds a
        world model (the actors, where they are, how they relate), and casts the actors who decide the outcome as
        agents, each with what it wants, the levers it can pull and its red lines. Then it plays them against each
        other over simulated time, in dated periods from today to the question&apos;s horizon, in several parallel
        worlds: each period every actor decides its move from what has happened in its world so far, and a world
        engine turns the moves into dated events, the occasional surprise, and where the question now stands. A
        report agent then writes the prediction: how it most likely unfolds, date by date, what each actor does, how
        each world ended, and a calibrated figure with its drivers, scenarios, signposts and dissent. The figure
        takes the shape the question asks for: a probability for a yes-or-no question, a share for each outcome
        when it asks which of several will happen, and an estimate with an 80% range when it asks how much. While
        it runs, it draws itself on the globe as arcs through the sky; every arc and point can be clicked to open
        exactly that piece of the research, and the camera follows the run until you take it.
      </p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {[
          { k: 'Your own key', v: 'OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, xAI, Mistral or Qwen. The key stays in your browser and travels in a header with your requests; the server uses it for your run and never stores or logs it.' },
          { k: 'Cost', v: 'Quick: 4 actors × 3 periods × 2 worlds, about 34 model calls. Standard: 6 × 4 × 3, about 88. Deep: 7 × 4 × 4, about 132. A world that settles early stops spending. Billed by your provider at its own rates.' },
          { k: 'Sharing', v: 'Every run has a link, /?oi=<id>, that replays the whole analysis on the globe for anyone who opens it. Runs are kept for three hours after they finish.' },
          { k: 'Steering', v: 'Whoever started a run holds its token: they alone can inject events into it or stop it. Anyone with a key can question the actors and the report agent.' },
          { k: 'On the globe', v: 'Violet arcs are alignments and cooperation, magenta are rivalries and pressure, indigo is everything in between; evidence from the feeds is a paler wash of its tone, and each move is an arc from the actor that made it to the actor it was aimed at. All three colours are yours to set in the Style Studio (Map layers → OI).' },
          { k: 'Workspace', v: 'Full screen (the expand button, with or without a forecast) opens the OI workspace. On the left, the same Forecast / Assist switch as the panel: the ask form, then the prediction with the report or the execution trace (every step the engine took, timed, with what it produced); or the conversation. In the middle, four views on keys 1 to 4: the live globe; the research graph, after MiroFish, with every actor and cited source and every relation, move and quote between them, filters and a flow layout; the timeline, each simulated world period by period with its events, under the worlds pooled; and sortable tables of actors, moves, events, sources and links. On the right, once there is a run, whatever is selected, as an object with its properties and links. Ctrl+K (⌘K) finds any object by name, and in Assist OI can open the workspace, switch its view and open objects for you.' },
          { k: 'Research', v: 'Before the world model, OI researches the question from sources that can be checked: the reporting (a newsroom of publishers’ own feeds by desk, Yahoo Finance’s newswire for any ticker in play, GDELT and Wikipedia’s Current events, each story with its link and, where the publisher serves it, what the article says; social networks are left out), two years of daily prices for any market price the question turns on, what Polymarket and Manifold price the same question at, Wikipedia background, and the OSIRIS feeds where they are on topic. The actors are the real ones the question turns on (governments, leaders, companies, groups), each played from its own interests; a market is the world they move, never a player.' },
          { k: 'Prices', v: 'A question about a price (a coin, a share, an index, a commodity, a currency) is priced. The instrument’s own daily moves, average trend removed, are resampled into 4,000 paths to the horizon: the statistical baseline. Each simulated world gets its own course for the price, spread across what can happen; the period’s events push it; and the price settles the question in that world. The worlds’ events are then run through the market’s own paths, so three worlds read as a probability, not a tally of three outcomes.' },
          { k: 'What it rests on', v: 'Every prediction is shown beside what can be checked, on one scale: the statistical baseline, the prediction market on the same question (real money, many traders), the simulation priced, how the worlds ended, and the prediction itself, each a click from its source. The report agent is told to move off a liquid market or the baseline only for reasons it can name.' },
          { k: 'Every level', v: 'When a prediction market prices the question as a ladder (reach $160, $180, $200…, dip to $90, $60… by the same date), OI reads the whole ladder and sets it beside its own curve, the chance of trading at every level, rung by rung: where the model sees more upside or downside than the crowd, and where they part most.' },
          { k: 'Its record', v: 'The statistical baseline is scored on the instrument’s own past: on days through five years of prices it forecasts, from the year before each day only, whether the price would trade at levels above and below within the question’s span, against what then happened. A calibration chart shows what it said against how often it happened, with its calibration gap and its Brier score beside hindsight.' },
          { k: 'Sources', v: 'The actors back their moves with quotes from numbered sources: the research’s articles and background, items of the live feed, or passages the world model lifts word for word from your own data. Each quote says which way it pushed the actor and why, and links to where it was published; the report shows the evidence that moved the actors, source by source. Each quote is checked against its source and marked verbatim or paraphrase; an actor’s first move that quotes nothing is sent back once. In the research graph every quote is a dotted thread from the actor to its source, and the report joins at the end with a thread to each source its drivers rest on, so any conclusion can be followed back to the words it came from.' },
          { k: 'Answers', v: 'Every run says what kind it is (binary, choice or number) and gives its answer in words, e.g. "62% YES", "Hold (55%)" or "86.4 USD per barrel (80–92)", alongside the figures.' },
        ].map(row => (
          <div key={row.k} className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5">
            <div className="font-mono text-[11.5px] text-[#B388FF] mb-1.5">{row.k}</div>
            <div className="text-[12.5px] leading-[1.7] text-[var(--text-secondary)]">{row.v}</div>
          </div>
        ))}
      </div>

      <p className="pt-2">From code, start a run, then follow it over Server-Sent Events or wait for it:</p>
      <CodeBlock
        label="Predict over the REST API"
        tabs={[
          {
            label: 'cURL',
            lang: 'bash',
            code: `# Start: answers 202 with the run id, a watch link and a run token
curl -s -X POST ${origin}/api/oi/runs \\
  -H "Content-Type: application/json" \\
  -H "X-OI-Provider: openai" \\
  -H "X-OI-Key: $OPENAI_API_KEY" \\
  -d '{"question": "Will the Fed cut rates at its next meeting?", "depth": "quick"}'

# Wait up to 55 s for the prediction (repeat until status is "done")
curl -s "${origin}/api/oi/runs/RUN_ID?wait=55"

# Or watch it happen
curl -N ${origin}/api/oi/runs/RUN_ID/events`,
          },
        ]}
      />

      <p>
        The same engine is an MCP server at <Code>{`${origin}/api/mcp`}</Code> (Streamable HTTP). Give an agent the
        tools <Code>oi_predict</Code>, <Code>oi_get_run</Code>, <Code>oi_ask</Code>,{' '}
        <Code>oi_inject</Code> and <Code>oi_cancel</Code>, plus <Code>osiris_world_brief</Code> and{' '}
        <Code>osiris_markets</Code> and <Code>osiris_trending</Code>, which are free and need no key. The model key is set once on the connection, as
        headers, so it never appears in the agent&apos;s conversation.
      </p>
      <CodeBlock
        label="Connect an agent"
        tabs={[
          {
            label: 'Hermes',
            lang: 'yaml',
            code: `# ~/.hermes/config.yaml
mcp_servers:
  osiris:
    url: "${origin}/api/mcp"
    headers:
      X-OI-Provider: "anthropic"
      X-OI-Key: "sk-ant-..."
      X-OI-Model: "claude-haiku-4-5-20251001"
    timeout: 300`,
          },
          {
            label: 'Claude Code',
            lang: 'bash',
            code: `claude mcp add --transport http osiris ${origin}/api/mcp \\
  --header "X-OI-Provider: openai" \\
  --header "X-OI-Key: $OPENAI_API_KEY"`,
          },
          {
            label: 'Cursor / JSON',
            lang: 'json',
            code: `{
  "mcpServers": {
    "osiris": {
      "url": "${origin}/api/mcp",
      "headers": {
        "X-OI-Provider": "google",
        "X-OI-Key": "AIza..."
      }
    }
  }
}`,
          },
        ]}
      />
      <Callout tone="info" title="How long a prediction takes">
        A few minutes, depending on depth and provider. <Code>oi_predict</Code> waits for it when the
        client accepts a streamed response, sending progress as each phase and period completes. Over plain JSON it
        waits about 80 seconds, then returns the run id to poll with <Code>oi_get_run</Code> and{' '}
        <Code>wait_seconds</Code>.
      </Callout>
      <p className="text-[12px] text-[var(--text-muted)]">
        The method follows{' '}
        <a href="https://github.com/666ghj/MiroFish" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">MiroFish</a>,
        the open-source swarm-intelligence engine: seed a parallel world from real material, populate it with agents,
        let them interact while you inject variables, then hand the simulation to a report agent. OSIRIS rebuilds that
        method natively for its own feeds and globe; no MiroFish code is used. A simulation, not a guarantee.
      </p>
    </Section>
  );
}
