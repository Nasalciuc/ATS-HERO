// Who signs the posts. The role is the real one (Scaler, 13 Nov 2026): the byline, the author box
// and, later, the Article JSON-LD all read it from here.
export const AUTHORS = {
  "vladimir-nasalciuc": {
    name: "Vladimir Nasalciuc",
    initials: "VN",
    role: "AI/ML engineer",
    credit: "built the ATS Hero lab",
    bio: "AI/ML engineer. He built the ATS Hero lab, which renders CVs from our templates and checks what text readers take out of them.",
  },
} as const;

export type AuthorId = keyof typeof AUTHORS;

export const AUTHOR_IDS = Object.keys(AUTHORS) as [AuthorId, ...AuthorId[]];
