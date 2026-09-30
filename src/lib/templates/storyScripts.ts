/**
 * Pre-made scripts for the texting-story editor (/story-editor). Same line
 * grammar as the chat editor, plus `Tone:` lines that set the voiceover
 * tone of the message above (see lib/story/tones.ts).
 */
export interface PremadeScript {
  id: string;
  title: string;
  subtext: string;
  /** Speaker shown on the right (the viewer's character). */
  self: string;
  script: string;
}

export const STORY_PREMADE_SCRIPTS: PremadeScript[] = [
  {
    id: 'two-am-text',
    title: 'The 2 a.m. Text',
    subtext: 'Romantic · sad',
    self: 'Sam',
    script: `Sam: you up?
Tone: whisper
Riya: it's 2am. of course i'm up
Sam: i keep thinking about the station
Tone: sad
Riya: you didn't even turn around
Tone: sad
Sam: if i had, i wouldn't have gotten on the train
Tone: sad
Riya: and that would've been so bad?
Tone: romantic
Sam: riya
Tone: whisper
Riya: i'm outside
Tone: romantic
Sam: what
Riya: come open the door before i lose my nerve
Tone: happy
Sam: don't move
Tone: happy`,
  },
  {
    id: 'read-at-nine-forty-one',
    title: 'Read at 9:41',
    subtext: 'Angry · drama',
    self: 'Maya',
    script: `Maya: you saw the messages
Maya: all of them
Tone: angry
Dev: it's not what it looks like
Maya: it's exactly what it looks like
Tone: angry
Dev: can we talk in person
Maya: you had three weeks to talk in person
Tone: angry
Dev: maya please
Tone: sad
Maya: i packed your stuff. it's by the door
Tone: sad
Dev: don't do this over text
Maya: you started it over text
Tone: angry
Dev: i'm sorry
Tone: whisper
Maya: i know
Tone: sad
Maya: it doesn't change anything
Tone: sad`,
  },
  {
    id: 'surprise-party',
    title: 'The Surprise',
    subtext: 'Whisper · happy',
    self: 'Leo',
    script: `Leo: is she still at work?
Tone: whisper
Nina: leaving in 10. everyone's hiding in the kitchen
Tone: whisper
Leo: the cake?
Nina: in the fridge. relax
Tone: happy
Leo: i can't relax, ben's already spilled the punch
Tone: angry
Nina: BEN
Tone: angry
Nina: ok she's in the elevator. lights off NOW
Tone: whisper
Leo: lights off
Tone: whisper
Nina: door's opening
Tone: whisper
Leo: SURPRISE
Tone: happy
Nina: she's crying
Tone: happy
Leo: happy tears?
Nina: the best kind
Tone: romantic`,
  },
];

export const STORY_PROMPT_TEMPLATE = `Create a short texting-story script for Easy Chat Maker (a video where a text conversation plays out message by message with an AI voiceover).

Return only script lines in this exact format:
Name: message
Tone: happy | sad | romantic | angry | whisper

Rules:
- Use real character names, never "You:".
- Put exactly one speaker name before each colon.
- Put "Tone:" on its own line right after a message to set how that line is read aloud. Only use it where the emotion matters.
- 12–18 messages, short and natural, with a twist or payoff at the end.
- Do not use markdown, bullets, scene notes, or explanations.

Story idea:
[Describe the story you want here]

Preferred sender / my character:
[Write one character name here]`;
