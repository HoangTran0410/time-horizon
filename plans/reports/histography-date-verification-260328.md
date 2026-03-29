# Histography Date Verification Report
**Date:** 2026-03-28 | **Scope:** 18 JSON files, ~10K events | **Method:** Web search (Wikipedia/scientific sources)

---

## Summary

| Category | Events Checked | Wrong Dates Fixed | Removed |
|----------|------------|-------------------|---------|
| assassinations | 66 | 34 | 1 |
| riots | 707 | 1 | 0 |
| wars | 1587 | 2 | 0 |
| discoveries | 232 | 2 | 0 |
| empires | 377 | 3 | 0 |
| religion | 140 | 2 | 0 |
| evolution | 100 | 2 | 0 |
| human-prehistory | 137 | 1 | 0 |
| inventions | 717 | 2 | 0 |
| literature | 1922 | 1 | 0 |
| construction | 1011 | 2 | 0 |
| **TOTAL** | **~10K** | **52** | **1** |

**Backup:** `src/data/collections/histography_backup/`

---

## Corrections Applied

### assassinations.json (34 fixes + 1 removal)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h1204 | Emperor Tiberius death | `[37, 7]` (Jul) | `[37, 3]` (Mar) | Died Mar 16, 37 CE |
| h1208 | Caligula death | `[41, 2]` (Feb) | `[41, 1]` (Jan) | Died Jan 24, 41 CE |
| h1237 | Domitian death | `[96, 11]` (Nov) | `[96, 12]` (Dec) | Died Dec 18, 96 CE |
| h1284 | Commodus death | `[192, 4]` (Apr) | `[192, 12]` (Dec) | Died Dec 31, 192 CE |
| h2568 | Emperor of China assassinated | `[1618, 4]` | **REMOVED** | No emperor died April 1618 |
| h3136 | Peter III of Russia death | `[1762, 5]` (May) | `[1762, 7]` (Jul) | Died Jul 17, 1762 |
| h3175 | Chief Pontiac death | `[1769, 5]` (May) | `[1769, 4]` (Apr) | Died Apr 20, 1769 |
| h4384 | Lincoln assassination | `[1865, 12]` (Dec) | `[1865, 4]` (Apr) | Assassinated Apr 14, 1865 |
| h4673 | James Garfield death | `[1881, 11]` (Nov) | `[1881, 9]` (Sep) | Died Sep 19, 1881 |
| h4908 | Sadi Carnot death | `[1894, 3]` (Mar) | `[1894, 6]` (Jun) | Died Jun 25, 1894 |
| h4946 | Queen Min of Korea death | `[1895, 11]` (Nov) | `[1895, 10]` (Oct) | Died Oct 8, 1895 |
| h5084 | McKinley assassination | `[1901, 10]` (Oct) | `[1901, 9]` (Sep) | Shot Sep 6, died Sep 14 |
| h5134 | King Alexander I of Serbia death | `[1903, 8]` (Aug) | `[1903, 6]` (Jun) | Died Jun 11, 1903 (Gregorian) |
| h5443 | Franz Ferdinand assassination | `[1914, 4]` (Apr) | `[1914, 6]` (Jun) | Assassinated Jun 28, 1914 |
| h5573 | Nicholas II execution | `[1918, 2]` (Feb) | `[1918, 7]` (Jul) | Executed Jul 17, 1918 |
| h5630 | Anastasia execution | `[1918, 11]` (Nov) | `[1918, 7]` (Jul) | Executed Jul 17, 1918 |
| h5631 | Alexandra Feodorovna execution | `[1918, 12]` (Dec) | `[1918, 7]` (Jul) | Executed Jul 17, 1918 |
| h6206 | Alexander I assassination | `[1934, 4]` (Apr) | `[1934, 10]` (Oct) | Yugoslavia's Alexander I assassinated Oct 9, 1934 |
| h6256 | Huey Long death | `[1935, 7]` (Jul) | `[1935, 9]` (Sep) | Died Sep 8, 1935 |
| h6425 | Trotsky death | `[1940, 2]` (Feb) | `[1940, 8]` (Aug) | Died Aug 21, 1940 |
| h6729 | Gandhi assassination | `[1948, 6]` (Jun) | `[1948, 1]` (Jan) | Assassinated Jan 30, 1948 |
| h7232 | PM of Ceylon (Bandaranaike) death | `[1959, 5]` (May) | `[1959, 9]` (Sep) | Died Sep 26, 1959 |
| h7480 | Ngo Dinh Diem assassination | `[1963, 2]` (Feb) | `[1963, 11]` (Nov) | Assassinated Nov 2, 1963 |
| h7690 | Malcolm X assassination | `[1965, 11]` (Nov) | `[1965, 2]` (Feb) | Assassinated Feb 21, 1965 |
| h7902 | MLK assassination | `[1968, 8]` (Aug) | `[1968, 4]` (Apr) | Assassinated Apr 4, 1968 |
| h8483 | Harvey Milk assassination | `[1978]` (year only) | `[1978, 5]` (May) | Assassinated May 27, 1978 |
| h8527 | Aldo Moro death | `[1978, 11]` (Nov) | `[1978, 5]` (May) | Died May 9, 1978 |
| h8572 | Park Chung-hee assassination | `[1979, 7]` (Jul) | `[1979, 10]` (Oct) | Assassinated Oct 26, 1979 |
| h8816 | Indira Gandhi assassination | `[1984, 2]` (Feb) | `[1984, 10]` (Oct) | Assassinated Oct 31, 1984 |
| h8829 | Indira Gandhi assassination | `[1984, 7]` (Jul) | `[1984, 10]` (Oct) | Assassinated Oct 31, 1984 |
| h9386 | Habyarimana death | `[1994, 11]` (Nov) | `[1994, 4]` (Apr) | Died Apr 6, 1994 |
| h9395 | Yitzhak Rabin assassination | `[1995]` (year only) | `[1995, 11]` (Nov) | Assassinated Nov 4, 1995 |
| h9997 | Benazir Bhutto assassination | `[2007, 7]` (Jul) | `[2007, 12]` (Dec) | Assassinated Dec 27, 2007 |
| h10281 | Osama bin Laden death | `[2011, 10]` (Oct) | `[2011, 5]` (May) | Died May 2, 2011 |

### riots.json (1 fix)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h5550 | Lenin leads Bolshevik Revolution | `[1917, 7]` (Jul) | `[1917, 11]` (Nov) | October/November Revolution Nov 7, 1917 |

### wars.json (2 fixes)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h3632 | Napoleon defeated at Waterloo | `[1815, 4]` (Apr) | `[1815, 6]` (Jun) | Battle of Waterloo Jun 18, 1815 |
| h9370 | Rwandan Genocide | `[1994, 8]` (Aug) | `[1994, 4]` (Apr) | Began Apr 6, 1994 after plane shot down |

### discoveries.json (2 fixes)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h667 | Discovery of Heliocentrism | `[-3000]` | `[-300]` | Aristarchus proposed ~255 BCE |
| h666 | Curvature of Earth discovered | `[-3000]` | `[-240]` | Eratosthenes measured ~240 BCE |

### empires.json (3 fixes)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h567 | Rise of Mesopotamia | `[-7500]` | `[-3500]` | Sumerian civilization ~3500 BCE |
| h598 | Birth of Sumer | `[-5500]` | `[-4500]` | Sumer ~4500-4000 BCE |
| h9607 | Fall of Portuguese Empire | `[1999, 11]` (Nov) | `[1999, 12]` (Dec) | Macau handover Dec 20, 1999 |

### religion.json (2 fixes)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h409 | Earliest evidence of religion | `[-200000]` | `[-100000]` | Burial evidence ~100-70 Ka |
| h418 | Earliest evidence of Hominids | `[-100000]` | `[-7000000]` | Sahelanthropus ~7-6 Ma |

### evolution.json (2 fixes)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h626 | American Mastodon extinction | `[-4000]` | `[-8000]` | Extinct ~10,000 years ago |
| h392 | Lion evolved | `[-900000]` | `[-2000000]` | Panthera leo ~2 Ma |
| h503 | Light skin Europeans | `[-15000]` | `[-8000]` | Alleles spread ~8-4 Ka |

### human-prehistory.json (1 fix)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h337 | Homo erectus legs grew longer | `[-8900000]` | `[-1900000]` | H. erectus emerged ~1.9 Ma |

### inventions.json (2 fixes)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h372 | First use of Stone tools | `[-2500000]` | `[-3300000]` | Lomekwi 3 site ~3.3 Ma |
| h5183 | Einstein Theory of Relativity | `[1905, 2]` (Feb) | `[1905, 6]` (Jun) | Published Jun 30, 1905 |

### literature.json (1 fix)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h677 | The I Ching written | `[-2800]` | `[-1000]` | Traditionally compiled ~1000 BCE |

### construction.json (2 fixes)

| ID | Event | Was | Now | Notes |
|----|-------|-----|-----|-------|
| h422 | First stone structures at Jericho | `[-90000]` | `[-8000]` | Neolithic ~8000 BCE (factor 9 error) |
| h511 | First stone structures | `[-12000]` | `[-8000]` | Neolithic ~8000 BCE |

---

## Known Remaining Ambiguities (not fixed — need context)

| ID | Event | Current | Question |
|----|-------|---------|----------|
| h5967 | Theory of the Big Bang | `[1927]` | 1927 = Lemaître's paper (correct). The "event" Big Bang is -13.8 Ga. Keep as-is. |
| h7561 | First evidence of Big Bang | `[1964]` | 1964 = CMB discovery (correct). Keep as-is. |
| h5630 | Anastasia assassination | `[1918, 7]` | Anna Anderson claimed survival until 1984. July 17, 1918 is the execution date. Correct. |
| h503 | Evolution of light skin Europeans | `[-8000]` | Was -15000. Now -8000. Some argue for ~6000 BCE. Reasonable estimate. |

## Unresolved Questions

1. **Mozart music events** (music.json): 28 Mozart events flagged. These are career milestones (compositions, premieres), not death dates. The current dates for Mozart's symphonies/opera premieres are plausible but not individually verified. Recommend: review Mozart events if accuracy is critical.
2. **h2568 "Emperor of China assassinated"**: Removed — no emperor died in April 1618. If this entry should reference a specific event, clarify which emperor.
3. **"First tribe"** (human-prehistory.json, h353, `-4400000`): Anthropologically ambiguous — no specific fossil event matches. Could be dropped or clarified.
4. **Beatles landing** (music.json): `[1964]` — Beatles landed Feb 7, 1964. Current year is correct, no month specified. Should be `[1964, 2]` or `[1964]`.
5. **Kikai Caldera eruption** (natural-history.json): `-4350` BCE — may be correct for a specific Kikai eruption, or should be ~6300 BCE for the major eruption. Needs clarification.
