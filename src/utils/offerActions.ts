export type OfferResponseAction = "accept" | "reject" | "counter";

const statusKey = (value: unknown) =>
  String(value ?? "").trim().replace(/[\s_-]/g, "").toLowerCase();

export const isPendingOffer = (value: unknown) =>
  ["0", "pending"].includes(statusKey(value));

export const isAcceptedOffer = (value: unknown) =>
  ["1", "accepted"].includes(statusKey(value));

export const getOfferVersion = (offer: any): number | null => {
  const raw = offer?.version ?? offer?.Version;
  if ((typeof raw !== "number" && typeof raw !== "string") || String(raw).trim() === "") return null;
  const version = Number(raw);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
};

export const canRespondToOffer = (offer: any, action: OfferResponseAction) => {
  if (!isPendingOffer(offer?.offerStatus ?? offer?.OfferStatus)) return false;
  // The detail's flags are computed for the authenticated receiver. Counter
  // uses the same available-post receiver gate; there is no CanCounter DTO flag.
  const allowed = action === "reject"
    ? offer?.canReject ?? offer?.CanReject
    : offer?.canAccept ?? offer?.CanAccept;
  return allowed === true && (action === "reject" || getOfferVersion(offer) !== null);
};

export const validOfferTerms = (price: number, quantity: number) =>
  Number.isFinite(price) && price > 0 && Number.isInteger(quantity) && quantity > 0;
