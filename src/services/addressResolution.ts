export type ResolvedVietnameseAddress = {
  provinceCode: string;
  provinceName: string;
  wardName: string;
  streetAddress: string;
  formattedAddress: string;
};

type AdministrativeSearchResult = {
  type?: string;
  province_code?: string | number;
  name?: string;
  ward_code?: string | number;
  ward_name?: string;
  is_merger_match?: boolean;
  matched_old_unit?: string;
};

type ProvinceWard = {
  ward_code?: string | number;
  ward_name?: string;
  province_code?: string | number;
};

const SEARCH_ENDPOINT = "https://34tinhthanh.com/api/search";
const WARDS_ENDPOINT = "https://34tinhthanh.com/api/wards";

const normalizeForCompare = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi-VN")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripAdministrativePrefix = (value: string) =>
  value
    .trim()
    .replace(
      /^(?:tp\.?|thành phố|tỉnh|p\.?|phường|x\.?|xã|thị trấn)\s+/i,
      "",
    )
    .trim();

const toSearchQuery = (segment: string) => {
  const compact = normalizeForCompare(segment);
  if (["tp hcm", "tphcm", "hcm"].includes(compact)) return "ho chi minh";
  if (["tp hn", "tphn", "hn"].includes(compact)) return "ha noi";

  const stripped = stripAdministrativePrefix(segment);
  return stripped.length >= 2 ? stripped : segment.trim();
};

const isDistrictLikeSegment = (segment: string) =>
  /^(?:quan|q|huyen|h|thi xa|tx|thanh pho thu duc)\b/.test(
    normalizeForCompare(segment),
  );

const searchAdministrativeUnit = async (
  segment: string,
): Promise<AdministrativeSearchResult[]> => {
  const q = toSearchQuery(segment);
  if (q.length < 2) return [];

  const response = await fetch(
    `${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`,
  );

  if (!response.ok) {
    throw Object.assign(new Error("Address search failed"), {
      status: response.status,
    });
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const dedupeBy = (
  items: AdministrativeSearchResult[],
  getKey: (item: AdministrativeSearchResult) => string,
) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const pickProvince = (
  results: AdministrativeSearchResult[],
  segment: string,
) => {
  const provinces = dedupeBy(
    results.filter(
      (item) =>
        String(item?.type || "").toLocaleLowerCase("vi-VN") === "province" &&
        item?.province_code &&
        item?.name,
    ),
    (item) => String(item.province_code),
  );

  if (provinces.length === 1) return provinces[0];

  const target = normalizeForCompare(stripAdministrativePrefix(segment));
  const exact = provinces.filter((item) => {
    const name = normalizeForCompare(
      stripAdministrativePrefix(String(item.name || "")),
    );
    return name === target;
  });

  return exact.length === 1 ? exact[0] : null;
};

const loadProvinceWards = async (
  provinceCode: string,
): Promise<ProvinceWard[]> => {
  const response = await fetch(
    `${WARDS_ENDPOINT}?province_code=${encodeURIComponent(provinceCode)}`,
  );

  if (!response.ok) {
    throw Object.assign(new Error("Ward list failed"), {
      status: response.status,
    });
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const pickWard = (
  results: AdministrativeSearchResult[],
  provinceWards: ProvinceWard[],
  segment: string,
) => {
  const target = normalizeForCompare(stripAdministrativePrefix(segment));

  const currentExact = provinceWards.filter((item) => {
    const name = normalizeForCompare(
      stripAdministrativePrefix(String(item.ward_name || "")),
    );
    return name === target;
  });

  if (currentExact.length === 1) {
    return currentExact[0];
  }

  const searchWardResults = dedupeBy(
    results.filter(
      (item) =>
        String(item?.type || "").toLocaleLowerCase("vi-VN") === "ward" &&
        item?.ward_code &&
        item?.ward_name,
    ),
    (item) => String(item.ward_code),
  );

  const validatedCandidates = searchWardResults
    .map((searchItem) => {
      const byCode = provinceWards.find(
        (item) =>
          String(item?.ward_code || "") ===
          String(searchItem.ward_code || ""),
      );

      if (byCode) return byCode;

      const searchName = normalizeForCompare(
        stripAdministrativePrefix(String(searchItem.ward_name || "")),
      );

      const byName = provinceWards.find((item) => {
        const currentName = normalizeForCompare(
          stripAdministrativePrefix(String(item.ward_name || "")),
        );
        return currentName === searchName;
      });

      return byName ?? null;
    })
    .filter((item): item is ProvinceWard => Boolean(item));

  const uniqueCandidates = Array.from(
    new Map(
      validatedCandidates.map((item) => [
        String(item.ward_code || item.ward_name || ""),
        item,
      ]),
    ).values(),
  );

  return uniqueCandidates.length === 1 ? uniqueCandidates[0] : null;
};

/**
 * Resolve a pasted/typed Vietnamese address into current Province + Ward data.
 * This intentionally refuses ambiguous input instead of guessing.
 */
export const resolveVietnameseAddress = async (
  rawAddress: string,
): Promise<ResolvedVietnameseAddress | null> => {
  const parts = rawAddress
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;

  let province:
    | AdministrativeSearchResult
    | null = null;
  let provinceIndex = -1;

  for (
    let index = parts.length - 1;
    index >= Math.max(0, parts.length - 3);
    index -= 1
  ) {
    const results = await searchAdministrativeUnit(parts[index]);
    const candidate = pickProvince(results, parts[index]);
    if (candidate) {
      province = candidate;
      provinceIndex = index;
      break;
    }
  }

  if (!province?.province_code || !province?.name) return null;

  const provinceCode = String(province.province_code);
  const provinceWards = await loadProvinceWards(provinceCode);

  let ward:
    | ProvinceWard
    | null = null;
  let wardIndex = -1;

  for (
    let index = provinceIndex - 1;
    index >= Math.max(0, provinceIndex - 3);
    index -= 1
  ) {
    const results = await searchAdministrativeUnit(parts[index]);
    const candidate = pickWard(results, provinceWards, parts[index]);
    if (candidate) {
      ward = candidate;
      wardIndex = index;
      break;
    }
  }

  if (!ward?.ward_name || wardIndex < 0) return null;

  const streetParts = parts.filter(
    (part, index) =>
      index !== provinceIndex &&
      index !== wardIndex &&
      !isDistrictLikeSegment(part),
  );

  const streetAddress = streetParts.join(", ").trim();
  if (!streetAddress) return null;

  const provinceName = String(province.name).trim();
  const wardName = String(ward.ward_name).trim();

  return {
    provinceCode,
    provinceName,
    wardName,
    streetAddress,
    formattedAddress: [streetAddress, wardName, provinceName].join(", "),
  };
};

export default resolveVietnameseAddress;
