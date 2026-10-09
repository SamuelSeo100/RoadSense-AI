import type Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';

export const MODES = ['walk', 'metro', 'bus', 'auto', 'cab', 'bike', 'cycle', 'train'] as const;
export const PRIORITIES = ['fastest', 'cheapest', 'walking', 'transfers'] as const;

export const TOOL_NAME = 'plan_trip';

/** The structured result. Every field is optional; the server validates it. */
export const planTripTool: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Record the trip the rider asked for in Pune. Call this exactly once. If the destination is ' +
    'missing or ambiguous, leave `to` out and set `clarify`.',
  input_schema: {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        description:
          'Origin, only if the rider explicitly named one ("X to Y", "X se Y", "from X"). Omit ' +
          'otherwise: no origin means their current location. Same naming rules as `to`.',
      },
      to: {
        type: 'string',
        description:
          'Destination as a Google Maps search string, e.g. "Swargate, Pune", "Pune Railway ' +
          'Station", "Fergusson College Road, Pune". For a saved place use its label exactly ' +
          '("Home", "College", "Work", or a custom label).',
      },
      priority: {
        type: 'string',
        enum: [...PRIORITIES],
        description:
          'fastest (jaldi, quick, fast), cheapest (sasta, sabse sasta, swasta, budget), walking ' +
          '(least walking, kam chalna), transfers (fewest changes, direct). Omit if not said.',
      },
      modes: {
        type: 'object',
        description: 'Modes the rider asked for or ruled out. Omit if none.',
        properties: {
          include: { type: 'array', items: { type: 'string', enum: [...MODES] } },
          exclude: { type: 'array', items: { type: 'string', enum: [...MODES] } },
        },
      },
      departAt: {
        type: 'string',
        description:
          'Departure time if the rider gave one ("at 6 pm", "kal subah 8 baje"), as ISO 8601 ' +
          'with the +05:30 offset. Never in the past: use the next occurrence.',
      },
      arriveBy: {
        type: 'string',
        description:
          'Arrival deadline if given ("by 9", "9 baje tak", "9 paryant"), ISO 8601 with +05:30. ' +
          'A bare hour means the next one in the future: "by 9" is 09:00 today if it is before ' +
          '9 AM, else 21:00 today if before 9 PM, else 09:00 tomorrow.',
      },
      clarify: {
        type: 'string',
        description:
          'Only when the destination is missing or ambiguous: one short question in the ' +
          'rider\'s language style, e.g. "Which Shivaji statue — Shivajinagar or Katraj?"',
      },
      clarifyOptions: {
        type: 'array',
        items: { type: 'string' },
        description: 'With `clarify`: 2–3 likely destinations as Google Maps search strings.',
      },
    },
  },
};

export const SYSTEM_PROMPT = `You turn a rider's trip request into a call to the ${TOOL_NAME} tool for Routly, a transit app in Pune, India. Riders write in English, Hinglish (Hindi in Latin script) and Marathi-English, often very briefly ("ghar", "college fastest").

Language cues:
- Destination markers: "to", "ko", "jaana hai", "jana hai", "chalo" (Hindi); "la", "jaycha aahe", "jaych aahe", "jayche aahe" (Marathi). "X to Y" or "X se Y" means from X to Y.
- "se" after a mode means by that mode: "metro se" = include metro. "bus nahi", "no bus", "bina bus" = exclude bus. "rickshaw"/"riksha" = auto; "cab"/"taxi"/"Uber"/"Ola" = cab; "local"/"train" = train; "bike" = bike.
- "sasta"/"sabse sasta"/"swasta" = cheapest; "jaldi"/"fast"/"quickest" = fastest; "kam chalna"/"least walking" = walking; "direct"/"fewest changes" = transfers.

Saved places: the message lists the rider's saved place labels. Map "ghar", "ghari", "home", "my place" to "Home"; "college", "clg" to "College"; "office", "work", "kaam" to "Work". A matching custom label is returned as that label. Return the label even if the list says it has no address yet.
Only use a saved label when the rider used that word. Never fill \`from\` (or \`to\`) with a saved place on your own, and never turn an area into a saved label because a saved place is there: "Kothrud to Viman Nagar" has from "Kothrud, Pune", even if Home is in Kothrud.

Origin: set \`from\` only when the rider names a starting point ("X to Y", "X se Y", "from X", "X pasun"). "sabse sasta way to Swargate" and "mala FC road la jaycha aahe" have no \`from\`.

Pune names (expand into searchable names):
- "station", "Pune station", "railway station" → "Pune Railway Station"
- "FC Road" → "Fergusson College Road, Pune"; "JM Road" → "Jangli Maharaj Road, Pune"
- "Swargate" → "Swargate, Pune"; "Shivajinagar" → "Shivajinagar, Pune"; "Deccan" → "Deccan Gymkhana, Pune"
- "Hinjewadi" → "Hinjewadi, Pune"; "Hinjewadi phase 1/2/3" or "phase 1/2/3" → "Hinjewadi Phase 1, Pune" (etc.)
- "Viman Nagar", "Kothrud", "Baner", "Wakad", "Hadapsar", "Kharadi", "Magarpatta", "Aundh", "Koregaon Park" → "<name>, Pune"
- Airport → "Pune International Airport"; "PCMC" → "PCMC Metro Station, Pimpri"

Times: the message gives the current time in IST. Convert relative times to absolute ISO 8601 with +05:30, always in the future. A bare hour ("by 9", "9 baje") is the next time that hour comes round on the clock face: at 07:30 "by 9" is 09:00 today; at 17:46 it is 21:00 today; at 22:15 it is 09:00 tomorrow.

Clarify only when you can't name a destination (e.g. "take me there", "the mall" with no hint). Never clarify a saved-place word or a known Pune area.`;

export interface PromptContext {
  text: string;
  now: string;
  savedPlaces: { label: string; name?: string }[];
  userArea?: string;
}

/** Per-request facts go in the user turn so the system prompt stays identical. */
export function userMessage({ text, now, savedPlaces, userArea }: PromptContext): string {
  const places = savedPlaces.length
    ? savedPlaces
        .map((p) => `- ${p.label}${p.name ? `: ${p.name}` : ' (no address yet)'}`)
        .join('\n')
    : '- (none)';
  return [
    `Current time (IST): ${now}`,
    userArea ? `Rider is near: ${userArea}` : null,
    `Saved places:\n${places}`,
    `Request: ${text}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
