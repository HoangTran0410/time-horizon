import { describe, it, expect } from "vitest";
import en from "./en.json";
import vi from "./vi.json";

const enMap: Record<string, string> = en;
const viMap: Record<string, string> = vi;

/**
 * Extract placeholder variable names from an i18n value.
 *
 * Values use `{name}` interpolation plus ICU plural blocks like
 * `{count, plural, one {# collection} other {# collections}}`. Only braces at
 * nesting depth 0 open a placeholder; the variable name is the identifier
 * before the first `,` or `}`. Literal text inside plural branches (e.g. the
 * `{s}` in `other {s}`) sits at depth 1 and is deliberately ignored.
 */
const extractPlaceholders = (value: string): Set<string> => {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "{") {
      if (depth === 0) {
        const match = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/.exec(
          value.slice(i + 1),
        );
        if (match) names.add(match[1]);
      }
      depth++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
    }
  }
  return names;
};

describe("i18n key parity between en.json and vi.json", () => {
  const enKeys = Object.keys(enMap);
  const viKeys = Object.keys(viMap);
  const enKeySet = new Set(enKeys);
  const viKeySet = new Set(viKeys);

  it("has no keys present in en.json but missing from vi.json", () => {
    const missingInVi = enKeys.filter((key) => !viKeySet.has(key));
    expect(missingInVi, `keys missing from vi.json: ${missingInVi.join(", ")}`)
      .toEqual([]);
  });

  it("has no keys present in vi.json but missing from en.json", () => {
    const missingInEn = viKeys.filter((key) => !enKeySet.has(key));
    expect(missingInEn, `keys missing from en.json: ${missingInEn.join(", ")}`)
      .toEqual([]);
  });

  it("has only non-empty string values in both files", () => {
    const badEn = enKeys.filter(
      (key) => typeof enMap[key] !== "string" || enMap[key].trim() === "",
    );
    const badVi = viKeys.filter(
      (key) => typeof viMap[key] !== "string" || viMap[key].trim() === "",
    );
    expect(badEn, `non-string or empty en values: ${badEn.join(", ")}`)
      .toEqual([]);
    expect(badVi, `non-string or empty vi values: ${badVi.join(", ")}`)
      .toEqual([]);
  });
});

describe("i18n placeholder parity between en.json and vi.json", () => {
  it("uses the same {placeholder} variable set per key in both languages", () => {
    const sharedKeys = Object.keys(enMap).filter((key) => key in viMap);
    const mismatches = sharedKeys
      .map((key) => {
        const enNames = [...extractPlaceholders(enMap[key])].sort();
        const viNames = [...extractPlaceholders(viMap[key])].sort();
        if (enNames.join("|") === viNames.join("|")) return null;
        return `${key}: en=[${enNames.join(", ")}] vi=[${viNames.join(", ")}]`;
      })
      .filter((entry): entry is string => entry !== null);

    expect(
      mismatches,
      `placeholder mismatches:\n${mismatches.join("\n")}`,
    ).toEqual([]);
  });

  it("extracts placeholders from real ICU shapes correctly (extractor sanity)", () => {
    expect(extractPlaceholders("Hello {name}, you have {count} items")).toEqual(
      new Set(["name", "count"]),
    );
    // Plural block: variable is `count`; branch literals like {s} and
    // {# collections} must not register as placeholders.
    expect(
      extractPlaceholders(
        "{count} collection{count, plural, one {} other {s}}",
      ),
    ).toEqual(new Set(["count"]));
    expect(
      extractPlaceholders(
        "Showing {count, plural, one {# collection} other {# collections}} · click",
      ),
    ).toEqual(new Set(["count"]));
    expect(extractPlaceholders("no placeholders here")).toEqual(new Set());
  });
});
