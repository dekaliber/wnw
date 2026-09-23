/**
 * UI copy, in both languages.
 *
 * One flat catalog keyed by a short id, rather than translations scattered
 * beside each component: it makes a missing French string a type error rather
 * than something you discover mid-game, and it puts the two languages on
 * adjacent lines where they are easy to compare.
 *
 * Anything with a runtime value in it is a function, so the value lands in the
 * right place for each language rather than being concatenated in English word
 * order.
 */

export type Locale = 'en' | 'fr'

export const LOCALES: Locale[] = ['en', 'fr']

const en = {
  // -- join --------------------------------------------------------------
  tagline: 'Everyone guesses. Everyone bets. Nobody has to know anything.',
  yourName: 'Your name',
  namePlaceholder: 'Witless Wonder',
  roomCode: 'Room code',
  joinGame: 'Join game',
  or: 'or',
  startNewGame: 'Start a new game',
  roomEnded: (code: string) => `Room ${code} has ended. Start a new one, or ask for the current code.`,
  boardHint: 'Putting the board on a TV? Open /board on the laptop.',

  // -- lobby -------------------------------------------------------------
  room: 'Room',
  atTheTable: 'At the table',
  host: 'host',
  you: 'you',
  away: 'away',
  ready: 'ready',
  notReady: 'not ready',
  rulesLinkLead: 'While you’re waiting — ',
  rulesLinkStrong: 'how to play',
  settings: 'Settings',
  questionsSetting: 'Questions',
  timers: 'Timers',
  excludeImperial: 'Skip imperial units',
  excludeImperialHint:
    'Leaves out questions answered in feet, miles, pounds and Fahrenheit. Worth turning on if anyone at the table thinks in metric.',
  secondsToGuess: 'Seconds to guess',
  secondsToBet: 'Seconds to bet',
  timerHint:
    'Guessing and betting only end when the clock runs out or you move things along yourself — so nobody’s phone waking up late gets skipped.',
  needPlayers: (n: number) => `Need ${n} players`,
  waitingOnNames: (names: string) => `Waiting on ${names}`,
  startQuestions: (n: number) => `Start ${n} questions`,
  waitingForHost: 'Waiting for the host to start…',
  readyWhenYouAre: 'Ready when you are.',
  imReady: 'I’m ready',
  readyTapUndo: '✓ Ready — tap to undo',

  // -- round -------------------------------------------------------------
  questionN: (n: number) => `Question ${n}`,
  ofN: (n: number) => `of ${n}`,
  suddenDeath: 'Sudden death',
  placeYourChips: 'place your chips',
  chips: 'chips',
  yourGuess: 'Your guess',
  guessPlaceholder: 'Your guess',
  closestWithoutGoingOver: 'Closest without going over wins the slot.',
  lockIn: 'Lock in',
  lockInValue: (value: string) => `Lock in ${value}`,
  inWaitingForRest: (acted: number, total: number) =>
    `${acted} of ${total} in — waiting for the rest…`,
  tiebreakBystander: 'The leaders are tied. They are settling it — closest without going over.',
  moveToBetting: 'Move to betting',
  revealAnswer: 'Reveal answer',

  // -- betting -----------------------------------------------------------
  allAnswersTooHigh: 'All Answers Too High',
  empty: 'empty',
  takeBack: 'Take back',
  raise: 'Raise',
  allIn: 'All in',
  chipsLeft: (n: number) => `${n} wager chip${n === 1 ? '' : 's'} left`,
  unusedChipTitle: 'You still have a wager chip',
  unusedChipBody:
    'Wager chips always come back, win or lose — placing it can only win you chips, never cost you any. Sure about one answer? Put both chips on the same slot to double down.',
  unusedChipPlace: 'Back to betting',
  unusedChipLockAnyway: 'Lock in anyway',
  chipsToRaise: (n: number) => `${n} chips to raise`,
  lockedTapToChange: (locked: number, total: number) =>
    `Locked in — tap to change (${locked}/${total})`,

  // -- reveal ------------------------------------------------------------
  theAnswerIs: 'The answer is',
  everyoneWentOver: 'Everyone went over — All Answers Too High pays 6 to 1.',
  winsAt: (value: string, odds: number) => `${value} wins at ${odds} to 1.`,
  takesIt: (name: string) => `${name} takes it.`,
  stillTied: 'Still tied — going again.',
  fromYourChips: (n: number) => `+${n} from your chips`,
  guessWonSlot: (n: number) => `+${n} your guess won the slot`,
  lostOnRaise: (n: number) => `${n} on the raise`,
  chipsReturned: 'Chips returned. No damage.',
  continueLabel: 'Continue',
  finalScores: 'Final scores',
  nextQuestion: (n: number) => `Question ${n}`,
  waitingForHostShort: 'Waiting for the host…',

  // -- game over ---------------------------------------------------------
  youWin: 'You win',
  winner: 'Winner',
  playAgain: 'Play again',
  waitingForRematch: 'Waiting for the host to start a rematch…',
  leaveRoom: 'Leave room',

  // -- restart / confirm -------------------------------------------------
  restartTitle: 'Restart the game?',
  restartBodyMid: (n: number) =>
    `This ends question ${n} and sends everyone back to the settings screen. Everyone’s chips are reset to zero.`,
  restartBodyIdle:
    'Everyone goes back to the settings screen and everyone’s chips are reset to zero.',
  restart: 'Restart',
  cancel: 'Cancel',
  restartAria: 'Restart the game',

  // -- rules -------------------------------------------------------------
  back: 'Back',
  next: 'Next',
  gotIt: 'Got it',
  close: 'Close',
  rulesTitle: 'How to play',
  rules: [
    {
      step: 'The idea',
      title: 'Nobody has to know anything',
      body: 'Every question has a number for an answer. You write a guess, then bet on whichever guess looks best — including someone else’s. Most chips at the end wins.',
    },
    {
      step: 'Step 1',
      title: 'Write a guess',
      body: 'A question appears and you tap in a number. All the guesses then line up on the board, smallest to largest. The one that wins is the closest to the real answer without going over — Price is Right rules.',
    },
    {
      step: 'Step 2',
      title: 'Place your chips',
      body: 'You get two chips. Put both on one guess, or split them across two. If you reckon everyone overshot, there is a slot for that too.',
    },
    {
      step: 'Step 3',
      title: 'Raise, if you dare',
      body: 'Each slot pays different odds. You can raise on top of your chips with any additional chips you’ve won. Your two chips always come back — only what you raise can be lost.',
    },
    {
      step: 'Step 4',
      title: 'Collect',
      body: 'Bet on the winning slot and you get your stake back plus the odds. If your own guess is the one that won, you collect 3 bonus chips on top. Highest pile after the last question takes it.',
    },
  ],

  // -- board (the shared TV surface) --------------------------------------
  boardAnswer: 'Answer',
  boardScanToJoin: 'Scan to join',
  boardOrTypeItIn: '…or type it in',
  boardInCount: (acted: number, total: number) => `of ${total} in`,
  boardAllIn: 'All in.',
  boardAllInWaitingHost: 'All in — waiting on the host to move on.',
  boardNoWifi: 'No Wi-Fi address',
  boardSoundPrompt: 'Click anywhere to enable the 10-second warning sound',

  // -- board scoring playthrough -------------------------------------------
  tallyNoBets: 'No chips on the mat',
  tallyChips: (n: number) => `${n} chip${n === 1 ? '' : 's'}`,
  tallyBetOn: (value: string) => `Bet on ${value}`,
  // "Wager chips" because they are the part of a bet that always comes back.
  tallyBet: (n: number) => `${n} wager chip${n === 1 ? '' : 's'}`,
  tallyRaised: (n: number) => `raised ${n}`,
  tallyPays: (odds: number) => `pays ${odds} to 1`,
  tallyWon: (n: number) => `won ${n}`,
  // "To the bank" because playtesters assumed a loss went to another player.
  tallyLost: (n: number) => `lost ${n} to the bank`,
  // The chips always come back, so an unraised miss costs nothing.
  tallyLostNothing: 'lost 0',
  slotWinner: 'Winner',
  summaryBefore: 'Before',
  summaryChange: 'Round',
  summaryAfter: 'Now',
  tallyBonus: (value: string) => `wrote the winning guess, ${value}`,
  tallyBonusTitle: 'Bonus',
  tallyNextPlayer: 'Next player',
  tallyShowStandings: 'Show standings',

  // -- connection --------------------------------------------------------
  reconnecting: 'Reconnecting…',
  reconnectingHint: 'Hold on — your chips are safe.',
  reconnected: 'Back in',
  couldNotJoin: 'Could not join — please reload and try again.',
}

/** Shaped identically to `en`; TypeScript enforces that below. */
const fr: typeof en = {
  // -- join --------------------------------------------------------------
  tagline: 'Tout le monde devine. Tout le monde parie. Personne n’a besoin de savoir quoi que ce soit.',
  yourName: 'Votre prénom',
  namePlaceholder: 'Génie Anonyme',
  roomCode: 'Code du salon',
  joinGame: 'Rejoindre',
  or: 'ou',
  startNewGame: 'Créer une partie',
  roomEnded: (code: string) =>
    `Le salon ${code} est terminé. Créez-en un nouveau, ou demandez le code actuel.`,
  boardHint: 'Vous affichez le plateau sur une TV ? Ouvrez /board sur l’ordinateur.',

  // -- lobby -------------------------------------------------------------
  room: 'Salon',
  atTheTable: 'À la table',
  host: 'hôte',
  you: 'vous',
  away: 'absent',
  ready: 'prêt',
  notReady: 'pas prêt',
  rulesLinkLead: 'En attendant — ',
  rulesLinkStrong: 'comment jouer',
  settings: 'Réglages',
  questionsSetting: 'Questions',
  timers: 'Minuteurs',
  excludeImperial: 'Ignorer les unités impériales',
  excludeImperialHint:
    'Exclut les questions dont la réponse est en pieds, miles, livres ou Fahrenheit. À activer si quelqu’un à la table raisonne en métrique.',
  secondsToGuess: 'Secondes pour deviner',
  secondsToBet: 'Secondes pour parier',
  timerHint:
    'Les phases de devinette et de pari ne se terminent qu’à la fin du chrono ou quand vous les faites avancer — personne n’est sauté parce que son téléphone s’est réveillé trop tard.',
  needPlayers: (n: number) => `Il faut ${n} joueurs`,
  waitingOnNames: (names: string) => `En attente de ${names}`,
  startQuestions: (n: number) => `Lancer ${n} questions`,
  waitingForHost: 'En attente du lancement par l’hôte…',
  readyWhenYouAre: 'Quand vous voulez.',
  imReady: 'Je suis prêt',
  readyTapUndo: '✓ Prêt — appuyez pour annuler',

  // -- round -------------------------------------------------------------
  questionN: (n: number) => `Question ${n}`,
  ofN: (n: number) => `sur ${n}`,
  suddenDeath: 'Mort subite',
  placeYourChips: 'placez vos jetons',
  chips: 'jetons',
  yourGuess: 'Votre réponse',
  guessPlaceholder: 'Votre réponse',
  closestWithoutGoingOver: 'Le plus proche sans dépasser remporte la case.',
  lockIn: 'Valider',
  lockInValue: (value: string) => `Valider ${value}`,
  inWaitingForRest: (acted: number, total: number) =>
    `${acted} sur ${total} — en attente des autres…`,
  tiebreakBystander:
    'Les meneurs sont à égalité. Ils se départagent — le plus proche sans dépasser.',
  moveToBetting: 'Passer aux paris',
  revealAnswer: 'Révéler la réponse',

  // -- betting -----------------------------------------------------------
  allAnswersTooHigh: 'Toutes les réponses trop hautes',
  empty: 'vide',
  takeBack: 'Reprendre',
  raise: 'Miser',
  allIn: 'Tapis',
  chipsLeft: (n: number) =>
    `${n} jeton${n === 1 ? '' : 's'} de pari restant${n === 1 ? '' : 's'}`,
  unusedChipTitle: 'Il vous reste un jeton de pari',
  unusedChipBody:
    'Les jetons de pari reviennent toujours, gagné ou perdu — le placer ne peut que vous rapporter, jamais vous coûter. Sûr d’une réponse ? Mettez vos deux jetons sur la même case pour doubler la mise.',
  unusedChipPlace: 'Retour aux paris',
  unusedChipLockAnyway: 'Valider quand même',
  chipsToRaise: (n: number) => `${n} jetons à miser`,
  lockedTapToChange: (locked: number, total: number) =>
    `Validé — appuyez pour changer (${locked}/${total})`,

  // -- reveal ------------------------------------------------------------
  theAnswerIs: 'La réponse est',
  everyoneWentOver: 'Tout le monde a dépassé — « Toutes trop hautes » paie 6 contre 1.',
  winsAt: (value: string, odds: number) => `${value} gagne à ${odds} contre 1.`,
  takesIt: (name: string) => `${name} l’emporte.`,
  stillTied: 'Toujours à égalité — on recommence.',
  fromYourChips: (n: number) => `+${n} grâce à vos jetons`,
  guessWonSlot: (n: number) => `+${n} votre réponse a remporté la case`,
  lostOnRaise: (n: number) => `${n} sur la mise`,
  chipsReturned: 'Jetons rendus. Aucun dégât.',
  continueLabel: 'Continuer',
  finalScores: 'Scores finaux',
  nextQuestion: (n: number) => `Question ${n}`,
  waitingForHostShort: 'En attente de l’hôte…',

  // -- game over ---------------------------------------------------------
  youWin: 'Vous gagnez',
  winner: 'Gagnant',
  playAgain: 'Rejouer',
  waitingForRematch: 'En attente d’une revanche lancée par l’hôte…',
  leaveRoom: 'Quitter le salon',

  // -- restart / confirm -------------------------------------------------
  restartTitle: 'Recommencer la partie ?',
  restartBodyMid: (n: number) =>
    `Cela met fin à la question ${n} et renvoie tout le monde à l’écran des réglages. Les jetons de chacun sont remis à zéro.`,
  restartBodyIdle:
    'Tout le monde retourne à l’écran des réglages et les jetons de chacun sont remis à zéro.',
  restart: 'Recommencer',
  cancel: 'Annuler',
  restartAria: 'Recommencer la partie',

  // -- rules -------------------------------------------------------------
  back: 'Retour',
  next: 'Suivant',
  gotIt: 'C’est compris',
  close: 'Fermer',
  rulesTitle: 'Comment jouer',
  rules: [
    {
      step: 'L’idée',
      title: 'Personne n’a besoin de savoir',
      body: 'Chaque question a un nombre pour réponse. Vous écrivez une estimation, puis vous pariez sur celle qui vous semble la meilleure — y compris celle d’un autre. Le plus de jetons à la fin l’emporte.',
    },
    {
      step: 'Étape 1',
      title: 'Proposez un nombre',
      body: 'Une question apparaît et vous saisissez un nombre. Toutes les réponses s’alignent ensuite sur le plateau, de la plus petite à la plus grande. Celle qui gagne est la plus proche de la vraie réponse sans la dépasser.',
    },
    {
      step: 'Étape 2',
      title: 'Placez vos jetons',
      body: 'Vous avez deux jetons. Mettez-les tous les deux sur une réponse, ou répartissez-les sur deux. Si vous pensez que tout le monde a dépassé, il y a une case pour ça aussi.',
    },
    {
      step: 'Étape 3',
      title: 'Misez, si vous osez',
      body: 'Chaque case paie une cote différente. Vous pouvez miser en plus de vos jetons avec ceux que vous avez déjà gagnés. Vos deux jetons vous reviennent toujours — seule votre mise peut être perdue.',
    },
    {
      step: 'Étape 4',
      title: 'Encaissez',
      body: 'Pariez sur la case gagnante et vous récupérez votre mise plus la cote. Si c’est votre propre réponse qui gagne, vous empochez 3 jetons bonus en plus. Le plus gros tas après la dernière question l’emporte.',
    },
  ],

  // -- board (the shared TV surface) --------------------------------------
  boardAnswer: 'Réponse',
  boardScanToJoin: 'Scannez pour rejoindre',
  boardOrTypeItIn: '…ou saisissez-le',
  boardInCount: (acted: number, total: number) => `sur ${total}`,
  boardAllIn: 'Tout le monde a joué.',
  boardAllInWaitingHost: 'Tout le monde a joué — en attente de l’hôte.',
  boardNoWifi: 'Aucune adresse Wi-Fi',
  boardSoundPrompt: 'Cliquez n’importe où pour activer le son des 10 secondes',

  // -- board scoring playthrough -------------------------------------------
  tallyNoBets: 'Aucun jeton sur le tapis',
  tallyChips: (n: number) => `${n} jeton${n > 1 ? 's' : ''}`,
  tallyBetOn: (value: string) => `Pari sur ${value}`,
  // « Miser » is already what the phone calls a raise, so the chips are counted instead.
  tallyBet: (n: number) => `${n} jeton${n > 1 ? 's' : ''} de pari`,
  tallyRaised: (n: number) => `mise ${n}`,
  tallyPays: (odds: number) => `paie ${odds} contre 1`,
  tallyWon: (n: number) => `gagne ${n}`,
  tallyLost: (n: number) => `perd ${n} au profit de la banque`,
  tallyLostNothing: 'perd 0',
  slotWinner: 'Gagnante',
  summaryBefore: 'Avant',
  summaryChange: 'Manche',
  summaryAfter: 'Total',
  tallyBonus: (value: string) => `a écrit la réponse gagnante, ${value}`,
  tallyBonusTitle: 'Bonus',
  tallyNextPlayer: 'Joueur suivant',
  tallyShowStandings: 'Voir le classement',

  // -- connection --------------------------------------------------------
  reconnecting: 'Reconnexion…',
  reconnectingHint: 'Un instant — vos jetons sont en sécurité.',
  reconnected: 'C’est reparti',
  couldNotJoin: 'Impossible de rejoindre — rechargez et réessayez.',
}

export const STRINGS = { en, fr }

export type Strings = typeof en
