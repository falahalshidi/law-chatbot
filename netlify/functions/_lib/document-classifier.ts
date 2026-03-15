export type DocumentCategory = "traffic" | "family" | "contracts" | "criminal" | "general";

const CATEGORY_KEYWORDS: Record<DocumentCategory, string[]> = {
  traffic: ["مرور", "رخص", "رخصة", "قيادة", "مخالفة", "سيارة", "مركبة", "حوادث", "traffic"],
  family: ["احوال", "أحوال", "اسرة", "أسرة", "زواج", "طلاق", "نفقة", "حضانة", "family"],
  contracts: ["عقد", "عقود", "اتفاق", "التزام", "مقاولة", "ايجار", "إيجار", "بيع", "contracts"],
  criminal: ["جنائي", "جريمة", "عقوبة", "سجن", "نيابة", "محكمة", "criminal", "جزائي"],
  general: [],
};

export function detectCategory(input: string): DocumentCategory {
  const normalized = input.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[DocumentCategory, string[]]>) {
    if (category === "general") continue;
    if (keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return category;
    }
  }

  return "general";
}

export function expandQueryByCategory(query: string, category: DocumentCategory): string {
  if (category === "general") {
    return query;
  }

  const extraTerms = CATEGORY_KEYWORDS[category].slice(0, 4).join(" ");
  return `${query}\n\nCategory hints: ${extraTerms}`;
}
