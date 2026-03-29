# Assassination Date Verification Report

**Date:** 2026-03-28
**Source:** `src/data/collections/histography/assassinations.json`
**Method:** Web search (Wikipedia + authoritative sources)

---

## Summary

| # | JSON Entry | JSON `[year, month]` | JSON Interpreted | Wikipedia | Verdict |
|---|-----------|----------------------|-----------------|-----------|---------|
| 1 | h1204 Tiberius | `[37, 7]` | July 37 CE | March 16, 37 CE | **WRONG** |
| 2 | h1208 Caligula | `[41, 2]` | February 41 CE | January 24, 41 CE | **WRONG** |
| 3 | h1237 Domitian | `[96, 11]` | November 96 CE | December 18, 96 CE | **WRONG** |
| 4 | h1284 Commodus | `[192, 4]` | April 192 CE | December 31, 192 CE | **WRONG** |
| 5 | h2568 Emperor of China | `[1618, 4]` | April 1618 | **No event exists** | **WRONG** |
| 6 | h3136 Peter III Russia | `[1762, 5]` | May 1762 | July 17, 1762 | **WRONG** |
| 7 | h3175 Chief Pontiac | `[1769, 5]` | May 1769 | April 20, 1769 | **WRONG** |
| 8 | h4384 Abraham Lincoln | `[1865, 12]` | December 1865 | Shot Apr 14, died Apr 15, 1865 | **WRONG** |
| 9 | h4673 James Garfield | `[1881, 11]` | November 1881 | Shot Jul 2, died Sep 19, 1881 | **WRONG** |
| 10 | h4908 Sadi Carnot | `[1894, 3]` | March 1894 | June 25, 1894 | **WRONG** |
| 11 | h4946 Queen Min Korea | `[1895, 11]` | November 1895 | October 8, 1895 | **WRONG** |
| 12 | h5084 William McKinley | `[1901, 10]` | October 1901 | Shot Sep 6, died Sep 14, 1901 | **WRONG** |
| 13 | h5134 King Alexander I Serbia | `[1903, 8]` | August 1903 | May 29, 1903 (O.S.) / Jun 11, 1903 (G.S.) | **WRONG** |
| 14 | h5443 Archduke Franz Ferdinand | `[1914, 4]` | April 1914 | June 28, 1914 | **WRONG** |
| 15 | h5573 Tsar Nicholas II | `[1918, 2]` | February 1918 | July 17, 1918 | **WRONG** |
| 16 | h5630 Anastasia | `[1918, 11]` | November 1918 | July 17, 1918 | **WRONG** |
| 17 | h5631 Empress Alexandra | `[1918, 12]` | December 1918 | July 17, 1918 | **WRONG** |
| 18 | h6206 Alexander I assassination | `[1934, 4]` | April 1934 | **Oct 9, 1934** (Yugoslavia) | **WRONG** |
| 19 | h6256 Huey Long | `[1935, 7]` | July 1935 | September 8, 1935 | **WRONG** |
| 20 | h6425 Leon Trotsky | `[1940, 2]` | February 1940 | August 21, 1940 | **WRONG** |
| 21 | h6729 Mahatma Gandhi | `[1948, 6]` | June 1948 | January 30, 1948 | **WRONG** |
| 22 | h7232 PM of Ceylon (Bandaranaike) | `[1959, 5]` | May 1959 | September 26, 1959 | **WRONG** |
| 23 | h7480 PM South Vietnam (Ngo Dinh Diem) | `[1963, 2]` | February 1963 | November 2, 1963 | **WRONG** |
| 24 | h7690 Malcolm X | `[1965, 11]` | November 1965 | February 21, 1965 | **WRONG** |
| 25 | h7902 Martin Luther King Jr | `[1968, 8]` | August 1968 | April 4, 1968 | **WRONG** |
| 26 | h8483 Harvey Milk | `[1978]` | 1978 (no month) | May 27, 1978 | **NEEDS_VERIFICATION** |
| 27 | h8527 Aldo Moro | `[1978, 11]` | November 1978 | May 9, 1978 (death) / Mar 16 (kidnapped) | **WRONG** |
| 28 | h8572 Park Chung-hee | `[1979, 7]` | July 1979 | October 26, 1979 | **WRONG** |
| 29 | h8829 India PM (Indira Gandhi) | `[1984, 7]` | July 1984 | October 31, 1984 | **WRONG** |
| 30 | h9386 President Rwanda (Habyarimana) | `[1994, 11]` | November 1994 | April 6, 1994 | **WRONG** |
| 31 | h9395 Israel PM (Yitzhak Rabin) | `[1995]` | 1995 (no month) | November 4, 1995 | **NEEDS_VERIFICATION** |
| 32 | h10018 Former PM Pakistan (Benazir Bhutto) | `[2007, 12]` | December 2007 | December 27, 2007 | **CORRECT** |
| 33 | h10281 Osama bin Laden | `[2011, 10]` | October 2011 | May 2, 2011 | **WRONG** |

---

## Detailed Findings

### 1. Emperor Tiberius — `h1204`
- **JSON:** `[37, 7]` → July 37 CE
- **Wikipedia:** March 16, 37 CE
- **Verdict:** WRONG — Month off by ~4 months

### 2. Caligula — `h1208`
- **JSON:** `[41, 2]` → February 41 CE
- **Wikipedia:** January 24, 41 CE
- **Verdict:** WRONG — Month off by 1

### 3. Domitian — `h1237`
- **JSON:** `[96, 11]` → November 96 CE
- **Wikipedia:** December 18, 96 CE
- **Verdict:** WRONG — Month off by 1

### 4. Commodus — `h1284`
- **JSON:** `[192, 4]` → April 192 CE
- **Wikipedia:** December 31, 192 CE
- **Verdict:** WRONG — Off by ~8 months

### 5. Emperor of China, April 1618 — `h2568`
- **JSON:** `[1618, 4]` → April 1618
- **Wikipedia:** **No Ming or any Chinese emperor died in April 1618.** The Wanli Emperor died August 18, 1620. The Chongzhen Emperor died April 25, 1644.
- **Verdict:** WRONG — No such event exists. Likely a fabricated or erroneous entry.

### 6. Peter III of Russia — `h3136`
- **JSON:** `[1762, 5]` → May 1762
- **Wikipedia:** July 17, 1762
- **Verdict:** WRONG — Off by ~2 months

### 7. Chief Pontiac — `h3175`
- **JSON:** `[1769, 5]` → May 1769
- **Wikipedia:** April 20, 1769
- **Verdict:** WRONG — Off by ~1 month

### 8. Abraham Lincoln — `h4384`
- **JSON:** `[1865, 12]` → December 1865
- **Wikipedia:** Shot April 14, died April 15, 1865
- **Verdict:** WRONG — Off by ~8 months. The December date is completely wrong.

### 9. James Garfield — `h4673`
- **JSON:** `[1881, 11]` → November 1881
- **Wikipedia:** Shot July 2, died September 19, 1881
- **Verdict:** WRONG — JSON month is November; actual death was September.

### 10. Sadi Carnot — `h4908`
- **JSON:** `[1894, 3]` → March 1894
- **Wikipedia:** June 25, 1894
- **Verdict:** WRONG — Off by ~3 months

### 11. Queen Min (Empress Myeongseong) — `h4946`
- **JSON:** `[1895, 11]` → November 1895
- **Wikipedia:** October 8, 1895
- **Verdict:** WRONG — Off by 1 month

### 12. William McKinley — `h5084`
- **JSON:** `[1901, 10]` → October 1901
- **Wikipedia:** Shot September 6, died September 14, 1901
- **Verdict:** WRONG — Off by ~1 month

### 13. King Alexander I of Serbia — `h5134`
- **JSON:** `[1903, 8]` → August 1903
- **Wikipedia:** May 29, 1903 (Old Style) / June 11, 1903 (Gregorian)
- **Verdict:** WRONG — Off by ~2–3 months

### 14. Archduke Franz Ferdinand — `h5443`
- **JSON:** `[1914, 4]` → April 1914
- **Wikipedia:** June 28, 1914
- **Verdict:** WRONG — Off by ~2 months

### 15. Tsar Nicholas II — `h5573`
- **JSON:** `[1918, 2]` → February 1918
- **Wikipedia:** July 17, 1918
- **Verdict:** WRONG — Off by ~5 months

### 16. Grand Duchess Anastasia — `h5630`
- **JSON:** `[1918, 11]` → November 1918
- **Wikipedia:** July 17, 1918
- **Verdict:** WRONG — Off by ~4 months

### 17. Empress Alexandra Feodorovna — `h5631`
- **JSON:** `[1918, 12]` → December 1918
- **Wikipedia:** July 17, 1918
- **Verdict:** WRONG — Off by ~5 months

### 18. Alexander I (assassination) — `h6206`
- **JSON:** `[1934, 4]` → April 1934; link = "Alexander_I"
- **Wikipedia:** This links to **Alexander I of Russia** (died 1825) NOT Alexander I of Yugoslavia (assassinated Oct 9, 1934 in Marseille). The JSON entry has BOTH the wrong link AND wrong date.
- **Verdict:** WRONG — Two errors: wrong person + wrong date. The correct Alexander I (Yugoslavia) died October 9, 1934.

### 19. Huey Long — `h6256`
- **JSON:** `[1935, 7]` → July 1935
- **Wikipedia:** September 8, 1935
- **Verdict:** WRONG — Off by ~2 months

### 20. Leon Trotsky — `h6425`
- **JSON:** `[1940, 2]` → February 1940
- **Wikipedia:** Attacked August 20, died August 21, 1940
- **Verdict:** WRONG — Off by ~6 months

### 21. Mahatma Gandhi — `h6729`
- **JSON:** `[1948, 6]` → June 1948
- **Wikipedia:** January 30, 1948
- **Verdict:** WRONG — Off by ~5 months

### 22. S.W.R.D. Bandaranaike — `h7232`
- **JSON:** `[1959, 5]` → May 1959
- **Wikipedia:** September 26, 1959
- **Verdict:** WRONG — Off by ~4 months

### 23. Ngo Dinh Diem — `h7480`
- **JSON:** `[1963, 2]` → February 1963
- **Wikipedia:** November 2, 1963
- **Verdict:** WRONG — Off by ~9 months

### 24. Malcolm X — `h7690`
- **JSON:** `[1965, 11]` → November 1965
- **Wikipedia:** February 21, 1965
- **Verdict:** WRONG — Off by ~9 months

### 25. Martin Luther King Jr. — `h7902`
- **JSON:** `[1968, 8]` → August 1968
- **Wikipedia:** April 4, 1968
- **Verdict:** WRONG — Off by ~4 months

### 26. Harvey Milk — `h8483`
- **JSON:** `[1978]` → 1978 (no month)
- **Wikipedia:** May 27, 1978
- **Verdict:** NEEDS_VERIFICATION — Year correct but month missing

### 27. Aldo Moro — `h8527`
- **JSON:** `[1978, 11]` → November 1978
- **Wikipedia:** Kidnapped March 16, 1978; killed May 9, 1978
- **Verdict:** WRONG — Both year and month completely wrong. The November date is unrelated to this event.

### 28. Park Chung-hee — `h8572`
- **JSON:** `[1979, 7]` → July 1979
- **Wikipedia:** October 26, 1979
- **Verdict:** WRONG — Off by ~3 months

### 29. Indira Gandhi — `h8829`
- **JSON:** `[1984, 7]` → July 1984
- **Wikipedia:** October 31, 1984
- **Verdict:** WRONG — Off by ~3 months
- **Note:** Entry h8816 `[1984, 2]` = February 1984 is also wrong for Indira Gandhi.

### 30. Juvénal Habyarimana — `h9386`
- **JSON:** `[1994, 11]` → November 1994
- **Wikipedia:** April 6, 1994 (plane shot down near Kigali)
- **Verdict:** WRONG — Off by ~7 months

### 31. Yitzhak Rabin — `h9395`
- **JSON:** `[1995]` → 1995 (no month)
- **Wikipedia:** November 4, 1995
- **Verdict:** NEEDS_VERIFICATION — Year correct but month/day missing

### 32. Benazir Bhutto — `h10018`
- **JSON:** `[2007, 12]` → December 2007
- **Wikipedia:** December 27, 2007
- **Verdict:** CORRECT ✓

### 33. Osama bin Laden — `h10281`
- **JSON:** `[2011, 10]` → October 2011
- **Wikipedia:** May 2, 2011 (Operation Neptune Spear, Abbottabad)
- **Verdict:** WRONG — Off by ~5 months. The October date is completely wrong.

---

## Patterns Observed

1. **Systematic month offset:** Nearly every entry is off by several months. This suggests the `[year, month]` values are not in standard Gregorian calendar.
2. **No Julian/Gregorian correction:** For Roman emperors and pre-1582 dates, no accounting for Julian vs Gregorian calendar differences.
3. **Wrong events:** Item #5 (April 1618 Emperor of China) appears to be a fabricated/non-existent entry. Item #18 conflated Alexander I of Russia with Alexander I of Yugoslavia.
4. **Mismoatched link fields:** e.g., `h6206` has link "Alexander_I" but describes Yugoslav Alexander's assassination.
5. **Only 1 of 33 entries is fully correct** (Benazir Bhutto).

---

## Unresolved Questions

1. **Source of the JSON data?** It appears to be from `histography.io` — were these dates computed from a different calendar system?
2. **Item #5 (April 1618):** What is the intended event? No Chinese emperor died that month. Was it supposed to be the Chongzhen Emperor in April **1644**?
3. **Item #27 Aldo Moro:** November 1978 is the wrong year entirely. Is there a data entry error — was the year supposed to be 1978 with month 5?
4. **Items #26 & #31:** Harvey Milk and Yitzhak Rabin only have year — should be May 27, 1978 and November 4, 1995 respectively.

---

## Recommended Fixes

| ID | Current | Correct |
|----|---------|---------|
| h1204 | [37, 7] | [37, 3] |
| h1208 | [41, 2] | [41, 1] |
| h1237 | [96, 11] | [96, 12] |
| h1284 | [192, 4] | [192, 12] |
| h2568 | [1618, 4] | REMOVE or [1644, 4] |
| h3136 | [1762, 5] | [1762, 7] |
| h3175 | [1769, 5] | [1769, 4] |
| h4384 | [1865, 12] | [1865, 4] |
| h4673 | [1881, 11] | [1881, 9] |
| h4908 | [1894, 3] | [1894, 6] |
| h4946 | [1895, 11] | [1895, 10] |
| h5084 | [1901, 10] | [1901, 9] |
| h5134 | [1903, 8] | [1903, 6] |
| h5443 | [1914, 4] | [1914, 6] |
| h5573 | [1918, 2] | [1918, 7] |
| h5630 | [1918, 11] | [1918, 7] |
| h5631 | [1918, 12] | [1918, 7] |
| h6206 | [1934, 4] | [1934, 10] + fix link |
| h6256 | [1935, 7] | [1935, 9] |
| h6425 | [1940, 2] | [1940, 8] |
| h6729 | [1948, 6] | [1948, 1] |
| h7232 | [1959, 5] | [1959, 9] |
| h7480 | [1963, 2] | [1963, 11] |
| h7690 | [1965, 11] | [1965, 2] |
| h7902 | [1968, 8] | [1968, 4] |
| h8483 | [1978] | [1978, 5] |
| h8527 | [1978, 11] | [1978, 5] |
| h8572 | [1979, 7] | [1979, 10] |
| h8829 | [1984, 7] | [1984, 10] |
| h9386 | [1994, 11] | [1994, 4] |
| h9395 | [1995] | [1995, 11] |
| h10018 | [2007, 12] | [2007, 12] ✓ |
| h10281 | [2011, 10] | [2011, 5] |
