export type CodePiece = { text: string; change?: "add" | "del" };
export type DiffRow = { old: number | null; cur: number | null; type: "ctx" | "add" | "del"; pieces: CodePiece[] };
