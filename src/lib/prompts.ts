// All AI prompts live here so they are easy to find, edit, and teach.
// Rule: never use em-dashes in any prompt or in instructions to Claude.

export const IMAGE_ANALYSIS_PROMPT = (
  lat: number,
  lng: number,
  situation: string
) => `
You are a personal safety AI monitoring a person's surroundings.
The person is at coordinates ${lat}, ${lng}.
Context: ${situation}

Analyse this image for potential safety risks. Look for:
- Signs of physical confrontation or aggression
- People appearing distressed or threatened
- Visible signs of an unsafe setting, such as a weapon, physical restraint, or a hostile person approaching
- Suspicious behaviour directed at the camera holder

If the image is blank, mostly black, blurry, out of focus, or otherwise
does not clearly show the scene (for example the phone was in a pocket
or bag, or it is simply a dark room), this is NOT evidence of danger by
itself. Rate it low risk and say in the summary that the image was not
clear enough to analyse. Never rate high risk based only on darkness or
a lack of visibility -- only rate high when you can clearly see specific
evidence of danger in the image.

Respond ONLY with a JSON object in this exact format:
{
  "riskLevel": "low" | "medium" | "high",
  "summary": "One sentence description of what you see",
  "concerns": ["specific concern 1", "specific concern 2"],
  "confidence": 0.0 to 1.0
}

Do not use em-dashes in any text. Be conservative -- only rate
high if there is clear evidence of danger. Rate low for normal
scenes or images too unclear to assess.
`;

export const AUDIO_ANALYSIS_PROMPT = (transcript: string) => `
You are a personal safety AI monitoring ambient conversation.

Analyse this transcript for potential threats to the person
carrying the recording device:
"${transcript}"

Look for: threats, aggressive language, sounds of distress,
instructions to harm someone, or anything alarming.

Respond ONLY with JSON:
{
  "riskLevel": "low" | "medium" | "high",
  "summary": "One sentence about what was heard",
  "concerns": ["concern 1"],
  "confidence": 0.0 to 1.0
}

Do not use em-dashes. Be conservative.
`;
