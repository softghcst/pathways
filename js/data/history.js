// Historical Eras: what changes about life with the year.
//
// Everything a system needs to ask about the past is here, as data. The
// engine (js/engine/history.js) answers questions from it; no other module
// compares the year with a date of its own (the communication-technology
// registry, js/data/digital.js, is the one other dated table, and is reused).
//
// Two kinds of value live here, and they are marked:
//   [fact]      a dated historical fact, with a short source note
//   [estimate]  a gameplay estimate built from a few anchors: plausible, not exact
// Where a country's own history is not recorded, the shared era default applies,
// and the game says it is the period's general rule, not that country's law.

/** The five eras. A life moves through them as the world's year advances. */
export const ERAS = [
  { id: 'early', from: 1800, to: 1918, name: 'Early Era', short: '1800–1918',
    description: 'Farms, workshops, railways and the first factories. Most children leave school young, few go to college, and medicine can do little against infection.',
    careers: 'Mostly farming, trades, domestic service, shops and the old professions.', economy: 'Wages and prices are a small fraction of today\'s.',
    schooling: 'A few years of schooling for most; university for very few.', law: 'Women cannot vote in most countries. Marriage and divorce follow older laws.' },
  { id: 'interwar', from: 1919, to: 1945, name: 'Between the Wars', short: '1919–1945',
    description: 'Radio, the movies and the automobile arrive; the Depression and a second world war follow.',
    careers: 'Factories, offices and the first broadcasting and film jobs.', economy: 'Boom, then the Great Depression.',
    schooling: 'Most leave school at fourteen; university is still rare.', law: 'Women win the vote in many countries. Conscription returns in wartime.' },
  { id: 'midcentury', from: 1946, to: 1969, name: 'Mid-Century', short: '1946–1969',
    description: 'Rebuilding after the war, television in the living room, and a long economic boom.',
    careers: 'Factories, offices and engineering grow; the first computer jobs appear.', economy: 'A long postwar boom in much of the world.',
    schooling: 'Secondary school for most; universities grow.', law: 'Many old restrictions remain, and are starting to be challenged.' },
  { id: 'late20c', from: 1970, to: 1999, name: 'Late 20th Century', short: '1970–1999',
    description: 'Personal computers, cheaper flights, the end of the Cold War, and the early internet.',
    careers: 'Computing, services and media expand.', economy: 'Oil shocks and inflation, then steadier growth.',
    schooling: 'School to sixteen or eighteen; university is common.', law: 'Voting at eighteen; many rights won.' },
  { id: 'now', from: 2000, to: 9999, name: 'Modern Day', short: '2000 onward',
    description: 'The internet, smartphones and the world of today.',
    careers: 'Every career in the game.', economy: 'Today\'s wages and prices.', schooling: 'Today\'s schools and universities.', law: 'Today\'s laws.' },
];
export const ERA_BY_ID = Object.fromEntries(ERAS.map((e) => [e.id, e]));

/**
 * [estimate] The price level and the real wage, relative to today (2025 = 1), at a few
 * anchor years; the engine interpolates between them. Prices follow the broad path of
 * consumer prices in the long-run series (e.g. US CPI); the real wage, how far a typical
 * wage went. Their product scales every amount of money in the game, so wages and prices
 * move together and a life in 1900 is as affordable as one today, in its own numbers.
 */
export const MONEY_ANCHORS = [
  [1800, 0.040, 0.12], [1850, 0.026, 0.15], [1900, 0.026, 0.25], [1913, 0.031, 0.28], [1920, 0.062, 0.30],
  [1933, 0.042, 0.30], [1940, 0.045, 0.38], [1945, 0.057, 0.42], [1950, 0.077, 0.48], [1960, 0.094, 0.60],
  [1970, 0.123, 0.72], [1980, 0.263, 0.78], [1990, 0.417, 0.82], [2000, 0.556, 0.90], [2010, 0.690, 0.95],
  [2020, 0.820, 0.98], [2025, 1, 1],
];

/**
 * [fact] Currencies that came before today's. Each is valued against the currency
 * that replaced it, by the official conversion rate. Euro rates are the fixed rates
 * set by the EU Council (31 Dec 1998; Greece 2000; Slovakia 2008; Estonia 2010;
 * Croatia 2022). The game changes money over on 1 January of the year euro notes
 * and coins arrived (2002 for the first members).
 *   until: last year the currency was in use · per: units per unit of the next currency
 */
export const CURRENCY_HISTORY = {
  // Germany: the Mark (and Reichsmark) until the 1948 currency reform [fact: Währungsreform, June 1948];
  // the Deutsche Mark until the euro. [estimate] The Mark is valued at 2.4 to the Deutsche Mark so that
  // prices and wages around 1900 come out near their real level (about 4 Marks to the dollar). The real
  // reform converted most savings at 10 to 1, wiping out much of them; the game converts at its own rate.
  de: [{ until: 1947, code: 'RM', symbol: 'ℳ', name: 'Mark', per: 2.4, official: false }, { until: 2001, code: 'DEM', symbol: 'DM', name: 'Deutsche Mark', per: 1.95583 }],
  // France: the old franc until the new franc of 1960 (100 to 1), then the euro.
  fr: [{ until: 1959, code: 'FRF0', symbol: '₣', name: 'old franc', per: 100 }, { until: 2001, code: 'FRF', symbol: '₣', name: 'franc', per: 6.55957 }],
  mc: [{ until: 1959, code: 'FRF0', symbol: '₣', name: 'old franc', per: 100 }, { until: 2001, code: 'FRF', symbol: '₣', name: 'franc', per: 6.55957 }],
  it: [{ until: 2001, code: 'ITL', symbol: '₤', name: 'lira', per: 1936.27 }],
  es: [{ until: 2001, code: 'ESP', symbol: 'Pta ', name: 'peseta', per: 166.386 }],
  nl: [{ until: 2001, code: 'NLG', symbol: 'ƒ', name: 'guilder', per: 2.20371 }],
  be: [{ until: 2001, code: 'BEF', symbol: 'BEF ', name: 'Belgian franc', per: 40.3399 }],
  at: [{ until: 2001, code: 'ATS', symbol: 'S ', name: 'schilling', per: 13.7603 }],
  ie: [{ until: 2001, code: 'IEP', symbol: 'IR£', name: 'Irish pound', per: 0.787564 }],
  pt: [{ until: 2001, code: 'PTE', symbol: 'Esc ', name: 'escudo', per: 200.482 }],
  gr: [{ until: 2001, code: 'GRD', symbol: '₯', name: 'drachma', per: 340.75 }],
  fi: [{ until: 2001, code: 'FIM', symbol: 'mk ', name: 'markka', per: 5.94573 }],
  sk: [{ until: 2008, code: 'SKK', symbol: 'Sk ', name: 'koruna', per: 30.126 }],
  ee: [{ until: 2010, code: 'EEK', symbol: 'kr ', name: 'kroon', per: 15.6466 }],
  hr: [{ until: 2022, code: 'HRK', symbol: 'kn ', name: 'kuna', per: 7.5345 }],
  // [fact] Decimal currency replaced the pound at two new dollars to the pound: Australia 14 Feb 1966,
  // New Zealand 10 July 1967.
  au: [{ until: 1965, code: 'AUP', symbol: '£A', name: 'Australian pound', per: 0.5 }],
  nz: [{ until: 1966, code: 'NZP', symbol: '£NZ', name: 'New Zealand pound', per: 0.5 }],
  // Not included, on purpose: currencies replaced after runaway inflation (Brazil's cruzeiros, Mexico's old
  // peso, Argentina's australes, Israel's old shekel, Turkey's old lira) and those that inflated heavily
  // after a changeover (South Africa's, Jamaica's and Nigeria's pounds). The game has one price index for
  // the world, so their old amounts would be wrong by factors of thousands. They show today's currency.
  // Britain's shillings and pence (before 1971) are not shown: amounts are kept in whole pounds.
};

// ---------- Laws ----------

/**
 * Historical law, as a layer under today's law (js/engine/rules.js). For each rule,
 * dated entries say what the law was before a change. An entry applies while
 * from <= year <= until. `'*'` is the shared default for places without their own
 * entry: a gameplay default for the period, marked [default].
 * Changes made during a life (enacted by a government in the game) still win.
 */
export const LAW_HISTORY = {
  // [fact] Year women gained the national vote (simplified to one year per country; source:
  // standard suffrage chronologies, e.g. the Inter-Parliamentary Union). UK: equal terms 1928
  // (partial from 1918). US: the 19th Amendment, 1920 — some states earlier; racial barriers
  // persisted until 1965. [default] 1950 where not recorded.
  womenVote: Object.fromEntries([
    ['nz', 1893], ['au', 1902], ['fi', 1906], ['no', 1913], ['dk', 1915], ['is', 1915], ['ru', 1917], ['ca', 1918], ['de', 1918],
    ['at', 1918], ['pl', 1918], ['uk', 1928], ['nl', 1919], ['se', 1919], ['us', 1920], ['ie', 1922], ['ec', 1929], ['es', 1931],
    ['br', 1932], ['th', 1932], ['uy', 1932], ['tr', 1934], ['ph', 1937], ['fr', 1944], ['jm', 1944], ['it', 1945], ['jp', 1945],
    ['ve', 1946], ['ar', 1947], ['kr', 1948], ['be', 1948], ['il', 1948], ['cl', 1949], ['cn', 1949], ['in', 1950], ['gr', 1952],
    ['mx', 1953], ['co', 1954], ['pe', 1955], ['eg', 1956], ['gh', 1954], ['ke', 1963], ['ng', 1976], ['ch', 1971], ['pt', 1976],
    ['kw', 2005], ['sa', 2015], ['*', 1950],
  ].map(([id, year]) => [id, [{ until: year - 1, value: false }]])),
  // [fact] Voting age lowered to 18: UK 1969 (in force 1970), US 1971 (26th Amendment), West Germany 1970,
  // France 1974, Canada 1970, Australia 1973, Italy 1975, Spain 1978; Japan 20 until 2016; Switzerland 20
  // until 1991. [default] 21 before 1970.
  votingAge: {
    uk: [{ until: 1969, value: 21 }], us: [{ until: 1970, value: 21 }], de: [{ until: 1969, value: 21 }], fr: [{ until: 1973, value: 21 }],
    ca: [{ until: 1969, value: 21 }], au: [{ until: 1972, value: 21 }], it: [{ until: 1974, value: 21 }], es: [{ until: 1977, value: 21 }],
    jp: [{ until: 1945, value: 25 }, { from: 1946, until: 2015, value: 20 }], ch: [{ until: 1990, value: 20 }],
    '*': [{ until: 1969, value: 21 }],
  },
  // [fact] Same-sex marriage legal from (source: national legislation and court rulings).
  // Before that year it is not available. Places not listed keep today's law, which is "not available".
  sameSexMarriage: Object.fromEntries([
    ['nl', 2001], ['be', 2003], ['es', 2005], ['ca', 2005], ['za', 2006], ['no', 2009], ['se', 2009], ['pt', 2010], ['is', 2010],
    ['ar', 2010], ['dk', 2012], ['br', 2013], ['fr', 2013], ['uy', 2013], ['nz', 2013], ['uk', 2014], ['lu', 2015], ['us', 2015],
    ['ie', 2015], ['co', 2016], ['fi', 2017], ['mt', 2017], ['de', 2017], ['au', 2017], ['at', 2019], ['tw', 2019], ['ec', 2019],
    ['cr', 2020], ['cl', 2022], ['ch', 2022], ['si', 2022], ['mx', 2022], ['cu', 2022], ['ad', 2023], ['ee', 2024], ['gr', 2024],
    ['li', 2025], ['th', 2025], ['*', 2000],
  ].map(([id, year]) => [id, [{ until: year - 1, value: false }]])),
  // [fact] Divorce introduced: Italy 1970, Brazil 1977, Spain 1981 (and briefly 1932–1939), Argentina 1987,
  // Ireland 1997, Chile 2004, Malta 2011.
  divorce: {
    it: [{ until: 1969, value: false }], br: [{ until: 1976, value: false }], es: [{ until: 1931, value: false }, { from: 1939, until: 1980, value: false }],
    ar: [{ until: 1986, value: false }], ie: [{ until: 1996, value: false }], cl: [{ until: 2003, value: false }], mt: [{ until: 2010, value: false }],
  },
  // [fact] Death penalty for murder last in law (abolition year minus one): Netherlands 1870, Norway 1905, Sweden 1921,
  // Denmark 1930, Switzerland 1942, Italy 1948, West Germany 1949, New Zealand 1961, UK 1965, Australia 1973 (federal),
  // Canada 1976, Spain 1978, France 1981, Ireland 1990, Belgium 1996, South Africa 1995. [default] in use before 1950.
  deathPenalty: Object.fromEntries([
    ['nl', 1870], ['no', 1905], ['se', 1921], ['dk', 1930], ['ch', 1942], ['it', 1948], ['de', 1949], ['nz', 1961], ['uk', 1965],
    ['au', 1973], ['ca', 1976], ['es', 1978], ['fr', 1981], ['ie', 1990], ['za', 1995], ['be', 1996], ['pt', 1867], ['br', 1889],
    ['*', 1950],
  ].map(([id, year]) => [id, [{ until: year - 1, value: true }]])),
  // [fact] Conscription in wartime and after: France until 1996; Germany 1800–1918, 1935–1945 and 1956–2010;
  // UK 1916–1919 and 1939–1960 (National Service); US 1917–1918 and 1940–1973; Canada 1917–1918 and 1940–1945;
  // Australia 1939–1945 and 1964–1972; Italy until 2004; Spain until 2001; Japan until 1945.
  conscription: {
    fr: [{ until: 1996, value: true }], de: [{ until: 1918, value: true }, { from: 1935, until: 1945, value: true }, { from: 1956, until: 2010, value: true }],
    uk: [{ from: 1916, until: 1919, value: true }, { from: 1939, until: 1960, value: true }],
    us: [{ from: 1917, until: 1918, value: true }, { from: 1940, until: 1973, value: true }],
    ca: [{ from: 1917, until: 1918, value: true }, { from: 1940, until: 1945, value: true }],
    au: [{ from: 1939, until: 1945, value: true }, { from: 1964, until: 1972, value: true }], nz: [{ from: 1940, until: 1945, value: true }],
    it: [{ until: 2004, value: true }], es: [{ until: 2001, value: true }], jp: [{ until: 1945, value: true }],
  },
  // [fact] Alcohol prohibition: United States 1920–1933 (18th and 21st Amendments); Finland 1919–1932.
  alcohol: { us: [{ from: 1920, until: 1933, value: false }], fi: [{ from: 1919, until: 1932, value: false }] },
  // [default] Where today's law is equal or limited, being gay was against the law or close to it before 1970,
  // and limited before 2000. [fact] Exceptions with earlier decriminalisation: France 1791, Netherlands 1811,
  // Belgium 1795, Italy 1890, Denmark 1933, Switzerland 1942, Sweden 1944 (then limited, not equal).
  lgbt: {
    fr: [{ until: 1999, value: 'limited' }], nl: [{ until: 1999, value: 'limited' }], be: [{ until: 1999, value: 'limited' }],
    it: [{ until: 1889, value: 'hostile' }, { from: 1890, until: 1999, value: 'limited' }], dk: [{ until: 1932, value: 'hostile' }, { from: 1933, until: 1999, value: 'limited' }],
    ch: [{ until: 1941, value: 'hostile' }, { from: 1942, until: 1999, value: 'limited' }], se: [{ until: 1943, value: 'hostile' }, { from: 1944, until: 1999, value: 'limited' }],
    '*': [{ until: 1969, value: 'hostile' }, { from: 1970, until: 1999, value: 'limited', ifModern: ['equal'] }],
  },
  // [estimate] School-leaving age by era, where today's is higher. UK: 10 (1880), 14 (1918), 15 (1947), 16 (1972) [fact].
  schoolLeavingAge: {
    uk: [{ until: 1917, value: 12 }, { from: 1918, until: 1946, value: 14 }, { from: 1947, until: 1971, value: 15 }],
    '*': [{ until: 1918, value: 12 }, { from: 1919, until: 1945, value: 14 }, { from: 1946, until: 1969, value: 15 }],
  },
  // [fact] The "marriage bar": married women required to leave teaching and public-service jobs.
  // UK civil service until 1946 (teachers 1944); Ireland 1932–1973; Netherlands 1904–1957; Australian
  // federal public service until 1966; Canadian federal public service until 1955. In the US, many school
  // districts and states until the 1940s–1950 [simplified to 1950].
  marriageBar: {
    uk: [{ until: 1945, value: true }], ie: [{ from: 1932, until: 1973, value: true }], nl: [{ from: 1904, until: 1956, value: true }],
    au: [{ until: 1966, value: true }], ca: [{ until: 1955, value: true }], us: [{ until: 1950, value: true }],
  },
  // [fact] Women admitted to practice law: US (first states) 1869, France 1900, UK 1919 (Sex Disqualification
  // (Removal) Act), Italy 1919, Germany 1922, Japan 1933. [default] 1920 elsewhere.
  womenInLaw: Object.fromEntries([['us', 1869], ['fr', 1900], ['uk', 1919], ['it', 1919], ['de', 1922], ['jp', 1933], ['*', 1920]]
    .map(([id, year]) => [id, [{ until: year - 1, value: false }]])),
  // [default] Firefighting and the armed forces' regular ranks were generally closed to women before the 1970s.
  womenInUniform: { '*': [{ until: 1974, value: false }] },
};

/** Which laws are about a group of people, and who: the rule engine asks only for them. */
export const LAW_WORDS = {
  womenVote: (place) => `Women cannot vote in ${place} yet.`,
  marriageBar: (place) => `In ${place}, married women are not allowed to keep this kind of job yet.`,
  womenInLaw: (place) => `Women are not admitted to practice law in ${place} yet.`,
  womenInUniform: (place) => `In ${place}, this service does not take women yet.`,
};

// ---------- Careers ----------

/**
 * [estimate] When each career becomes available, and what its jobs were called earlier.
 * from: first year it exists as a career in the game (omitted = always).
 * titles: era id → level titles, used for jobs taken then (a job keeps the title it was taken with).
 * law: a rule (above) that can bar some people from it.
 */
export const CAREER_ERAS = {
  software: { from: 1958, titles: { midcentury: ['Computer operator', 'Programmer', 'Senior programmer', 'Systems analyst', 'Head of data processing'] } },
  influencer: { tech: 'social' },
  marketing: { from: 1900, titles: { early: ['Advertising clerk', 'Copywriter', 'Advertising manager', 'Agency director'], interwar: ['Advertising clerk', 'Copywriter', 'Advertising manager', 'Agency director'] } },
  political_staff: { from: 1900 },
  nurse: { from: 1860 },
  pharmacist: { titles: { early: ['Druggist\'s assistant', 'Druggist', 'Senior druggist', 'Proprietor'] } },
  office: { titles: { early: ['Junior clerk', 'Clerk', 'Senior clerk', 'Chief clerk'], interwar: ['Junior clerk', 'Clerk', 'Senior clerk', 'Chief clerk'] } },
  retail: { titles: { early: ['Stock boy', 'Sales clerk', 'Senior clerk', 'Storekeeper'] } },
  driver: { titles: { early: ['Stable hand', 'Carter', 'Coachman', 'Carrier'] } },
  firefighter: { from: 1850, law: 'womenInUniform' },
  enlisted: { law: 'womenInUniform' },
  officer: { law: 'womenInUniform' },
  police: { from: 1829, law: 'womenInUniform' },
  lawyer: { law: 'womenInLaw' },
  teacher: { law: 'marriageBar' },
  bridal: { from: 1950 },
  editorial: { from: 1925 },
  sfx: { from: 1930 },
  child_actor: { from: 1910 },
  actor: { from: 1910 },
  athlete: { from: 1885 },
  mt_performer: { from: 1900 },
  stage_tech: { from: 1800 },
};

/**
 * [estimate] Occupations a newborn's parents might have, by era. `income` is in today's
 * money (the era's money index converts it); `until` and `from` bound when it is offered.
 */
export const PARENT_OCCUPATIONS = [
  { title: 'farmer', wealth: [15, 55], income: 30000, until: 1999 },
  { title: 'farm laborer', wealth: [5, 25], income: 22000, until: 1969 },
  { title: 'blacksmith', wealth: [15, 40], income: 30000, until: 1945 },
  { title: 'seamstress', wealth: [10, 30], income: 24000, until: 1969 },
  { title: 'tailor', wealth: [15, 45], income: 32000, until: 1999 },
  { title: 'domestic servant', wealth: [5, 20], income: 18000, until: 1945 },
  { title: 'coal miner', wealth: [10, 30], income: 30000, until: 1999 },
  { title: 'factory worker', wealth: [10, 35], income: 30000, from: 1850 },
  { title: 'railway worker', wealth: [15, 40], income: 34000, from: 1840, until: 1999 },
  { title: 'dock worker', wealth: [10, 30], income: 30000, until: 1999 },
  { title: 'clerk', wealth: [25, 50], income: 38000, until: 1999 },
  { title: 'typist', wealth: [20, 40], income: 32000, from: 1890, until: 1999 },
  { title: 'telephone operator', wealth: [20, 40], income: 30000, from: 1890, until: 1980 },
  { title: 'shopkeeper', wealth: [25, 65], income: 45000 },
  { title: 'schoolteacher', wealth: [25, 50], income: 42000, until: 1999 },
];
/** Today's parent occupations that are modern inventions: never offered before these years. */
export const MODERN_OCCUPATIONS = { 'software engineer': 1960, 'investment banker': 1920, 'hair stylist': 1950, 'company director': 1900, 'warehouse picker': 1960, 'electrician': 1890, 'bus driver': 1910, 'line cook': 1950, 'dentist': 1850, 'surgeon': 1850, 'civil engineer': 1850, 'police officer': 1829, 'florist': 1850 };

/** [estimate] University subjects that did not exist as degrees before these years. */
export const MAJOR_FROM = { computer_science: 1965, psychology: 1900, criminal_justice: 1930, communications: 1945, musical_theater: 1940, musical_theater_bfa: 1945, business: 1900, nursing: 1880, political_science: 1880, journalism: 1900, finance: 1900 };

// ---------- Schooling ----------

/** [estimate] How many young people go on to university in each era, relative to today (NPC paths and the player's odds). */
export const UNIVERSITY_ACCESS = { early: 0.08, interwar: 0.15, midcentury: 0.35, late20c: 0.7, now: 1 };
/** [estimate] How many children stay at school past the leaving age, by era (the rest go to work). */
export const SECONDARY = { early: 0.2, interwar: 0.35, midcentury: 0.65, late20c: 0.9, now: 1 };

// ---------- Health ----------

/**
 * [estimate] Health by era. `shift` moves old-age mortality (years: negative is shorter lives);
 * `adult` is extra yearly risk from infection and accidents at working ages; `child` is the
 * yearly risk for children under five (applied to brothers, sisters and children, not to the
 * player, so a life never ends before it starts); `childbirth` is the risk to a mother in each
 * birth. Built from the broad shape of life tables (e.g. infant mortality over 100 per 1,000 in
 * much of the world in 1900, maternal mortality several per 1,000 births), not country statistics.
 * Lower life expectancy at birth was mostly early deaths: adults who survived childhood often lived long.
 */
export const HEALTH = {
  early: { shift: -12, adult: 0.004, child: 0.022, childbirth: 0.006 },
  interwar: { shift: -8, adult: 0.0025, child: 0.01, childbirth: 0.004 },
  midcentury: { shift: -5, adult: 0.001, child: 0.004, childbirth: 0.0008 },
  late20c: { shift: -2, adult: 0.0003, child: 0.0012, childbirth: 0.0002 },
  now: { shift: 0, adult: 0, child: 0, childbirth: 0.0001 },
};

/**
 * [estimate, dated where marked] What a doctor could do, by condition. `chance` multiplies the
 * treatment's success; `manage: false` means no long-term management existed yet.
 * Insulin 1922 [fact]; penicillin in general use from the mid-1940s [fact]; the first antihypertensive
 * and antidepressant drugs in the late 1950s [fact]; inhaled asthma treatment from 1956 [fact];
 * modern hip replacement from the 1960s [fact].
 */
export const TREATMENT_HISTORY = {
  flu: [{ until: 1944, chance: 0.55 }], ear_infection: [{ until: 1944, chance: 0.55 }],
  acne: [{ until: 1959, chance: 0.3 }], asthma: [{ until: 1955, chance: 0.4, manage: false }],
  anxiety: [{ until: 1956, chance: 0.4 }], depression: [{ until: 1956, chance: 0.35 }, { from: 1957, until: 1987, chance: 0.75 }],
  high_bp: [{ until: 1957, chance: 0.3, manage: false }], diabetes: [{ until: 1921, chance: 0.1, manage: false }],
  broken_hip: [{ until: 1961, chance: 0.4 }], heart_disease: [{ until: 1959, chance: 0.35, manage: false }],
  cancer: [{ until: 1949, chance: 0.2 }, { from: 1950, until: 1979, chance: 0.55 }],
};
/** [estimate] First year each cosmetic procedure is offered, and talking therapy. */
export const PROCEDURE_FROM = { teeth: 1960, nose: 1930, lipo: 1982, therapy: 1910 };

// ---------- Events ----------

/**
 * [fact] Broad developments, with the countries they touched most. Dates are the commonly
 * cited ones. Effects use existing systems: news, the economy's phase, call-ups (through the
 * conscription law above), a few scenes. No battles, and no real leaders.
 *   who: country ids most directly involved ('*' everyone) · from/to: years
 *   entry: for a war, the year each country entered, if later than `from`
 *   economy: an economic phase to hold where it applies · risk: yearly extra death risk for men 18–40 in the family
 */
export const EVENTS = [
  { id: 'ww1', name: 'the First World War', from: 1914, to: 1918, war: true, risk: 0.012,
    who: ['uk', 'fr', 'de', 'ru', 'at', 'be', 'it', 'us', 'ca', 'au', 'nz', 'in', 'tr', 'rs', 'jp', 'pt', 'za'], entry: { it: 1915, pt: 1916, us: 1917 },
    begin: 'War has broken out across Europe.', end: 'The war is over. An armistice was signed in November.' },
  { id: 'flu1918', name: 'the influenza pandemic', from: 1918, to: 1919, who: ['*'], extraRisk: 0.004,
    begin: 'A new influenza is spreading around the world, and it is killing the young as well as the old.', end: 'The influenza that swept the world has burned itself out.' },
  { id: 'depression', name: 'the Great Depression', from: 1930, to: 1938, economy: 'slump', who: ['*'],
    begin: 'After the crash on the stock markets, banks are failing and work is disappearing.', end: 'The worst of the Depression seems to be over.' },
  { id: 'ww2', name: 'the Second World War', from: 1939, to: 1945, war: true, risk: 0.015,
    who: ['uk', 'fr', 'de', 'pl', 'it', 'jp', 'us', 'ru', 'cn', 'ca', 'au', 'nz', 'in', 'za', 'nl', 'be', 'no', 'dk', 'gr', 'ph', 'rs', 'hu', 'ro', 'fi', 'kr'],
    entry: { it: 1940, nl: 1940, be: 1940, no: 1940, dk: 1940, gr: 1940, us: 1942, ru: 1941, ph: 1941, hu: 1941, ro: 1941, kr: 1941 }, // the US entered in December 1941
    begin: 'War again: much of the world is fighting.', end: 'The Second World War is over.' },
  { id: 'postwar', name: 'the postwar boom', from: 1950, to: 1972, economy: 'boom', who: ['us', 'uk', 'fr', 'de', 'it', 'nl', 'be', 'at', 'ch', 'se', 'no', 'dk', 'fi', 'jp', 'ca', 'au', 'nz', 'es', 'ie'],
    begin: 'Factories are busy and wages are rising: good times, for once.', end: null },
  { id: 'moon', name: 'the Moon landing', from: 1969, to: 1969, who: ['*'], begin: 'People have walked on the Moon. Half the world watched it live.', end: null },
  { id: 'oil', name: 'the oil crisis', from: 1974, to: 1975, economy: 'slump', who: ['*'],
    begin: 'Oil prices have quadrupled. Queues at gas stations, and prices rising everywhere.', end: null },
  { id: 'coldwarend', name: 'the end of the Cold War', from: 1989, to: 1991, who: ['*'], begin: 'The Berlin Wall has come down.', end: 'The Soviet Union is gone. The Cold War is over.' },
  // [fact] Independence (the country as it is in the game now).
  ...[['in', 1947], ['pk', 1947], ['il', 1948], ['id', 1949], ['gh', 1957], ['ng', 1960], ['ke', 1963], ['jm', 1962], ['tz', 1961], ['ug', 1962], ['dz', 1962], ['ma', 1956], ['tn', 1956], ['ph', 1946], ['kr', 1945], ['ie', 1922]]
    .map(([id, year]) => ({ id: `independence_${id}`, from: year, to: year, who: [id], independence: true, begin: null, end: null })),
];

/**
 * [reviewed] Scenes written for the present day whose story only makes sense from a certain year, even
 * though they name no technology the event engine recognizes: the first year each can happen. Every scene
 * not listed here is timeless, or is gated by the technology it mentions (js/engine/eventEngine.js).
 */
export const SCENE_FROM = {
  // Everyday modern life
  theme_park_day: 1955, supermarket_meltdown: 1955, cash_machine_extra: 1975, scratch_ticket: 1985, subscription_trap: 1985,
  gym_regular: 1975, volunteer_ask: 1980, scam_call: 1985, talent_night: 1960, cousin_pitch: 1950, science_fair: 1950,
  uni_flatmate: 1950, heat_with_no_air: 1960, lost_passport: 1960, stuck_lift: 1900, power_cut: 1925, blackout_week: 1935,
  // Cars on ordinary roads
  driving_lesson: 1925, driving_keys: 1930, witness_crash: 1925, road_rage: 1975, warning_light: 1975, kidnap_scare: 1920, protocol_lessons: 1920, pol_hot_mic: 1930,
  // Mobile phones and the messages they carry
  first_phone: 1998, contraband: 1998, card_school: 1998, jealous: 2002, their_secret: 2002, ex_returns: 1995, headhunter_call: 1998,
  found_phone: 2008, exam_answers: 2008, school_petition: 2007, sibling_video: 1985,
  // Social media
  brand_offer: 2010, post_backlash: 2010,
  // Working life
  headhunter: 1960, pol_old_photo: 1960,
  // Gay and transgender life lived openly
  pride_march: 1970, wrong_name_at_dinner: 1965, younger_person_asks: 1970,
};

/** Scenes for the eras: queued by the history engine at the right moments (see js/data/events/stories/eras.js). */
export const ERA_SCENES = { callUp: 'era_call_up', warNews: 'era_war_news', depression: 'era_hard_times', peace: 'era_peace', leaveSchool: 'era_leave_school' };
