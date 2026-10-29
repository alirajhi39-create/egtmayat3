export const CLASSES = ["٦/١", "٦/٢"] as const;
export type ClassName = (typeof CLASSES)[number];

export function normalizeClassName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  const compact = name.replace(/\s+/g, "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  if (compact === "6/1" || compact === "6/أ" || compact === "6/ا") return CLASSES[0];
  if (compact === "6/2" || compact === "6/ب") return CLASSES[1];
  return name;
}

export function isClassName(value: unknown): value is ClassName {
  return value === CLASSES[0] || value === CLASSES[1];
}