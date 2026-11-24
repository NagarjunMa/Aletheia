const CONNECTION_DEGREE = /^•[ \t]*(?:1st|2nd|3rd)$/u;
const POST_AGE = /^\d+[smhdwy][ \t]*•$/u;
const HASHTAG_LINE = /^#[\p{L}\p{M}\p{N}_]+(?:[ \t]+#[\p{L}\p{M}\p{N}_]+)*$/u;

export function separateJobContext(value: string) {
  const lines = value.replace(/\r\n?/gu, "\n").trim().split("\n");
  let bodyEnd = lines.length;
  while (bodyEnd > 0) {
    const line = lines[bodyEnd - 1]!.trim();
    if (line && !HASHTAG_LINE.test(line)) break;
    bodyEnd--;
  }
  const hashtags = lines
    .splice(bodyEnd)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/[ \t]+/u));

  // Only treat standalone labels as page controls inside a recognized post header.
  const header = lines
    .slice(0, 16)
    .map((line, index) => ({ text: line.trim(), index }))
    .filter(({ text }) => text);
  const degree = header[1];
  const age = header.slice(2, 6).find(({ text }) => POST_AGE.test(text));
  let body = lines;
  if (degree && CONNECTION_DEGREE.test(degree.text) && age) {
    body = lines.filter((line, index) => {
      if (index === degree.index || index === age.index) return false;
      const text = line.trim();
      if (index < age.index && text === "Visit my website") return false;
      return index !== age.index + 1 || text !== "Follow";
    });
  }

  return { body: body.join("\n").trim(), hashtags: [...new Set(hashtags)] };
}
