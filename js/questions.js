/* =============================================================================
   QUESTION BANK
   The substrate of the map. Each "dimension" is a region of mind. Questions are
   designed to be open, recursive, and a little disarming — the kind that make
   you pause before answering.

   Each dimension has:
     - id, label, color (drives node hue in the map)
     - blurb (shown when you enter the region)
     - questions[] (the prompts)
     - followups[] (optional deeper cuts, surfaced after you answer)
   ============================================================================= */

const DIMENSIONS = [
  {
    id: "present",
    label: "What's On My Mind",
    color: "#38f9d7",
    blurb: "The surface of the water. Whatever is moving through you right now.",
    questions: [
      "What's actually on your mind right now — before you edit it?",
      "What thought has been looping today that you haven't said out loud?",
      "If you could put down one thing you're carrying right now, what would it be?",
      "What are you avoiding thinking about?",
      "What's the background hum of your mind today — anxious, restless, calm, numb?",
      "What did you wake up thinking about?",
      "What's the unfinished sentence in your head right now?",
      "What do you keep checking for, refreshing, or waiting on?",
      "What's taking up space in your head that doesn't deserve it?",
      "If today had a single emotional weather report, what would it read?",
    ],
    followups: [
      "Where do you feel that in your body?",
      "Is this new, or an old visitor wearing today's clothes?",
      "What would it mean if you just let that be true for a moment?",
    ],
  },
  {
    id: "ego",
    label: "Ego & Attachment",
    color: "#f857a6",
    blurb: "What the 'I' clings to. The identities you'd fight to keep.",
    questions: [
      "What part of your identity would feel like death to lose?",
      "What do you most want other people to believe about you?",
      "When was the last time your pride got in the way of the truth?",
      "What compliment do you fish for without admitting it?",
      "What are you secretly competing with people about?",
      "What label do you wear that you're no longer sure fits?",
      "Whose approval still runs your behaviour even though you'd deny it?",
      "What would you have to admit if you stopped defending yourself for one day?",
      "What achievement are you using to prove your worth?",
      "If your reputation vanished overnight, who would you be?",
      "What do you pretend not to care about but actually care about deeply?",
      "What story about yourself are you most attached to being true?",
      "Where do you perform a version of yourself instead of being yourself?",
    ],
    followups: [
      "Who taught you that this mattered?",
      "What are you protecting by holding onto that?",
      "Who would you be without that identity — genuinely?",
    ],
  },
  {
    id: "thinking",
    label: "Thinking Patterns",
    color: "#5b8cff",
    blurb: "The machinery. The default routes your mind takes without asking you.",
    questions: [
      "What's a thought loop you can't seem to break?",
      "When you catastrophise, where does your mind go first?",
      "Do you think in words, images, feelings, or something else?",
      "What's a conclusion you jump to almost automatically?",
      "When you're overwhelmed, does your mind speed up or shut down?",
      "What kind of problem makes your mind come alive?",
      "What assumption do you make about people within seconds of meeting them?",
      "How do you talk to yourself when you make a mistake?",
      "What's the difference between your inner voice and your real voice?",
      "Do you tend to over-analyse, or trust your gut? When has each failed you?",
      "What's a mental shortcut you rely on that's probably wrong?",
      "When do you most often confuse a feeling for a fact?",
      "What's the last thing you changed your mind about, and what moved you?",
    ],
    followups: [
      "Where might that pattern have been useful once?",
      "What does it cost you now?",
      "What would the opposite pattern feel like?",
    ],
  },
  {
    id: "fear",
    label: "Fears & Shadow",
    color: "#a06bff",
    blurb: "The basement. What you keep the lights off around.",
    questions: [
      "What are you most afraid people will find out about you?",
      "What's the fear underneath your biggest decision right now?",
      "What trait do you judge harshly in others that you might fear in yourself?",
      "What would you do if you knew you couldn't fail — and what does that reveal?",
      "What are you pretending not to feel?",
      "What's a fear you've never said out loud?",
      "When did you last feel genuinely ashamed, and of what?",
      "What part of yourself do you hide even from people who love you?",
      "What's the worst thing you believe about yourself at 3am?",
      "What do you do to avoid feeling powerless?",
      "What anger are you sitting on?",
      "What would collapse if you stopped holding it together?",
    ],
    followups: [
      "Is that fear protecting something, or just running on old fuel?",
      "What's the smallest piece of this you could face?",
      "If a friend confessed this exact thing, what would you say to them?",
    ],
  },
  {
    id: "values",
    label: "Values & Compass",
    color: "#ffd166",
    blurb: "True north. What you'd defend even when it costs you.",
    questions: [
      "What would you never do, no matter the reward?",
      "What principle have you actually paid a price for?",
      "What do you respect in people that you wish you had more of?",
      "When did you last act against your own values, and why?",
      "What does a good life look like to you — not to anyone else?",
      "What are you willing to be disliked for?",
      "What did you believe deeply at 16 that you still believe now?",
      "What do you pretend to value but don't really?",
      "Whose life looks admirable from the outside that you wouldn't actually want?",
      "What's worth suffering for, to you?",
      "If your values were a sentence on your gravestone, what would it say?",
    ],
    followups: [
      "Are you living that, or just believing it?",
      "Where is your life out of alignment with that?",
      "What's one small action that would honour this today?",
    ],
  },
  {
    id: "desire",
    label: "Desire & Drive",
    color: "#ff8c42",
    blurb: "The engine. What actually pulls you, under the respectable reasons.",
    questions: [
      "What do you want that you're embarrassed to admit you want?",
      "What are you actually chasing underneath your stated goals?",
      "If money and judgement disappeared, how would you spend your days?",
      "What did you want as a child that you've never stopped wanting?",
      "What's the difference between what you want and what you think you should want?",
      "What craving keeps coming back no matter how much you feed it?",
      "What would 'enough' actually look like for you?",
      "What are you working toward that you've never questioned?",
      "When do you feel most alive, and when did you last feel it?",
      "What do you envy, and what does that envy point to?",
      "What dream did you quietly give up on?",
    ],
    followups: [
      "What would having that actually give you?",
      "Is the wanting more satisfying than the having?",
      "What are you trading for this pursuit?",
    ],
  },
  {
    id: "relationship",
    label: "Connection & Others",
    color: "#06d6a0",
    blurb: "The mirrors. How you meet, hold, and lose other people.",
    questions: [
      "Who do you become around the people you love?",
      "What do you need from others that you find hard to ask for?",
      "Who do you owe an apology you haven't given?",
      "What's a pattern in your relationships that keeps repeating?",
      "Who knows the real you, and who only knows the performance?",
      "When do you withdraw, and what triggers it?",
      "What do you do when someone gets too close?",
      "Who lives in your head rent-free, and what do they represent?",
      "What did your family teach you about love without saying it?",
      "Who are you trying to prove something to?",
      "What kind of person do you find it hard to forgive, and why?",
      "When did someone see you clearly, and how did it feel?",
    ],
    followups: [
      "Where did you learn to relate like that?",
      "What would change if you asked for what you need directly?",
      "What are you protecting by keeping that distance?",
    ],
  },
  {
    id: "story",
    label: "Story & Memory",
    color: "#ff6b9d",
    blurb: "The myth of you. The past, retold until it became identity.",
    questions: [
      "What story do you tell about your life, and what does it leave out?",
      "What moment do you keep returning to in your mind?",
      "What's a memory that shaped you more than you let on?",
      "Who were you before the world told you who to be?",
      "What did you decide about yourself as a kid that you still carry?",
      "What chapter of your life are you still not over?",
      "What version of events have you never questioned?",
      "What would your younger self think of who you've become?",
      "What did you lose that you've never fully grieved?",
      "What's the turning point you didn't recognise at the time?",
      "If your life were a book, what would this chapter be titled?",
    ],
    followups: [
      "Who benefits from you telling it that way?",
      "What's another true way to tell the same story?",
      "What would you forgive yourself for in that memory?",
    ],
  },
  {
    id: "meaning",
    label: "Meaning & Mortality",
    color: "#c77dff",
    blurb: "The horizon. The questions that don't resolve, only deepen.",
    questions: [
      "If you died tomorrow, what would feel unfinished?",
      "What gives your life meaning when no one is watching?",
      "What do you want your life to have been about?",
      "What are you doing with your one wild and precious life?",
      "What would you do differently if you fully believed time was finite?",
      "When do you feel connected to something larger than yourself?",
      "What question have you been avoiding your whole life?",
      "What do you hope is true about reality, even if you can't know?",
      "What would 'a life well lived' require of you that you're not doing?",
      "If you could whisper one thing to yourself at the end, what would it be?",
      "What are you waiting for permission to do?",
    ],
    followups: [
      "What's stopping you from starting that now?",
      "Who would you have to become to live that?",
      "What would change if you took this seriously today?",
    ],
  },
  {
    id: "body",
    label: "Body & Sensation",
    color: "#4ecdc4",
    blurb: "The animal. What your mind tries to think its way out of feeling.",
    questions: [
      "Where in your body do you hold tension right now?",
      "What is your body trying to tell you that you keep overriding?",
      "When did you last feel fully relaxed, and what made it possible?",
      "How do you treat your body when no one's watching?",
      "What sensation do you reach for to numb out?",
      "What does your exhaustion want you to stop doing?",
      "When are you most disconnected from your physical self?",
      "What does comfort actually feel like in your body?",
      "What's your relationship with stillness?",
      "How does anxiety show up physically for you?",
    ],
    followups: [
      "If that tension could speak, what would it say?",
      "What does your body need that your mind keeps denying it?",
      "Can you give it ten seconds of attention right now?",
    ],
  },
];

/* Flat lookup helpers ----------------------------------------------------- */
const DIMENSION_BY_ID = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));

/* A flattened, shuffled-on-demand pool of every question with its dimension. */
function buildQuestionPool() {
  const pool = [];
  for (const dim of DIMENSIONS) {
    dim.questions.forEach((q, i) => {
      pool.push({ dimId: dim.id, text: q, index: i });
    });
  }
  return pool;
}
