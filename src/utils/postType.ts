export const normalizePostType = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

export const isBuyPostType = (value: unknown) => {
  const normalized = normalizePostType(value);
  return normalized === "buy" || normalized === "2";
};

/**
 * The single merged label for whichever party posted the listing this
 * transaction is about — replaces the old "Người bán · Người đăng bài" /
 * "Người mua · Người đăng bài" composite. Only use this for the party that
 * IS the poster; the non-poster counterparty keeps a plain "Người mua" /
 * "Người bán".
 */
export const getPosterRoleLabel = (isBuyPost: boolean) =>
  isBuyPost ? "Người đăng bài mua" : "Người đăng bài bán";
