export type ReviewStatus = "active" | "edited" | "hidden" | "removed" | "";

export const normalizeReviewStatus = (value: unknown): ReviewStatus => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "1":
    case "active":
      return "active";
    case "2":
    case "edited":
      return "edited";
    case "3":
    case "hidden":
      return "hidden";
    case "4":
    case "removed":
      return "removed";
    default:
      return "";
  }
};

export const isUnavailableReviewStatus = (value: unknown) => {
  const status = normalizeReviewStatus(value);
  return status === "hidden" || status === "removed";
};
