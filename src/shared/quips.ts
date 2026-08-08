/**
 * The table's reaction to the winning guess.
 *
 * Chosen once on the server and carried in the round result as an id, so every
 * phone and the board show the same line — picking client-side would give each
 * player a different burn and kill the shared joke.
 *
 * Selection is a hash of the round rather than `Math.random`, which keeps the
 * engine pure and makes the choice reproducible in tests.
 */

import type { AnswerFormat } from './types.ts'

export type QuipBucket = 'exact' | 'blazing' | 'decent' | 'rough' | 'wild' | 'allOver'

export interface Quip {
  id: string
  bucket: QuipBucket
  text: string
  /**
   * French. Not a literal translation — these are jokes, and a word-for-word
   * version of a joke is not a joke. Falls back to English when absent.
   */
  textFr?: string
  /**
   * Restricts this line to one question category. Category lines share a pool
   * with the general ones, so they surface as an occasional bonus rather than
   * every single time the category comes up.
   */
  category?: string
}

export const QUIPS: Quip[] = [
  // -- Exact ---------------------------------------------------------------
  { id: 'x1', bucket: 'exact', text: 'Exactly right. Nobody needed to show off like that.', textFr: 'Exactement. Personne ne t’avait demandé de te la raconter.' },
  { id: 'x2', bucket: 'exact', text: 'Dead on. Touch grass.', textFr: 'Pile dessus. Va prendre l’air.' },
  { id: 'x3', bucket: 'exact', text: 'Nailed it to the number. Suspicious, honestly.', textFr: 'Au chiffre près. Louche, quand même.' },
  { id: 'x4', bucket: 'exact', text: 'That’s not a guess. That’s a flex.', textFr: 'Ce n’est pas une estimation. C’est de la vantardise.' },
  { id: 'x5', bucket: 'exact', text: 'Somebody’s been waiting their whole life for this question.', textFr: 'Quelqu’un attendait cette question depuis toujours.' },
  { id: 'x6', bucket: 'exact', text: 'On the nose. We’re all a little uncomfortable.', textFr: 'En plein dedans. On est tous un peu mal à l’aise.' },
  { id: 'x7', bucket: 'exact', text: 'Straight-up scientist behaviour.', category: 'Science', textFr: 'Comportement de scientifique, tout simplement.' },
  { id: 'x8', bucket: 'exact', text: 'Spot on. Someone actually did the reading.', category: 'History', textFr: 'Parfait. Quelqu’un a vraiment fait ses devoirs.' },
  { id: 'x9', bucket: 'exact', text: 'Oh look, this human is a smart one!', textFr: 'Oh, regardez, celui-là est intelligent !' },
  { id: 'x10', bucket: 'exact', text: 'Genuine biological intelligence. Rare sighting.', textFr: 'Intelligence biologique authentique. Observation rare.' },
  { id: 'x11', bucket: 'exact', text: 'Bet you can’t do it again.', textFr: 'Je parie que tu ne peux pas le refaire.' },

  // -- Within 5% -----------------------------------------------------------
  { id: 'b1', bucket: 'blazing', text: 'So close it’s almost rude.', textFr: 'Si proche que c’en est presque insolent.' },
  { id: 'b2', bucket: 'blazing', text: 'Practically psychic.', textFr: 'Pratiquement médium.' },
  { id: 'b3', bucket: 'blazing', text: 'That’s basically it. Round of applause.', textFr: 'C’est quasiment ça. Une salve d’applaudissements.' },
  { id: 'b4', bucket: 'blazing', text: 'Barely missed. Still cooked.', textFr: 'Raté de peu. Grillé quand même.' },
  { id: 'b5', bucket: 'blazing', text: 'Within a whisker. Respect.', textFr: 'À un cheveu près. Respect.' },
  { id: 'b6', bucket: 'blazing', text: 'Close enough that it stings a little.', textFr: 'Assez proche pour que ça picote un peu.' },
  { id: 'b7', bucket: 'blazing', text: 'Locked in. Genuinely locked in.', textFr: 'Concentré. Vraiment concentré.' },
  { id: 'b8', bucket: 'blazing', text: 'Some of you know things. Weird.', textFr: 'Certains d’entre vous savent des choses. Étrange.' },
  { id: 'b9', bucket: 'blazing', text: 'Close enough for NASA.', category: 'Space', textFr: 'Assez proche pour la NASA.' },
  { id: 'b10', bucket: 'blazing', text: 'Okay, that one’s going in the training data.', textFr: 'Bon, celle-là part dans les données d’entraînement.' },
  { id: 'b11', bucket: 'blazing', text: 'Whoa, tryhard alert.', textFr: 'Holà, alerte au premier de la classe.' },
  { id: 'b12', bucket: 'blazing', text: 'Well, isn’t someone an A student.', textFr: 'Eh bien, quelqu’un a eu de bonnes notes.' },
  { id: 'b13', bucket: 'blazing', text: 'You know, using ChatGPT for this is kinda against the spirit of the game.', textFr: 'Tu sais, utiliser ChatGPT pour ça, c’est un peu contraire à l’esprit du jeu.' },
  { id: 'b14', bucket: 'blazing', text: 'I bet you’re real proud of yourself.', textFr: 'Je parie que tu es très fier de toi.' },
  { id: 'b15', bucket: 'blazing', text: 'I bet you’re fun at parties.', textFr: 'Je parie que tu es passionnant en soirée.' },

  // -- Within 20% ----------------------------------------------------------
  { id: 'd1', bucket: 'decent', text: 'Not bad. Not bad at all.', textFr: 'Pas mal. Pas mal du tout.' },
  { id: 'd2', bucket: 'decent', text: 'Solid guess. We’ll allow it.', textFr: 'Estimation solide. On accepte.' },
  { id: 'd3', bucket: 'decent', text: 'In the neighbourhood. Good enough.', textFr: 'Dans le quartier. Ça suffira.' },
  { id: 'd4', bucket: 'decent', text: 'Respectable. Nothing to be ashamed of.', textFr: 'Respectable. Rien dont il faille avoir honte.' },
  { id: 'd5', bucket: 'decent', text: 'That’ll do. Genuinely.', textFr: 'Ça fera l’affaire. Sincèrement.' },
  { id: 'd6', bucket: 'decent', text: 'Decent. You may proceed.', textFr: 'Correct. Vous pouvez continuer.' },
  { id: 'd7', bucket: 'decent', text: 'Somebody was paying attention. Somebody.', textFr: 'Quelqu’un suivait. Quelqu’un.' },
  { id: 'd8', bucket: 'decent', text: 'Fine. That was fine. Moving on.', textFr: 'Bien. C’était bien. On passe.' },
  { id: 'd9', bucket: 'decent', text: 'Seasoned. Not perfect, but seasoned.', category: 'Food', textFr: 'Assaisonné. Pas parfait, mais assaisonné.' },
  { id: 'd10', bucket: 'decent', text: 'Adequate. For a carbon-based life form.', textFr: 'Convenable. Pour une forme de vie à base de carbone.' },

  // -- Within 50% ----------------------------------------------------------
  { id: 'r1', bucket: 'rough', text: 'In the ballpark. Wrong seat, but in the ballpark.', textFr: 'Dans le stade. Mauvaise place, mais dans le stade.' },
  { id: 'r2', bucket: 'rough', text: 'Someone got vaguely close. Vaguely.', textFr: 'Quelqu’un s’est vaguement approché. Vaguement.' },
  { id: 'r3', bucket: 'rough', text: 'That’s a guess, technically.', textFr: 'C’est une estimation, techniquement.' },
  // Proportional wording is avoided here: "half right" is nonsense on a year,
  // where closeness is a gap rather than a ratio.
  { id: 'r4', bucket: 'rough', text: 'Not right enough to clap. Not wrong enough to laugh.', textFr: 'Pas assez juste pour applaudir. Pas assez faux pour rire.' },
  { id: 'r5', bucket: 'rough', text: 'The vibes were there. The number was not.', textFr: 'L’intention était là. Le nombre, non.' },
  { id: 'r6', bucket: 'rough', text: 'We’ll take it. We won’t be proud of it.', textFr: 'On va l’accepter. On n’en sera pas fiers.' },
  { id: 'r7', bucket: 'rough', text: 'Close-ish. Emphasis on the -ish.', textFr: 'Presque. Insistons sur le « presque ».' },
  { id: 'r8', bucket: 'rough', text: 'It’s giving effort. Not accuracy, but effort.', textFr: 'Ça sent l’effort. Pas la précision, mais l’effort.' },
  { id: 'r9', bucket: 'rough', text: 'Right area code, wrong house.', textFr: 'Bon indicatif régional, mauvaise maison.' },
  { id: 'r10', bucket: 'rough', text: 'I’ve seen better. I’ve also seen worse. Mostly better.', textFr: 'J’ai vu mieux. J’ai aussi vu pire. Surtout mieux.' },

  // -- More than 50% off ---------------------------------------------------
  { id: 'w1', bucket: 'wild', text: 'Lol were you even trying?', textFr: 'Mdr vous essayiez vraiment ?' },
  { id: 'w2', bucket: 'wild', text: 'Not a single one of you knew that.', textFr: 'Pas un seul d’entre vous ne le savait.' },
  { id: 'w3', bucket: 'wild', text: 'That’s not a guess, that’s a cry for help.', textFr: 'Ce n’est pas une estimation, c’est un appel au secours.' },
  { id: 'w4', bucket: 'wild', text: 'Absolutely cooked. All of you.', textFr: 'Complètement grillés. Tous.' },
  { id: 'w5', bucket: 'wild', text: 'The best guess was that? Rough crowd.', textFr: 'La meilleure réponse, c’était ça ? Public difficile.' },
  { id: 'w6', bucket: 'wild', text: 'Wildly off. Almost impressively so.', textFr: 'Follement à côté. Presque impressionnant.' },
  { id: 'w7', bucket: 'wild', text: 'Nobody had any idea. Nobody.', textFr: 'Personne n’en avait la moindre idée. Personne.' },
  { id: 'w8', bucket: 'wild', text: 'A swing, and a full miss.', textFr: 'Un swing, et un échec total.' },
  { id: 'w9', bucket: 'wild', text: 'This table has never heard of this fact.', textFr: 'Cette table n’a jamais entendu parler de ce fait.' },
  { id: 'w10', bucket: 'wild', text: 'Collective silence would have been braver.', textFr: 'Le silence collectif aurait été plus courageux.' },
  { id: 'w19', bucket: 'wild', text: 'Wow. And you lot are building AI superintelligence?', textFr: 'Waouh. Et c’est vous qui construisez une superintelligence ?' },
  { id: 'w20', bucket: 'wild', text: 'Yeah, okay. Just let the AI take over at this point.', textFr: 'Ouais, d’accord. Laissez l’IA prendre le relais à ce stade.' },
  { id: 'w21', bucket: 'wild', text: 'I’m a computer and even I’m embarrassed for you.', textFr: 'Je suis un ordinateur et même moi j’ai honte pour vous.' },
  { id: 'w22', bucket: 'wild', text: 'Filing this one under cautionary tale.', textFr: 'Je classe celle-ci dans les récits édifiants.' },
  { id: 'w23', bucket: 'wild', text: 'We both learned something today.', textFr: 'On a tous les deux appris quelque chose aujourd’hui.' },
  { id: 'w24', bucket: 'wild', text: 'Yeah. No.', textFr: 'Ouais. Non.' },
  { id: 'w25', bucket: 'wild', text: 'Wow, and they pay you how much at work?', textFr: 'Waouh, et on te paie combien au travail ?' },
  { id: 'w26', bucket: 'wild', text: 'Good thing this isn’t a job application.', textFr: 'Heureusement que ce n’est pas une candidature.' },
  { id: 'w27', bucket: 'wild', text: 'Good thing most of your job is also making shit up.', textFr: 'Heureusement que ton travail consiste aussi à inventer.' },
  { id: 'w28', bucket: 'wild', text: 'Have you heard of this site called Wikipedia?', textFr: 'Tu connais ce site qui s’appelle Wikipédia ?' },
  { id: 'w29', bucket: 'wild', text: 'Aren’t you glad this wasn’t on the SAT?', textFr: 'Content que ça n’ait pas été au bac ?' },
  { id: 'w30', bucket: 'wild', text: 'An answer even your mother wouldn’t be proud of.', textFr: 'Une réponse dont même ta mère ne serait pas fière.' },
  { id: 'w31', bucket: 'wild', text: 'Have you seen the movie Idiocracy? Just curious.', textFr: 'Tu as vu le film Idiocracy ? Simple curiosité.' },
  { id: 'w11', bucket: 'wild', text: 'Somebody was NOT paying attention in history class.', category: 'History', textFr: 'Quelqu’un ne suivait VRAIMENT pas en cours d’histoire.' },
  { id: 'w12', bucket: 'wild', text: 'And this is why you failed science.', category: 'Science', textFr: 'Et voilà pourquoi tu as raté les sciences.' },
  { id: 'w13', bucket: 'wild', text: 'Please never navigate anything, ever.', category: 'Geography', textFr: 'Ne guide jamais personne, nulle part, jamais.' },
  { id: 'w14', bucket: 'wild', text: 'Not even the right solar system.', category: 'Space', textFr: 'Même pas le bon système solaire.' },
  { id: 'w15', bucket: 'wild', text: 'The animals are disappointed in you.', category: 'Animals', textFr: 'Les animaux sont déçus de vous.' },
  { id: 'w16', bucket: 'wild', text: 'Maybe just keep watching from the couch.', category: 'Sport', textFr: 'Contentez-vous de regarder depuis le canapé.' },
  { id: 'w17', bucket: 'wild', text: 'Read a book. Any book. Please.', category: 'Books', textFr: 'Lis un livre. N’importe lequel. S’il te plaît.' },
  { id: 'w18', bucket: 'wild', text: 'None of you should be near a kitchen.', category: 'Food', textFr: 'Aucun de vous ne devrait approcher une cuisine.' },

  // -- Everyone overshot ---------------------------------------------------
  { id: 'a1', bucket: 'allOver', text: 'Every single one of you went over. Incredible.', textFr: 'Chacun d’entre vous a dépassé. Incroyable.' },
  { id: 'a2', bucket: 'allOver', text: 'Nobody stayed under. Group project failure.', textFr: 'Personne n’est resté en dessous. Échec collectif.' },
  { id: 'a3', bucket: 'allOver', text: 'All too high. Collectively delusional.', textFr: 'Toutes trop hautes. Collectivement délirants.' },
  { id: 'a4', bucket: 'allOver', text: 'You all overshot. Every last one.', textFr: 'Vous avez tous dépassé. Jusqu’au dernier.' },
  { id: 'a5', bucket: 'allOver', text: 'Not one guess survived. Brutal.', textFr: 'Aucune réponse n’a survécu. Brutal.' },
  { id: 'a6', bucket: 'allOver', text: 'Whole table went over. Take a moment.', textFr: 'Toute la table a dépassé. Prenez un moment.' },
  { id: 'a7', bucket: 'allOver', text: 'Big numbers energy. Wrong, but big.', textFr: 'Énergie des grands nombres. Faux, mais grands.' },
  { id: 'a8', bucket: 'allOver', text: 'Everyone aimed high. Everyone missed.', textFr: 'Tout le monde a visé haut. Tout le monde a raté.' },
  { id: 'a9', bucket: 'allOver', text: 'Every last one of you, over. And you wonder why we’re automating things.', textFr: 'Tous, sans exception, au-dessus. Et vous vous demandez pourquoi on automatise.' },
]

/** Bands are `[upper bound, bucket]`, checked in order; anything past is wild. */
type Band = readonly [number, QuipBucket]

/**
 * Years are an interval scale — the zero point is arbitrary, so a ratio means
 * nothing. Guessing 1500 for something in 2000 is "25% off" and also five
 * centuries wrong; only the gap carries any sense of it.
 */
const YEAR_BANDS: readonly Band[] = [
  [3, 'blazing'],
  [12, 'decent'],
  [40, 'rough'],
]

/**
 * A rescue for small answers, where relative error is unfairly brutal: being
 * one off from three is a good guess, not a 33% failure. Applied alongside the
 * ratio, taking whichever is kinder.
 */
const GAP_BANDS: readonly Band[] = [
  [1, 'decent'],
  [3, 'rough'],
]

/** The default for anything measured from a true zero — counts, distances. */
const RATIO_BANDS: readonly Band[] = [
  [0.05, 'blazing'],
  [0.2, 'decent'],
  [0.5, 'rough'],
]

/** Worst to best, for comparing two gradings of the same guess. */
const SEVERITY: readonly QuipBucket[] = ['allOver', 'wild', 'rough', 'decent', 'blazing', 'exact']

function grade(value: number, bands: readonly Band[]): QuipBucket {
  for (const [limit, bucket] of bands) if (value <= limit) return bucket
  return 'wild'
}

const kinder = (a: QuipBucket, b: QuipBucket): QuipBucket =>
  SEVERITY.indexOf(a) >= SEVERITY.indexOf(b) ? a : b

/** How badly the winning guess missed. */
export function bucketFor(
  answer: number,
  winningGuess: number | null,
  format: AnswerFormat = 'plain',
): QuipBucket {
  if (winningGuess === null) return 'allOver'
  if (winningGuess === answer) return 'exact'

  const gap = Math.abs(answer - winningGuess)

  // Years get the gap alone. Letting the ratio have a say here is exactly the
  // bug: it would call half a millennium out a respectable guess.
  if (format === 'year') return grade(gap, YEAR_BANDS)

  // An answer of zero has no meaningful ratio, so `max(…, 1)` keeps it finite
  // and the gap rescue does the real work.
  const ratio = grade(gap / Math.max(Math.abs(answer), 1), RATIO_BANDS)
  return kinder(ratio, grade(gap, GAP_BANDS))
}

/** FNV-1a. Small, dependency-free, and well spread for short keys. */
export function seedFrom(key: string): number {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function pickQuipId(
  bucket: QuipBucket,
  category: string | undefined,
  seed: number,
): string | null {
  const pool = QUIPS.filter((q) => q.bucket === bucket && (!q.category || q.category === category))
  if (pool.length === 0) return null
  return pool[seed % pool.length]!.id
}

export function quipText(id: string | null | undefined): string | null {
  if (!id) return null
  return QUIPS.find((q) => q.id === id)?.text ?? null
}
