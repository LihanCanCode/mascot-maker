/** Normalising and classifying the user's free-text character description. */

const LEADING_ARTICLE = /^(a|an|the)(?=\s)/i
const CONNECTORS = new Set(['with', 'in', 'wearing', 'who', 'from', 'of', 'the', 'a', 'an'])

// One place for the subject lists. Humans win ties ("a girl in a fox hat", "a cat girl").
const HUMAN_WORDS = /\b(man|woman|girl|boy|person|guy|lady|kid|child|human|student|wizard|witch|chef|doctor|king|queen|knight|pirate)\b/i
const NON_HUMAN_WORDS =
  /\b(fox|cat|kitten|dog|puppy|robot|dragon|bunny|rabbit|bear|panda|koala|owl|bird|penguin|frog|hamster|mouse|duck|monkey|wolf|lion|tiger|deer|pig|cow|horse|unicorn|alien|monster|ghost|dinosaur|animal|creature)s?\b/i

function looksLikeProperNoun(first: string, next: string | undefined): boolean {
  if (next === undefined) return true
  if (/[A-Z].*[A-Z]/.test(first)) return true
  if (/^[A-Z]/.test(next)) return true
  return CONNECTORS.has(next.toLowerCase())
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * Trimmed, trailing punctuation removed, and a leading capital lowered so the text reads
 * mid-sentence: "An orange fox." -> "an orange fox". Likely proper nouns ("Mario with a cap",
 * "NASA astronaut", "Pikachu") keep their capital.
 */
export function normaliseDescribe(describe: string): string {
  const text = (typeof describe === 'string' ? describe : '').trim().replace(/[.!?,;:\s]+$/, '')
  if (LEADING_ARTICLE.test(text)) return text.replace(LEADING_ARTICLE, (word) => word.toLowerCase())
  const [first = '', next] = text.split(/\s+/, 2)
  if (!/^[A-Z]/.test(first) || looksLikeProperNoun(first, next)) return text
  return lowerFirst(text)
}

/** True when the description clearly names an animal, robot or creature (and no person). */
export function isNonHumanSubject(describe: string): boolean {
  const text = typeof describe === 'string' ? describe : ''
  return !HUMAN_WORDS.test(text) && NON_HUMAN_WORDS.test(text)
}
