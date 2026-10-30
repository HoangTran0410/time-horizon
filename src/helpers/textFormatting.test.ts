import { describe, expect, it } from "vitest";
import { formatYear } from "./index";
import { parseCsvEvents } from "./csv";

describe("formatYear — trailing zeros", () => {
  it("drops trailing zeros after the decimal point", () => {
    expect(formatYear(-13.8e9)).toBe("13.8 Billion BC");
    expect(formatYear(-2.5e6)).toBe("2.5 Million BC");
    expect(formatYear(1.1e9)).toBe("1.1 Billion AD");
  });

  it("keeps significant decimals and integer zeros", () => {
    expect(formatYear(-2.25e6)).toBe("2.25 Million BC");
    expect(formatYear(-1.05e9)).toBe("1.05 Billion BC");
    expect(formatYear(-10e6)).toBe("10 Million BC");
    expect(formatYear(-100e6)).toBe("100 Million BC");
  });
});

describe("parseCsvEvents — JSON-looking descriptions", () => {
  const parseDescription = (cell: string) =>
    parseCsvEvents(
      `title,description,time\nMoon,"${cell.replace(/"/g, '""')}",1969`,
    ).events[0]?.description;

  it("keeps a plain JSON object description as the text the author wrote", () => {
    expect(parseDescription('{"note":"x"}')).toBe('{"note":"x"}');
    expect(parseDescription('{"vi":{"nested":"x"}}')).toBe(
      '{"vi":{"nested":"x"}}',
    );
    expect(parseDescription('{"vi":"a","note":"b"}')).toBe(
      '{"vi":"a","note":"b"}',
    );
  });

  it("still reads a language map as localized text", () => {
    expect(parseDescription('{"vi":"Mặt trăng","en":"Moon"}')).toEqual({
      vi: "Mặt trăng",
      en: "Moon",
    });
  });
});
