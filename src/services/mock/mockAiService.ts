import type { AiService, Priority } from '../types';

const priorityPatterns: [RegExp, Priority][] = [
  [/\b(quickest|fastest)\b/i, 'fastest'],
  [/\bcheapest\b/i, 'cheapest'],
  [/\bleast walking\b/i, 'walking'],
  [/\bfewest transfers\b/i, 'transfers'],
];

/** Capitalises each word: "pune station" → "Pune Station". */
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Keyword parser standing in for the NLU model. Picks the priority from
 * "quickest/fastest", "cheapest", "least walking", "fewest transfers" and the
 * destination from the text after "to" / "get to" ("Take me home" → "Home").
 */
export function createMockAiService(): AiService {
  return {
    async parseQuery(text) {
      const priority = priorityPatterns.find(([re]) => re.test(text))?.[1];
      const toMatch = /\b(?:get to|to)\s+(?:the\s+)?(.+?)[.?!]*$/i.exec(text.trim());
      const homeMatch = /\b(?:take me|go|head)\s+home\b/i.test(text);
      const to = toMatch?.[1]?.trim() ?? (homeMatch ? 'home' : '');
      if (!to) return null;
      return { to: titleCase(to), priority, source: 'keywords' };
    },
  };
}
