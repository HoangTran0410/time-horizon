import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const collectionsDir = path.join(
  projectRoot,
  "src/data/collections/histography",
);

const args = new Set(process.argv.slice(2));
const isCheckMode = args.has("--check");
const isVerbose = args.has("--verbose");

const normalizeTitle = (value) =>
  String(value ?? "")
    .replaceAll("&#160;", " ")
    .replaceAll("&amp;", " and ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const createRule = (pattern, emoji) => ({ pattern, emoji });

const categoryConfigs = {
  art: {
    fallback: "🎨",
    rules: [
      createRule(
        /(christ|virgin|annunciation|resurrection|judgement|baptism|madonna|lamb|angel|saint |st\.)/u,
        "✝️",
      ),
      createRule(
        /(venus|aphrodite|leda|swan|bacchus|ariadne|apollo|adam and eve)/u,
        "🏛️",
      ),
      createRule(
        /(paint|painting|painted|drawn|drawing|illustration|fresco|mural|landscape|still life|wave|night|sunflowers|bedroom|guernica|flag\b|school of athens|last supper|mona lisa|sistine chapel)/u,
        "🖼️",
      ),
      createRule(
        /(portrait|self-portrait|madonna|wedding|woman|girl|child|lady|boy|doctor gachet|ambroise vollard|marilyn|\bman\b)/u,
        "🖼️",
      ),
      createRule(
        /(perform|performed|festival|exhibition|museum|art show|art school|biennale)/u,
        "🎭",
      ),
      createRule(
        /(sculpt|statue|bust|moai|colossal heads|heads\b|diskobolus|venus of|aphrodite|david|thinker|prisoners|lion-human|christ the redeemer|motherland calls|christ the king|cristo )/u,
        "🗿",
      ),
    ],
  },
  assassinations: {
    fallback: "🗡️",
    rules: [
      createRule(/(shot|shoot|gun|gunned)/u, "🔫"),
      createRule(/(attempt)/u, "🎯"),
      createRule(/(murder|death|poison)/u, "☠️"),
    ],
  },
  construction: {
    fallback: "🏗️",
    rules: [
      createRule(/(complex|site|ruins|levels)/u, "🏛️"),
      createRule(/(baths?|thermae)/u, "♨️"),
      createRule(/(bridge|aqueduct|viaduct|stari most|\bmost\b)/u, "🌉"),
      createRule(/(mosque|minaret|dome of the rock)/u, "🕌"),
      createRule(/(temple|shrine|stupa|pagoda|chaitya)/u, "🛕"),
      createRule(
        /(church|cathedral|abbey|chapel|basilica|hagia sophia|notre dame|saint |st\.|santa |san |s\. )/u,
        "⛪",
      ),
      createRule(/(castle|fortress|fort\b|palace|chateau|kremlin|citadel)/u, "🏰"),
      createRule(/(library|scriptorium)/u, "📚"),
      createRule(
        /(theatre|theater|stadium|forum|market|stoa|piazza|circus|colosseum|amphitheatre)/u,
        "🏛️",
      ),
      createRule(
        /(house|hall|villa|college|hospital|office building|farmhouse|storehouse|town|city|street|pueblo|building)/u,
        "🏠",
      ),
      createRule(
        /(pyramid|sphinx|stonehenge|dolmen|obelisk|gate|wall|mausoleum|tomb|necropolis|treasury)/u,
        "🗿",
      ),
      createRule(/(dam|levee)/u, "🧱"),
      createRule(/(garden)/u, "🌳"),
    ],
  },
  disasters: {
    fallback: "⚠️",
    rules: [
      createRule(/(depression|smog|fog|pollution|oil spill|gas leak|dioxin|destruction of the aral sea)/u, "🏭"),
      createRule(
        /(plague|epidemic|smallpox|measles|yellow fever|malaria|cholera|black death|cocoliztli|pox|typhus|flu|disease|bubonic)/u,
        "☣️",
      ),
      createRule(/(massacre)/u, "☠️"),
      createRule(/(accident|incident|airship disaster|airport disaster|bridge disaster|shuttle|space shuttle)/u, "💥"),
      createRule(/(bombing|bombardment)/u, "💣"),
      createRule(/(earthquake|quake)/u, "🌎"),
      createRule(/(volcano|eruption|pompeii)/u, "🌋"),
      createRule(/(flood|tsunami|sinking|shipwreck|vasa)/u, "🌊"),
      createRule(/(hurricane|cyclone|typhoon|tornado|storm)/u, "🌀"),
      createRule(/(fire|burn|inferno|wildfire)/u, "🔥"),
      createRule(/(collapse|crash|explosion|blast)/u, "💥"),
      createRule(/(famine|drought)/u, "🌾"),
      createRule(/(nuclear|reactor|radiation)/u, "☢️"),
    ],
  },
  discoveries: {
    fallback: "🔬",
    rules: [
      createRule(/(cell|microscopic organisms?|microorganisms?|bacteria)/u, "🦠"),
      createRule(/(oxygen|electricity|methane|hydrogen|element|field)/u, "⚗️"),
      createRule(/(journal published)/u, "📰"),
      createRule(
        /(heliocentr|solar|sun|moon|planet|star|quasar|supernova|eclipse|astronom|comet|earth moves around the sun)/u,
        "🔭",
      ),
      createRule(
        /(curvature of the earth|tides|gravity|speed theorem|refraction|force|acceleration|kinetic|density|theorem|law|geometry|euclid|mathemat|model|rainbow)/u,
        "📐",
      ),
      createRule(
        /(silver|gold|metal|kerosene|petroleum|distilled|transmutation|elements|reaction|air density|chem)/u,
        "⚗️",
      ),
      createRule(
        /(medicine|smallpox|circulation|medical|anatomy|anatomical|pulmonary|canon of medicine)/u,
        "🩺",
      ),
      createRule(/(plant|coffee|fossil|species|botan)/u, "🌿"),
      createRule(/(controlled experiments|scientific method|observations?|spontaneous generation|calculus)/u, "🔬"),
      createRule(
        /(exploration|voyage|travel|reach|cross|land for the first time|columbus|marco polo|vikings|european to|discovers america|discover(y|ed) of canada|discovery of new zealand|india by sea|route|trip around the world|sailing around the world|coast exploration|expedition|pacific ocean|permanent european settlement|colony established|cape town founded|el dorado)/u,
        "🧭",
      ),
    ],
  },
  empires: {
    fallback: "👑",
    rules: [
      createRule(/(fall|disintegration|collapse|the last king|end of)/u, "🏚️"),
      createRule(/(war|conquest|invasion)/u, "⚔️"),
      createRule(/(civilization|culture|city-states|republic|silk road)/u, "🏛️"),
      createRule(
        /(rise|rises|founded|founding|birth|begins|established|emergence|emerge|comes to power|unifies)/u,
        "👑",
      ),
    ],
  },
  evolution: {
    fallback: "🧬",
    rules: [
      createRule(/(legs|limbs|bipedalism)/u, "👣"),
      createRule(/(lungs|breathe|palate|jaw)/u, "🫁"),
      createRule(/(bacteria|cells?|oxygen|micro|organisms?)/u, "🦠"),
      createRule(/(jellyfish|cnidaria)/u, "🪼"),
      createRule(/(eyes?|detect light)/u, "👁️"),
      createRule(/(brain|neocortex|nervous system)/u, "🧠"),
      createRule(/(worm)/u, "🪱"),
      createRule(
        /(fish|vertebrates?|conodont|pikaia|myllokunmingia|haikou|lamprey|hagfish|lungfish|coelacanth|sarcopterygii|placodermi)/u,
        "🐟",
      ),
      createRule(/(plant|photosynthesis|alga|algae)/u, "🌿"),
      createRule(/(spider)/u, "🕷️"),
      createRule(/(tetrapod|amphibian|ichthyostega|tiktaalik|panderichthys|acanthostega)/u, "🐸"),
      createRule(/(reptile|dinosaur|archosaur|lizard|hylonomus|amniota)/u, "🦎"),
      createRule(/(pterosaur)/u, "🦅"),
      createRule(/(bird|avian|penguin|owl|feather|flight)/u, "🐦"),
      createRule(/(homin|primate|ape|orangutan|chimpanzee)/u, "🐒"),
      createRule(/(mammal|tiger|rabbit|squirrel|kangaroo|koala|mouse|mice|platypus|echidna|bear|zebra|sloth|panda)/u, "🐾"),
      createRule(/(egg|reproduction|keratin)/u, "🥚"),
      createRule(/(cambrian explosion)/u, "💥"),
    ],
  },
  "human-prehistory": {
    fallback: "🧍",
    rules: [
      createRule(/(homo|australopithecus|neanderthal|floresiensis|cro-magnon|denisova|denisovan)/u, "🧍"),
      createRule(/(legs?|feet|footprints?|knee|spine|hip|bipedal|walk|shoes worn)/u, "👣"),
      createRule(/(speech|language)/u, "🗣️"),
      createRule(/(brain)/u, "🧠"),
      createRule(/(hunt|herds|slaughtered|spear|arrow|horse hunting)/u, "🏹"),
      createRule(/(fish|fishing|nets)/u, "🎣"),
      createRule(/(clothes|wearing)/u, "👕"),
      createRule(/(cooked|fire)/u, "🔥"),
      createRule(
        /(migration|spread|move|reach|colonization|settled|settlement|occupy|inhabited|emergence of jericho)/u,
        "🚶",
      ),
      createRule(/(burial|mortuary|cremation|ritual)/u, "⚱️"),
      createRule(/(jewelry|ornaments?)/u, "📿"),
      createRule(/(tribe|community)/u, "👥"),
      createRule(/(harvesting|domestication|domesticated|breeding|exchange system|cities|ceramic|vessels|fibers|symbols|concepts)/u, "🌾"),
      createRule(/(dog)/u, "🐕"),
      createRule(/(pig|sheep|goat|reindeer|horse|cow|cattle|cats?|chili peppers|bottle gourd|cereals?|wheat|plants?)/u, "🌾"),
    ],
  },
  inventions: {
    fallback: "💡",
    rules: [
      createRule(/(gunpowder|land mine)/u, "💣"),
      createRule(/(printing press)/u, "🖨️"),
      createRule(/(eyeglasses)/u, "👓"),
      createRule(/(pocket watch|watch|clock|clockwork)/u, "⌚"),
      createRule(/(microscope)/u, "🔬"),
      createRule(/(telescope|reflecting telescope)/u, "🔭"),
      createRule(/(thermometer|barometer|air pump)/u, "🧪"),
      createRule(/(calculator|adding machine|calculating machine|binary number)/u, "🧮"),
      createRule(/(blood transfusion)/u, "🩸"),
      createRule(/(piano)/u, "🎹"),
      createRule(/(windmill)/u, "🌬️"),
      createRule(/(scissors)/u, "✂️"),
      createRule(/(nail)/u, "📌"),
      createRule(/(chimney)/u, "🏠"),
      createRule(/(whisky)/u, "🥃"),
      createRule(/(tools?|axes|axe|saws|forge|cutting)/u, "🛠️"),
      createRule(/(fire|hearth|kiln)/u, "🔥"),
      createRule(/(shelter|building bricks|brick|dam|stairs)/u, "🧱"),
      createRule(/(spear|bow|arrow|spearhead|crossbow|catapult|trebuchet)/u, "🏹"),
      createRule(/(pigment|glue|ink|paint|lacquer)/u, "🧪"),
      createRule(/(jewell|jewelry)/u, "💍"),
      createRule(/(burial|cremation)/u, "⚱️"),
      createRule(/(bed)/u, "🛏️"),
      createRule(/(flute|pipe|music)/u, "🪈"),
      createRule(/(fish hooks?)/u, "🎣"),
      createRule(/(needle|sewing)/u, "🪡"),
      createRule(/(rope|basket)/u, "🧺"),
      createRule(/(pottery|potters wheel|ceramic|lamp)/u, "🏺"),
      createRule(/(wine)/u, "🍷"),
      createRule(/(beer)/u, "🍺"),
      createRule(/(tea)/u, "🍵"),
      createRule(/(boat|sailing|oars|canal lock)/u, "⛵"),
      createRule(/(calendar)/u, "📅"),
      createRule(/(agriculture|plough|plow|\bwell\b|water system)/u, "🌾"),
      createRule(/(soup)/u, "🍲"),
      createRule(/(writing|pictograph|cuneiform|alphabet|papyrus|paper|grammar)/u, "✍️"),
      createRule(/(numeral system|binary numeral)/u, "🔢"),
      createRule(/(compass)/u, "🧭"),
      createRule(/(wheel|watermill|wheelbarrow|steam power)/u, "⚙️"),
      createRule(/(toilet paper)/u, "🧻"),
      createRule(/(silk)/u, "🧵"),
      createRule(/(bronze|iron|cast iron)/u, "⚒️"),
    ],
  },
  literature: {
    fallback: "📖",
    rules: [
      createRule(/(library)/u, "📚"),
      createRule(/(poems?|odes|sonnet|verse|fragments)/u, "📝"),
      createRule(/(play|tragedy|comedy|theater|theatre|bacchae|lysistrata|antigone|medea|oedipus)/u, "🎭"),
      createRule(/(newspaper|journal|magazine|gazette|review|times\b)/u, "📰"),
      createRule(/(dictionary|encyclopedia|lexicon)/u, "📘"),
      createRule(/(war|conquest|expedition)/u, "⚔️"),
      createRule(/(histories|history|lives|chronicle|annals)/u, "📜"),
      createRule(/(book of the dead|rig veda|bhagavad gita|i ching)/u, "🛐"),
      createRule(/(essay|manifesto|tract|letters?|laws|ethics|politics|republic|symposium|apology)/u, "📜"),
    ],
  },
  music: {
    fallback: "🎵",
    rules: [
      createRule(/(dance|tap dance|waltz)/u, "💃"),
      createRule(/(album|record|single|gramophone|phonograph)/u, "💿"),
      createRule(/(song|singer|vocal|choir)/u, "🎤"),
      createRule(/(opera|operetta|premiere|premieres|produced|performed)/u, "🎭"),
      createRule(/(musical theory|theory|symphony|concerto|sonata|quartet|opus|composition)/u, "🎼"),
      createRule(/(harp)/u, "🪉"),
      createRule(/(radio|broadcast)/u, "📻"),
      createRule(/(school|philharmonic|academy of music|fraternity|society of composers|deutsche opernhaus)/u, "🎶"),
      createRule(/(theatre|theater|hall|carnegie hall|music box)/u, "🏛️"),
      createRule(/(shot|dies after being shot)/u, "🔫"),
      createRule(/(piano|organ|harpsichord|keyboard|pianist)/u, "🎹"),
      createRule(/(violin|viola|cello|fiddle|string quartet)/u, "🎻"),
      createRule(/(guitar)/u, "🎸"),
      createRule(/(flute|pipe|oboe)/u, "🪈"),
      createRule(/(drum)/u, "🥁"),
      createRule(/(trumpet|horn|saxophone)/u, "🎺"),
      createRule(/(concert|festival|music store|opera house|musical society)/u, "🎶"),
    ],
  },
  nationality: {
    fallback: "🗺️",
    rules: [
      createRule(/(independence|liberation|sovereign)/u, "🗽"),
      createRule(/(eurozone)/u, "💶"),
      createRule(/(purchase|cession|annex|transfer)/u, "📜"),
      createRule(/(union|unification|federation)/u, "🤝"),
      createRule(/(civilization|dynasty|kingdom|republic)/u, "👑"),
    ],
  },
  "natural-history": {
    fallback: "🌌",
    rules: [
      createRule(/(big bang)/u, "💥"),
      createRule(/(galax|milky way|quasar|cosmic)/u, "🌌"),
      createRule(/(star)/u, "⭐"),
      createRule(/(sun)/u, "☀️"),
      createRule(
        /(solar system|saturn|jupiter|neptune|uranus|venus|mars|mercury|pluto|giant planets|gas giants)/u,
        "🪐",
      ),
      createRule(/(earth)/u, "🌍"),
      createRule(/(moon)/u, "🌕"),
      createRule(/(asteroid|comet|impact|bombardment)/u, "☄️"),
      createRule(/(mineral|rock|crust|shield|belt|orogeny|supercontinent|volcanic|volcano|komatiite)/u, "🪨"),
      createRule(/(ocean|sea|floods|water)/u, "🌊"),
      createRule(/(oxygen|ozone|atmosphere)/u, "🌫️"),
      createRule(/(photosynthetic|alga|algae)/u, "🌿"),
      createRule(/(protozoa|bacteria|eukaryote|slime molds|acritarch|stromatolite|life|fossil)/u, "🦠"),
      createRule(/(worm|burrows)/u, "🪱"),
      createRule(/(arthropod)/u, "🦐"),
      createRule(/(fungi)/u, "🍄"),
      createRule(/(mollusk|kimberella|small shelly fauna)/u, "🐚"),
      createRule(/(corals|sponges|comb-jellies|anemones)/u, "🪸"),
      createRule(/(gondwana|rodinia|arctica|atlantica|columbia)/u, "🪨"),
      createRule(/(sexually reproducing)/u, "🧬"),
      createRule(/(life|fossil|bacteria|eukaryote|slime molds|acritarch|stromatolite)/u, "🦠"),
    ],
  },
  politics: {
    fallback: "🏛️",
    rules: [
      createRule(/(treaty|peace|alliance|accord|union|pact)/u, "🤝"),
      createRule(/(charter|golden bull|edict|declaration|provisions|dictum|covenant|truce|claims |claims\b|divides the new world)/u, "📜"),
      createRule(/(founded|founded in|city of|florence)/u, "🏙️"),
      createRule(/(ends the )/u, "🕊️"),
      createRule(/(democracy|republic|constitution|election|vote|parliament|assembly|senate)/u, "🗳️"),
      createRule(/(king|emperor|caesar|president|prime minister|pm\b|becomes|became|rise to power|coronation)/u, "👑"),
      createRule(/(overthrows|submits|occupation)/u, "⚔️"),
      createRule(/(olympic games)/u, "🏅"),
    ],
  },
  religion: {
    fallback: "🛐",
    rules: [
      createRule(/(mosque|islam|quran|muhammad|sunni|shiites?)/u, "🕌"),
      createRule(/(church|cathedral|abbey|basilica|chapel|monastery|christian|gospel|pope|jesus|christ|council|bible)/u, "✝️"),
      createRule(/(temple|shrine|pyramid)/u, "🛕"),
      createRule(/(buddh|tirthankar)/u, "☸️"),
      createRule(/(hindu|rigveda|veda|kaliyuga|yoga)/u, "🕉️"),
      createRule(/(torah|judaism|hebrew|israel)/u, "✡️"),
      createRule(/(confuc|taoism|tao te ching)/u, "☯️"),
      createRule(/(sikh)/u, "☬"),
      createRule(/(inquisition|heresy|persecution|crusade|religious conflicts)/u, "⚔️"),
      createRule(/(edict)/u, "📜"),
      createRule(/(zoroastr)/u, "🔥"),
      createRule(/(burial|cremation|dead)/u, "⚱️"),
      createRule(/(texts?|written|story|flood|exodus|epic)/u, "📜"),
    ],
  },
  riots: {
    fallback: "✊",
    rules: [
      createRule(/(massacre)/u, "☠️"),
      createRule(/(civil war|uprising|storming)/u, "⚔️"),
      createRule(/(tea party)/u, "🍵"),
      createRule(/(bread|food|flour|potato)/u, "🍞"),
      createRule(/(gin|whiskey|rum)/u, "🥃"),
      createRule(/(beer|lager)/u, "🍺"),
      createRule(/(strike)/u, "🪧"),
      createRule(/(election riot)/u, "🗳️"),
      createRule(/(opera riot)/u, "🎭"),
      createRule(/(police riot)/u, "🚨"),
      createRule(/(plague riot|cholera riots)/u, "☣️"),
    ],
  },
  wars: {
    fallback: "⚔️",
    rules: [
      createRule(/(battle)/u, "🛡️"),
      createRule(/(civil war)/u, "🏴"),
      createRule(/(conquest|destruction|fall of)/u, "🔥"),
      createRule(/(holocaust|genocide|massacre|extermination|final solution)/u, "☠️"),
      createRule(/(atomic bomb|bombing|airstrike|bomb|suicide bomb)/u, "💣"),
      createRule(/(cold war)/u, "🥶"),
      createRule(/(rebellion|uprising|revolution|insurgency|mutiny)/u, "✊"),
      createRule(/(occupation|campaign|invasion|attack|siege)/u, "🪖"),
      createRule(/(incident|crisis|dispute|skirmish|conflict)/u, "🛡️"),
      createRule(/(wall)/u, "🧱"),
    ],
  },
  "women-rights": {
    fallback: "♀️",
    rules: [
      createRule(/(vote|voting|election|suffrage|stand for election)/u, "🗳️"),
      createRule(/(congress|parliament|cabinet|assembly|supreme court)/u, "🏛️"),
      createRule(/(work|trade|profession|office|pay|employment|job|patent|bank account|earnings|union)/u, "💼"),
      createRule(/(school|university|college|doctor|teacher|medical|lecture|gymnasium|\bph\b)/u, "🎓"),
      createRule(/(property|inheritance|divorce|marriage|wills?|guardianship|law|legalized|banned|rights|court|trial|persons?|affairs)/u, "⚖️"),
      createRule(/(birth control|abortion|maternity|pills|children)/u, "🩺"),
      createRule(/(rape|whipping|shelter)/u, "🛡️"),
      createRule(/(convention|association|league|party|protest|conference|liberation|units? are founded|organization)/u, "✊"),
      createRule(/(newspaper|published|history week)/u, "📰"),
      createRule(/(army|police officer|priest)/u, "👩"),
    ],
  },
};

const pickEmoji = (collectionId, title, currentEmoji) => {
  const config = categoryConfigs[collectionId];

  if (!config) {
    return currentEmoji;
  }

  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) {
    return currentEmoji;
  }

  for (const rule of config.rules) {
    if (rule.pattern.test(normalizedTitle)) {
      return rule.emoji;
    }
  }

  return config.fallback;
};

const main = async () => {
  const entries = await fs.readdir(collectionsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  let changedFiles = 0;
  let changedEvents = 0;

  for (const file of files) {
    const filePath = path.join(collectionsDir, file);
    const collectionId = file.replace(/\.json$/u, "");
    const raw = await fs.readFile(filePath, "utf8");
    const events = JSON.parse(raw);
    let fileChanges = 0;

    for (const event of events) {
      const nextEmoji = pickEmoji(collectionId, event.title, event.emoji);

      if (nextEmoji !== event.emoji) {
        event.emoji = nextEmoji;
        fileChanges += 1;
        changedEvents += 1;
      }
    }

    if (fileChanges > 0) {
      changedFiles += 1;

      if (!isCheckMode) {
        await fs.writeFile(filePath, `${JSON.stringify(events, null, 2)}\n`);
      }
    }

    if (isVerbose || fileChanges > 0) {
      console.log(`${file}\t${fileChanges}`);
    }
  }

  console.log(
    `${isCheckMode ? "Checked" : "Updated"} ${files.length} histography files`,
  );
  console.log(`Changed files: ${changedFiles}`);
  console.log(`Changed events: ${changedEvents}`);

  if (isCheckMode && changedEvents > 0) {
    process.exitCode = 1;
  }
};

await main();
