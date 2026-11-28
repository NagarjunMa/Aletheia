const CONNECTION_DEGREE = /^•[ \t]*(?:1st|2nd|3rd)$/u;
const POST_AGE = /^\d+[smhdwy][ \t]*•$/u;
const HASHTAG_LINE = /^#[\p{L}\p{M}\p{N}_]+(?:[ \t]+#[\p{L}\p{M}\p{N}_]+)*$/u;

function copiedPostHeader(lines: readonly string[]) {
  const header = lines
    .slice(0, 16)
    .map((line, index) => ({ text: line.trim(), index }))
    .filter(({ text }) => text);
  const degree = header[1];
  const age = header.slice(2, 6).find(({ text }) => POST_AGE.test(text));
  if (degree && CONNECTION_DEGREE.test(degree.text) && age)
    return { degreeIndex: degree.index, ageIndex: age.index };
  return undefined;
}

function removeDuplicateCopiedPost(value: string): string {
  const middle = Math.floor(value.length / 2);
  const first = value.slice(0, middle).trimEnd();
  const second = value.slice(middle).trimStart();
  const separator = value.slice(first.length, value.length - second.length);
  if (
    first === second &&
    /\n[ \t]*\n/u.test(separator) &&
    copiedPostHeader(first.split("\n"))
  )
    return first;
  return value;
}

export function separateJobContext(value: string) {
  const lines = removeDuplicateCopiedPost(
    value.replace(/\r\n?/gu, "\n").trim(),
  ).split("\n");
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
  const header = copiedPostHeader(lines);
  let body = lines;
  if (header) {
    const { degreeIndex, ageIndex } = header;
    body = lines.filter((line, index) => {
      if (index === degreeIndex || index === ageIndex) return false;
      const text = line.trim();
      if (index < ageIndex && text === "Visit my website") return false;
      return index !== ageIndex + 1 || text !== "Follow";
    });
  }

  return { body: body.join("\n").trim(), hashtags: [...new Set(hashtags)] };
}
