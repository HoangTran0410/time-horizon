# Verification Report: Riots, Wars, Discoveries, Empires, Religion

## Summary

| # | Event | Current Time | Correct Time | Verdict |
|---|-------|-------------|--------------|---------|
| 1 | Lenin leads Bolshevik Revolution | [1917, 7] | [1917, 10] (Oct Rev) or [1917, 4] (return) | WRONG |
| 2 | Rwandan Genocide | [1994, 8] | [1994, 4] (Apr 6) | WRONG |
| 3 | Theory of the Big Bang | [1927] | [1927] | CORRECT |
| 4 | First evidence of Big Bang | [1964] | [1964] or [1965] | CORRECT |
| 5 | Discovery of silver | [-3100] | ~[-4000] to [-3000] | NEEDS_CONTEXT |
| 6 | Discovery of Heliocentrism | [-3000] | [-300] to [-250] | WRONG |
| 7 | Curvature of Earth | [-3000] | [-350] to [-240] | WRONG |
| 8 | Napoleon's Waterloo | [1815, 4] | [1815, 6] (Jun 18) | WRONG |
| 9 | Napoleon's death | — | [1821] | WRONG (if = Waterloo) |
| 10 | Rise of Mesopotamia | [-7500] | [-3500] | WRONG |
| 11 | Birth of Sumer | [-5500] | [-4500] to [-4000] | WRONG |
| 12 | Fall of Soviet Union | [1991, 10] | [1991, 12] (Dec 26) | NEEDS_CONTEXT |
| 13 | End of British Empire | [1997, 7] | [1997, 7] (Jul 1) | CORRECT |
| 14 | Fall of Portuguese Empire | [1999, 11] | [1999, 12] (Dec 20) | NEEDS_CONTEXT |
| 15 | Earliest evidence of religion | [-200000] | ~[-100000] to [-70000] | WRONG |
| 16 | Earliest evidence of Hominids | [-100000] | ~[-7000000] to [-6000000] | WRONG |
| 17 | Neanderthals defleshing dead | [-98000] | ~[-100000] to [-80000] | CORRECT |

---

## Detailed Findings

### RIOTS (riots.json)

#### 1. Lenin leads the Bolshevik Revolution — [1917, 7] ❌ WRONG

- **July 1917**: Lenin was NOT in a position to "lead" anything. He returned from exile in Switzerland to Russia in **April 1917** (the "sealed train" incident). July 1917 had the **July Days** armed demonstrations in Petrograd — Bolsheviks participated but Lenin did not orchestrate them as a revolution.
- The actual **Bolshevik Revolution** = the **October Revolution**: October 25, 1917 (Julian calendar) / November 7, 1917 (Gregorian calendar).
- **Correct**: `[1917, 10]` (October Revolution, Gregorian November) or `[1917, 4]` (April 1917 return from exile).

---

### WARS (wars.json)

#### 2. Rwandan Genocide — [1994, 8] ❌ WRONG

- Conventionally dated to **April 6, 1994** — the day President Jabyarimana's plane was shot down, triggering mass killings.
- Lasted ~100 days (April–July 1994). August is the tail end, not the start.
- **Correct**: `[1994, 4]` or `[1994, 4, 6]`.

#### 3. Napoleon's defeat at Waterloo — [1815, 4] ❌ WRONG

- Battle of Waterloo: **June 18, 1815**.
- April 1815 is off by ~2 months.
- **Correct**: `[1815, 6]` (or `[1815, 6, 18]`).

#### 4. Napoleon's death — ❌ WRONG (if entry = Waterloo)

- Napoleon died **May 5, 1821** on Saint Helena.
- **Correct**: `[1821, 5]` (or `[1821, 5, 5]`).

---

### DISCOVERIES (discoveries.json)

#### 5. Theory of the Big Bang — [1927] ✅ CORRECT

- Georges Lemaître proposed his theory in a **1927 paper** published in *Annales de la Société Scientifique de Bruxelles* ("Un univers homogène de masse constante et de rayon croissant, rendant compte de la vitesse radiale des nébuleuses extragalactiques").
- Note: The term "Big Bang" was coined by Fred Hoyle in **1949**. Lemaître originally called it the "primeval atom" hypothesis.
- **Correct**: `[1927]`.

#### 6. First evidence of the Big Bang — [1964] ✅ CORRECT (with note)

- Arno Penzias and Robert Wilson discovered the Cosmic Microwave Background in **1964** (published 1965).
- **Correct**: `[1964]` or `[1965]`. Both defensible — observation vs. publication.

#### 7. Discovery of silver — [-3100] ⚠️ NEEDS_CONTEXT

- Earliest silver artifacts found in **Mesopotamia/Sumer dating to ~4000 BCE**. Silver smelting/refinement documented in **Anatolia around 3000 BCE**.
- `-3100 BCE` is closer to the Anatolian date but misses the Sumerian artifacts (~4000 BCE).
- **Correct range**: `[-4000]` to `[-3000]`. Specify region for precision.

#### 8. Discovery of Heliocentrism — [-3000] ❌ WRONG

- Aristarchus of Samos proposed heliocentrism around **255 BCE** (3rd century BCE, ~280–250 BCE range).
- **-3000 BCE is off by ~2,700 years.**
- **Correct**: `[-300]` to `[-250]`.

#### 9. Discovery of the curvature of the Earth — [-3000] ❌ WRONG

- Earth's sphericity accepted by ancient Greeks by **~350 BCE** (Aristotle). Eratosthenes measured Earth's circumference around **240 BCE**.
- **-3000 BCE is off by ~2,800 years.**
- **Correct**: `[-350]` to `[-240]`.

---

### EMPIRES (empires.json)

#### 10. Rise of Mesopotamia — [-7500] ❌ WRONG

- Mesopotamia (Sumerian civilization) emerged around **3500–3100 BCE** with the rise of Uruk and other city-states.
- **-7500 BCE is Neolithic era, ~4,000 years too early.**
- **Correct**: `[-3500]` to `[-3100]`.

#### 11. Birth of Sumer, first civilization — [-5500] ❌ WRONG

- Sumerian civilization generally dated to **~4500–4000 BCE**. Earliest Sumerian texts date ~3100 BCE.
- **-5500 BCE is ~1,000–1,500 years too early.**
- **Correct**: `[-4500]` to `[-4000]`.

#### 12. Fall of the Soviet Union — [1991, 10] ⚠️ NEEDS_CONTEXT

- **October 1991**: The **Alma-Ata Protocol** (Oct 18, 1991) — 9 republics agreed on CIS framework; Russian Supreme Soviet transferred Soviet functions to Russian government. Significant institutional dismantling.
- **December 26, 1991**: The Supreme Soviet formally dissolved the USSR — the **conventional end date**.
- **Correct**: `[1991, 12]` (conventional) or `[1991, 10]` (institutional collapse begins). Depends on semantic definition.

#### 13. End of the British Empire — [1997, 7] ✅ CORRECT

- Hong Kong handover to China: **July 1, 1997**. Last major colony; widely accepted as the end of the British Empire.
- **Correct**: `[1997, 7]` (or `[1997, 7, 1]`).

#### 14. Fall of the Portuguese Empire — [1999, 11] ⚠️ NEEDS_CONTEXT

- Macau handover to China: **December 20, 1999**. November 1999 was the period of final ceremonies and preparations.
- Formal end of Portuguese Empire: **December 31, 1999**.
- **Correct**: `[1999, 12]` (or `[1999, 12, 20]`).

---

### RELIGION (religion.json)

#### 15. Earliest evidence of religion — [-200000] ❌ WRONG

- No credible archaeological evidence for ritual/religion this old. Hominins with sufficient brain structure for symbolic thought appear ~200,000 years ago, but earliest burial evidence (Neanderthals + early *Homo sapiens*) is ~**100,000–70,000 years ago**.
- The 200,000-year mark roughly aligns with earliest *Homo sapiens*, not religion.
- **Correct**: `[-100000]` to `[-70000]`.

#### 16. Earliest evidence of Hominids — [-100000] ❌ WRONG

- Earliest hominins (human lineage): **Sahelanthropus tchadensis** (~7–6 million years ago). The human-chimp divergence ~8–6 Ma.
- **-100,000 years is off by a factor of ~70x.**
- **Correct**: `[-7000000]` to `[-6000000]` (or in BP notation: `[7000000]`).

#### 17. Neanderthals defleshing dead — [-98000] ✅ CORRECT (with caveat)

- Shanidar Cave evidence: intentional Neanderthal burials dated to **~100,000–80,000 years ago** (2020–2023 studies).
- The "-98,000" figure is within the accepted range. Caveat: the "defleshing" interpretation is debated; evidence is more consistent with deliberate burial than defleshing *per se*.
- **Correct**: `[-100000]` or `[-80000]`.

---

## Recommendations

### HIGH PRIORITY (major date errors, 1000+ year off):
- #6 Heliocentrism: `[-300]` not `[-3000]`
- #7 Earth curvature: `[-300]` not `[-3000]`
- #10 Mesopotamia: `[-3500]` not `[-7500]`
- #11 Sumer: `[-4500]` not `[-5500]`
- #16 Hominids: `[-7000000]` not `[-100000]`
- #1 Lenin: `[1917, 10]` not `[1917, 7]`
- #2 Rwandan Genocide: `[1994, 4]` not `[1994, 8]`
- #8 Waterloo: `[1815, 6]` not `[1815, 4]`
- #9 Napoleon death: `[1821]` if recording death

### MEDIUM PRIORITY:
- #5 Silver: clarify "discovery" (native silver ~4000 BCE; smelting ~3000 BCE)
- #15 Religion: `[-100000]` not `[-200000]`

### LOW PRIORITY (semantic/context dependent):
- #12 Soviet Union: Oct vs Dec 1991
- #14 Portuguese Empire: Nov vs Dec 1999

---

## Unresolved Questions

1. **#1 Lenin**: Should the event be the **October Revolution** (`[1917, 10]`) or his **April 1917 return** (`[1917, 4]`)? Need clarification on what "Lenin leads the Bolshevik Revolution" intends.
2. **#9 Napoleon**: Is the current `[1815, 4]` entry meant for Waterloo (correct: `[1815, 6]`) or Napoleon's death (correct: `[1821]`)? These are two different events.
3. **#5 Silver**: Does "discovery" mean first known native silver use (~4000 BCE) or first silver smelting/refinement (~3000 BCE)?
4. **#17 Neanderthals**: Should this be labeled "Neanderthal intentional burial" rather than "defleshing"?

---

*Sources: Wikipedia, Smithsonian Human Origins Program, Nature/Science journals (Shanidar), Britannica.*
