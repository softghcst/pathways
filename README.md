# Pathways

A text life simulation. One life, one year at a time.

Static site: plain HTML, CSS and ES modules. No build step, no dependencies.

## Play

- **GitHub Pages:** Settings → Pages → deploy from the branch root. All paths are relative.
- **iPad / iPhone:** open the Pages link in Safari → Share → Add to Home Screen. It runs full-screen.
- **Locally:** ES modules need a web server, not `file://`. From the repository folder:

  ```bash
  python3 -m http.server 8000
  ```

  Then open `http://localhost:8000/` for the game, or `http://localhost:8000/avatar-lab.html` for the avatar lab.

Lives save automatically to the browser's `localStorage`.

## Checks

There is nothing to install: the checks run on Node alone. To run all of them at once, several at a time (this is
what CI runs on every pull request, `.github/workflows/tests.yml`):

```bash
node scripts/test-all.mjs            # every check; add a word to run only the files whose names contain it
```

The checks play the same lives every run: outside a browser the dice are pinned (`js/rng.js`), so a new life carries on
the seeded sequence instead of drawing a fresh seed from the clock, and a failure can be played again exactly. To roll
fresh dice each run instead, and shake out checks that only pass for some lives:

```bash
PATHWAYS_RANDOM=1 node scripts/test-all.mjs
```

`node scripts/stress/fame-lives.mjs 60` plays sixty idol, fan and athlete lives and checks money, fame, fandoms, card
prices, positions and saves after every year (each life is reproducible from its seed).

Or one at a time:

```bash
node tests/avatar.mjs
```

```bash
node tests/events.mjs
```

```bash
node tests/escape-layouts.mjs
node tests/succession.mjs      # the rules of royal succession, on hand-built families
node tests/elections.mjs       # votes, seats, run-offs, coalitions, two-candidate races and the count
node tests/admissions.mjs      # university decisions and aid, on hand-built applicants
node tests/schooling.mjs       # marks, and the shape of school in every country
node tests/legislature.mjs     # votes in the legislature: majorities, rebels, deals, vetoes
node tests/animals.mjs         # the family's animals: one record each, owners and carers kept apart, the album, generations
node tests/animal-care.mjs     # shelters, adoption, costs, the vet, insurance, fostering, rehoming, moving abroad, careers
node tests/animal-riding.mjs   # lessons, horses, livery, shows, farm animals, breeding and pedigrees
node tests/animal-life.mjs     # staff, classes, behavior, landlords, outings, custody, leasing, reptiles, bonds, businesses, story arcs
node tests/sports.mjs          # sports: registry, skills, training limits, clubs, seasons, draws, injuries, recruiting, contracts, money once, generations
node tests/sports-scenarios.mjs # sports: the playable scenarios A to R, the family, and the first vertical slice, each played through
node tests/sports-divisions.mjs   # sports: women's and men's divisions, women's professional years, sports agents shopped for
node tests/sports-extras.mjs      # sports: World Games team events, managing a squad, boxing and its world title
node tests/teams.mjs           # team names, jersey colors and shirt numbers: made up, renamed, recolored, saved; teammates renamed everywhere
node tests/draft.mjs           # recruiting (stars, offers by division, signing day), college (redshirt, grades, portal, NIL), each league's draft rules, the minors
node tests/international.mjs   # baseball signings outside the draft countries: trainers, handshake deals, signing at 16, the DSL, Cuba
node tests/asia-youth.mjs      # Japan's and Korea's drafts, posting to the big leagues, Korean military service, soccer scholarships and youth contracts
node tests/trades.mjs          # trades in the draft leagues (the contract moves as it stands, ten-and-five), Puerto Rico in the big leagues' draft
node tests/baseball.mjs        # baseball: season lines and career totals, roles, free agency and the qualifying offer, options and Rule 5, independent ball, winter ball, the Hall of Fame
node tests/bonds.mjs           # adult relationships beyond one partner: casual, friends with benefits, one night, private; exclusivity and affairs; who knows; gifts; discovery; A Complicated Romance
node tests/estate.mjs          # wills: one notice when someone named dies, nothing rewritten, alternates, the playable heir as its own choice, reviews when the family changes
node tests/childhood.mjs       # childhood from birth: things to do by age, playground friends, early likings capped, pocket money from the family's own money, chores, small jobs
node tests/love-stories.mjs    # relationship stories told only when true, once, at the drama setting's pace; the opt-in, non-graphic teenage pregnancy storyline; teenage relationship scenes
node tests/pregnancy-choice.mjs   # the choice when a pregnancy is announced: go on with it or not; costs, laws, a partner's decision, teenagers
node tests/family-stories.mjs   # fifty-four stories of relationships, marriages, households, family secrets, inheritance and teenage life: each told only when true
node tests/sports-awards.mjs   # end-of-season awards: MVP, Rookie of the Year and each sport's own, decided once from the season played, on the record
node tests/sports-regressions.mjs # sports: bugs found in review (contracts and jobs, school and university teams, injuries, prison, generations), kept fixed
node tests/turns.mjs           # turn length: years, halves or quarters; the same life comes out the same; scenes for each season
node tests/disasters.mjs       # weather and disasters: where and when they strike, regions, tsunamis, preparing, news from elsewhere
node tests/lawmaking.mjs       # a head of government changing the law of the land through the legislature
node tests/world-scenarios.mjs # the Living World brief's ten end-to-end scenarios, A to J
node tests/systems.mjs         # income-tax schedules and health-care models
node tests/property.mjs        # buying, owning and selling property abroad; tax and inheritance by place
node tests/inheritance.mjs     # estate and inheritance tax: worked examples, and every country's scale
node tests/economy.mjs         # economies that turn, crises that begin and end, news, people who move
node tests/cities.mjs          # cities and regions: prices, pay, regional law, moving within a country
node tests/rules.mjs           # the legal rule engine: layers, overrides, what is allowed, laws that change
node tests/immigration.mjs     # routes into a country, visas that run out, spouses who stay, trips
node tests/citizenship.mjs     # nationality at birth, residency, naturalization; exchanging money never creates it
node tests/yearly.mjs          # one Age Up is one year: steps run once, limits, plans, the yearly update, a full year, three generations
node tests/generations-1900.mjs # one family from 1900 to the present, a year per Age Up, through every era: nothing before its time, heirs carry on, saves load
node tests/spelling.mjs        # American English throughout; old saves with British spellings are converted on load, names kept
node tests/yearly-ui.mjs       # the yearly screens in a real browser at phone and desktop widths (needs Playwright; skips without it)
node tests/afterglow-ui.mjs    # the Afterglow look: light, dark and system appearance, Age Up and Age down, the five sections, saves, 320px phones (AFTERGLOW_SHOTS=<folder> saves screenshots)
node tests/health.mjs          # conditions and diagnosis, therapy and DBT, medication trials and switching, access, heredity, privacy, old saves
node tests/business.mjs        # owning a business: starting, staff, the accounts, the owner paid once, partners, selling, failing, heirs
node tests/worklife.mjs        # every outcome of every working-life scene played through; romance at work, children's leanings, royals at work, two-career households
node tests/careers.mjs         # the occupation catalog, employers and openings, hiring, payroll once a year, side jobs, workplaces, freelancing, the military, retirement, records across generations
node tests/fame.mjs            # the fame profile, the entertainment world, acting from audition to credit, press, awards once, eras, child performers (see docs/FAME.md)
node tests/fame2.mjs           # sport played match by match (fame from results only), modeling, books, celebrity brands, famous lives, comebacks, the family record
node tests/fame3.mjs           # lives started in the past, newer sports, injuries, women's leagues, coaching, casting choices, literary agents and rights, brand launches, music videos and songwriting
node tests/kpop.mjs            # the K-pop idol life: auditions, trainees, survival programs, positions (one or two each), music shows, ending fairies, contracts, hiatus, fan products, photocards and collecting, variety careers, the family route, generations (see docs/KPOP.md)
node tests/music.mjs           # bands, releases, charts, royalties paid once, record deals, tours, music awards, heirs
node tests/a11y.mjs            # zoom, contrast in both themes, dialog names and focus, landmarks (see docs/ACCESSIBILITY.md)
node tests/moments.mjs         # living moments: occasions marked once in their year, Age Up never repeats them, traditions passed down
node tests/together.mjs        # what you can do with the people in your life, by role, age and era; trust, memories, once a year
node tests/money.mjs           # the ledger, banking, goals, budget and lending record: no money made or lost, nothing posted twice
node tests/wealth.mjs          # credit cards, insolvency, insurance, pension plans, family money, trusts, money scenes
node tests/justice.mjs         # crime, courts and prison: incident to release and reload, scenarios A to O, older saves, law reform, family cases, royal immunity, transfers
node tests/global-life.mjs     # travel, passports, borders, relocation, children born abroad, generations; the three vertical slices (SEED=n to vary)
node tests/digital.mjs         # the Digital World: technology by era, accounts and privacy, posts, messaging, creators and money, reputation, legacy, saves; the Digital Life brief's scenarios A to L
node tests/eras.mjs            # Historical Eras: careers, money and currencies, laws, schooling, health and events by era; lives born 1800–today; a German family 1900 → today
node tests/world.mjs           # the 102 reference places: codes, kinds, currencies, cities; a life lived in each (--report lists gaps); fails if any reference field disagrees with its source
```

One check runs in a real browser and needs Playwright with Chromium (it skips itself where Playwright is not installed):

```bash
node tests/digital-ui.mjs      # the Digital Life vertical slice, end to end, at phone and desktop widths
```

`avatar.mjs` checks the artwork, the manifest, the renderer, inheritance and the loading of old saves; that every hairstyle fits every head it is worn on; framing; readability across skin tones; that the eye shapes on offer are unchanged; that every nose is clear of every pair of eyes on every face shape; and that every mouth sits well under every nose, and men and women are drawn with their own mouths.
`events.mjs` checks every scene. `escape-layouts.mjs` proves each prison map can be escaped.

## Living moments

People → **My Moments** lists what this year holds: birthdays, school dances and proms, family occasions,
holidays, the family's traditions, invitations and evenings with friends. Choose one and it happens at once;
Age Up keeps the traditions nobody organized. No calendar: Pathways is still lived a year at a time.
Details: [docs/MOMENTS.md](docs/MOMENTS.md).

## Money

Every movement of the player's money is written in one double-entry ledger (`js/engine/ledger.js`), in whole
numbers of each currency's smallest unit. **My Money** (tap the amount at the top of the game, or Holdings →
My Money) shows accounts, a budget of what was actually earned and spent, debts and standing with lenders,
savings goals, the household, retirement, the estate and the history. Bank accounts, goals and
budgets are in `js/engine/banking.js`; cards, insurance, pension plans, family money and trusts each have an engine of their own beside it. The banks, insurers and their terms are invented
(`js/data/money.js`).

How it works, what is fiction, and what is not built yet: [docs/FINANCE.md](docs/FINANCE.md).

## Time per turn

Self → **Settings → Time per turn**: a year (the default), six months or three months. The year itself still happens
once, at the turn of the year: pay, tax, school reports, seasons of sport, health and birthdays run exactly as with
one-year turns, so money and records come out the same in every mode (`tests/turns.mjs` plays the same life all three
ways and compares). The turns in between move the calendar on, show the age in months, put a heading for each part of
the year in the life story, and may bring one of about thirty scenes written for that season and that turn length
(`js/data/events/seasons.js`: summer holidays, exam season, the dark of winter, a first scan, a baby's first smile,
preseason training), and perhaps one of the year's ordinary scenes as well: about 1.8 scenes a year with one-year turns,
3.7 with six-month turns and 5.8 with three-month turns. Story beats stay with the turn of the year. Each country has
its own climate (`js/engine/calendar.js`): four seasons in the north or the south, rainy and dry seasons in the tropics,
long and short rains near the equator, the monsoon in South Asia, a hot season in the desert. Scenes follow it, and the
school scenes follow each country's school year. Those turns draw on luck of their own
(`engine/eventEngine.js` drawBetween), never on the game's dice. A change partway through a year starts from the next.

## Weather and disasters

Hurricanes, typhoons and cyclones, tornadoes, blizzards, floods and monsoon floods, landslides, wildfires, heatwaves,
droughts, earthquakes and the tsunamis that can follow them, eruptions, avalanches and dust storms
(`js/data/disasters.js`). Each country has the ones its land and climate bring, in their season and hemisphere, and
the United States varies by city (hurricanes in Orlando, tornadoes in Austin, earthquakes in Seattle, blizzards in
Denver). The world's weather is a fact of the playthrough: the same storm in the same month for everyone, worked out
from the save and the date (`engine/disasters.js` weatherOf), never the game's dice. Once a year the disasters that
reached the player's city are reckoned (damage to the home, injuries, losses for renters, an aftermath scene), and big
ones elsewhere go into World news, reaching the life story where the player has ties, with a scene if someone they know
lives there. With shorter turns, each is told as it strikes, and big storms, floods and fires bring a forecast a turn
ahead: preparing lessens the damage, and leaving in time means not being hurt.

## Sports and athletics

Pursuits → **My Athletics** is the hub: ten sections (overview, sports, training, teams and clubs, competitions,
rankings, career and offers, health and mind, money and fame, legacy), with profiles for each sport, team, coach,
season, event and family athlete. Family archive → **Athletic legacy** opens the same record from the People tab.

One engine plays every sport; the sports themselves are data. Soccer, tennis and pickleball (with doubles partners)
are modeled in full; the other twenty-odd sports use shared scoring for goals, points, runs, sets, rally games,
strokes, times, judged scores and bouts. Sport skills are separate from the character's talents and grow toward a
fixed ceiling, with diminishing returns per training hour. Coaches, key teammates, doubles partners and agents are
real people. Results come from keyed, seeded luck and are stored once, so a reload never re-rolls them; standings
and champions are counted from completed games only. Clubs, leagues and the Pathways Rating (PR) are invented.

Above recreational play, women and men compete in their own divisions: separate clubs' teams, leagues, tours and
events, with names and teammates to match. Women's professional play starts in its own years (later than men's in
most sports, none at all in some, and one league that closed again); non-binary and transgender players choose their
division between clubs. Sports agents are shopped for like every other agent: one at a time, two looks a year, each
with their own cut (3–10%), pull with clubs and brands, and athletes on their books (My Athletics → Career, or My
Fame → Representation).

The best professionals in club sports are bought by clubs abroad: taking the move means a work visa the club sponsors
and a life in that country. In a games year a capped professional goes to the World Games with the national side. A
coach runs a club's first team: who starts, tactics, training, a season played game by game, and a board that judges
the table. Boxing is a sport of its own, with weight classes, a ranking from the record, and a world title to win and
defend (`js/engine/sportsExtras.js`).

| What | Where |
|---|---|
| The registry: sports, skills, positions, founding years, routes to going pro, injuries, plans | `js/data/sports.js` |
| How a match, race or routine comes out, and the rating | `js/engine/sportsPlay.js` |
| Profiles, eligibility, training, clubs and tryouts, coaches, rosters, leagues and seasons, draws and meets, doubles | `js/engine/sports.js` |
| The year in sport, money, injuries and rehab, recruiting and scholarships, contracts, transfers at home and abroad, sponsors, fame, arcs, generations | `js/engine/sportsLife.js` |
| World Games team events, managing a squad, boxing | `js/engine/sportsExtras.js` |
| Stories with scenes, A to I: first team, a coach who believes in you, the scholarship, the championship season, the doubles partnership, injury and recovery, the professional dream, the comeback, a new generation | `js/engine/sportsArcs.js`, `js/data/events/sports.js` |
| Sport in the family: parents' and grandparents' past, siblings and children who choose their own sport, parents at games | `js/engine/sportsFamily.js` |
| Teams' names, home and away jersey colors and shirt numbers, made up per sport (Rovers and Albion in soccer, Owls and Barons in baseball...) and all changeable, with players' names, in Settings → Teams and jerseys | `js/engine/teamIdentity.js`, `js/ui/settings.js`, `js/ui/jersey.js` |
| End-of-season awards: each league's MVP (or Player of the Season), Rookie of the Year, its own statistic and position awards (Golden Boot, Scoring Title, Sixth Man; in baseball Gold Glove and Silver Slugger by position, Platinum Glove, Pitcher of the Year, Reliever, Home Run, RBI and Strikeout Leaders, ERA and Batting Titles), a playoff MVP, Coach of the Year and a team of the season; Player of the Year, Newcomer and Comeback in individual sports. Decided once from the season as played, shown on the season page | `js/engine/sportsAwards.js`, `SEASON_AWARDS` in `js/data/sports.js` |
| My Athletics; lines in the life story open the season, event, team or coach they are about | `js/ui/sports.js` |

Not built: there is no wider disability system (adaptive sports key off `flags.wheelchair` or a matching condition),
no historical eras beyond each sport's founding and first-professional year, and the shared adapters do not model
substitutions, set plays or per-event schedules. Relatives' records are light: the level reached, seasons and titles,
not every game.

## The family's animals

People → **Pets & Animals** is the hub: your animals, the local shelter and farm rescue, care and costs, training, the vet,
riding, and the album. People → **Family archive → Our Animal Family** is the generational album and timeline.
Holdings lists the animals of your household and the chronicle of your house.

Every animal has one record, kept for good (`state.animals`). Owner, main caregiver and home are three separate
histories. Moments worth keeping are written once and tied to the line of the life story that tells them. When a
life ends, each animal that depended on the player gets a keeper, and the whole record crosses to the heir.

| What | Where |
|---|---|
| Seventeen species, breeds, temperament, costs, what can be taught, riding disciplines and show levels | `js/data/animals.js` |
| The record: identity, owners, carers, homes, bonds, moments, the hand-over between generations | `js/engine/animals.js` |
| Shelters, adoption checks, yearly costs, the vet, insurance, fostering, rehoming, volunteering, moving abroad | `js/engine/animalCare.js` |
| Riding schools and instructors, lessons, livery yards, buying and riding a horse, shows | `js/engine/equestrian.js` |
| Breeding (vet-checked, unrelated, limited, never for profit), parentage and pedigrees | `js/engine/animalBreeding.js` |
| Classes and trainers, behavior problems, outings, the local pet show, custody after a split, siblings' chores | `js/engine/animalLife.js` |
| Stories that take years: first pet, a nervous rescue settling, training, lifelong bonds, remembrance, the show ring, an older horse | `js/engine/animalArcs.js` |
| Scenes: illness, emergencies, foster reviews, settling in, a child asking for a pet, visiting the family dog | `js/data/events/animals.js` |
| Screens: album, timeline, profiles, chronicle / the hub / portraits / the way back | `js/ui/animals.js`, `js/ui/animalHub.js`, `js/ui/animalPortrait.js`, `js/ui/animalNav.js` |

Rules the tests hold the game to: one shelter animal is the same animal on every visit and after it is adopted; every
charge is in one ledger, once, with its currency; insurance pays its share of a bill once and never routine care; a
show class is ridden once and its result survives a reload; prizes never cover a horse's costs and animals never
make the family money; parentage is never invented and no animal is its own ancestor.

Careers with animals (animal care, dog training, grooming, horses and riding, farming, and veterinary medicine) are in
`js/data/careers.js`; fostering, volunteering and riding well open their doors. The people at shelters, vets, yards and
training clubs become people in the player's life the first time they deal with them, and stay the same people.
Landlords set rules about animals; some species need a license and some are banned. Each person's bond with an animal
has three sides: attachment, trust and comfort. Horses can be leased or sold (never for more than they cost); Pursuits
→ Riding leads to the same screens.

Animal businesses (pet sitting, a grooming salon, kennels, a dog training school, a riding school, a smallholding) are
kinds of business in the shared business system (`js/data/business.js`), started and run from the Work screen like any
other; the Pets & Animals hub links there. Kennels, a riding school and a smallholding need land of one's own, and a
riding school needs a rider who rides at an advanced level.

Not built, because the rest of the game does not have it yet: historical eras (every life starts in the present
day, so there is nothing for era rules to change).

## Avatars

Every portrait in the game is the **CharacterAvatar** system: hand-drawn SVG parts in `assets/avatars/`, stacked
in layers and recolored with CSS variables. There is no build step: the parts are plain files, and a short
Python script (standard library only) keeps them tidy and lists them for the game.

| What | Where |
|---|---|
| The head shapes (shared with the hair-warping pipeline) | `assets/heads/` — clean names (`pixie.svg`, `dimple_oval.svg`, …); the save ids stay `head_11_pixie` etc. (`HEAD_IDS` in the build script) |
| Hair-warping pipeline | `assets/hair_raw/` (hairstyles drawn on the base head), `assets/hair_fitted/` (each style fitted to each head, `<style>_<head>.svg`), `assets/landmarks.json` (six landmarks per head, and `base_head`), `assets/CHATGPT_HAIR_PROMPT.md` (the prompt for new styles). New style: save ChatGPT's SVG in `assets/hair_raw/`, run `npm run fit-hair` (several at once: paste the reply into `assets/raw_batch.txt` and run `npm run split-hair`); `npm run soften-hair` turns the heavy outline inside the hair (a fringe over the cap, curls over curls) into soft lines, keeping it on the silhouette (needs `pip install -r scripts/requirements.txt`), check `scripts/debug_hair_fit.html`. The game reads `assets/hair_manifest.json` (written by the same command; loaded by `js/avatar/fittedHair.js`), so a new style appears in the creator with no code change, and draws its `hair_back` behind the head and its other layers in front (`fittedHairFile` in `js/CharacterAvatar.js`). A style whose file name contains `fade` or `buzz`, or whose SVG has `data-clip-to-head="true"`, is clipped to the head's skin |
| The artwork, one folder per kind of part | `assets/avatars/` — `eyes/`, `eyebrows/`, `noses/`, `lips/`, `hair/`, `clothes/`, `crowns/`, `glasses/`, `jewelry/`, `makeup/`, `aging/`, `emotions/` |
| The list of every part (generated: do not edit) | `js/avatarManifest.js` |
| Cleaning, aligning and listing the artwork | `scripts/build-avatar-manifest.py` |
| Skin, hair, eye, lip and outfit colors | `js/avatarPalettes.js` |
| Notes the filenames cannot carry (hair textures, resting faces, uniforms, royal dress) | `js/avatar/curation.js` |
| The renderer: layers, ages, auto-dress | `js/CharacterAvatar.js` |
| How each hairstyle is fitted to each head, and how each head is framed | `js/avatar/hairFit.js` |
| How each nose is kept clear of the eyes it is worn with, and each mouth fitted to the nose | `js/avatar/featureFit.js` |
| How saved appearances are read, and old saves converted | `js/avatar/catalog.js` |
| How children take after their parents | `js/avatar/inherit.js` |
| The character creator and salon editor | `js/avatar/editor.js` |
| The salon's prices | `js/engine/salon.js` |

**How a portrait is built.** Each layer is an SVG `<use>` of a part file, in this order: back hair, head, make-up
(clipped to the head), age lines (clipped to the head too), eyes, eyebrows, nose, mouth, clothes,
necklaces, front hair, earrings and piercings, glasses, hat or crown, emotions. There is no facial hair: it has been
taken out of the game, and a beard or mustache in an old save is dropped. Hair is drawn twice — the whole style behind the head, and the part above that
head's chin again in front — so a fringe falls over the forehead while long hair falls behind the shoulders. A hat hides hair above the brim (bulky styles, above the ears). Colors are CSS variables on the portrait
(`--skin-color`, `--hair-color`, `--brow-color`, `--eye-color`, `--lip-color`, `--blush-color`, `--outfit-color`)
that reach into the part files.

**Fitting each head.** The script measures every head (top, chin, width above the ears, the ears, neck and
shoulders; stored as `fit` in the manifest), and the renderer moves each layer from the template face onto that
head: features keep their place between forehead and chin, hair and hats follow the top and width of the head,
earrings hang from that head's ears, clothes sit under its chin. Babies, toddlers and children get slightly smaller,
lower-set features. Eyes drawn as an empty outline are given whites by filling the opening.

**Fitting a nose to the eyes.** Every nose and every pair of eyes is drawn to fill the same box on the template face,
so some pairs crowd each other: a broad nose under eyes whose inner corners sweep down, a tall bridge between eyes
set close. The script measures the outline of each, row by row (`shape` in the manifest), and
`js/avatar/featureFit.js` finds, for one face, the smallest change that leaves a clear gap: the nose up to a fifth
smaller, a little lower, or each eye up to three units further out (`NOSE_FIT`). A pair that is already clear is
drawn exactly as before. It works from the measurements and the person's own proportions, so nothing is listed pair
by pair: a new nose or pair of eyes only needs measuring (run the script).

**Brows.** Twelve brows can be chosen (`CATALOG.brows`); seven of them are given at random (`RESTING.eyebrows`). Brows
that looked wrong on every face shape have been withdrawn, and saves that had one get the nearest kept
(`WITHDRAWN.brows`). The sad brows (`brows_11`) are never a resting face: anyone whose mood is at or below 30, as
happiness falls or after sad news, is drawn with them, and at or below 15 their eyes cry too (`LOW_MOOD`). Babies and
toddlers keep their soft baby brows (`BABY_BROWS`). From 84, an old man's brows grow bushy (`ELDER_BROWS`); a woman's
keep their shape and gray, and the creator offers the bushy brows to men only.

**Lid creases.** Several eye shapes (`eyes_18`, `_19`, `_20`, `_22`, `_26`, `_9`, `_8`, `_7`) draw a fold line floating
above the eye, which, in the same ink as the eye and close under the brow, read as a second, thinner eyebrow. The
script parts each crease into a path of its own, in a soft shade of the skin (`--crease-color`, falling back to the skin
mixed half and half with the eye's ink), and lowers it toward the lid by an amount worked out for that eye from the
outlines (`CREASES` in `scripts/build-avatar-manifest.py`): it stays at least 3 units clear of the eye, and a typical
brow is at least 5 units above it. `eyes_25` drew two folds, a floating one and one under its lashes that was part of its outline: the floating one is
taken out, and the other was cut out of the outline once and drawn in the same soft shade. The eyes whose top line is lashes (`eyes_10`, `_16`, `_6`) have no crease and are unchanged.

**Fitting a mouth to the nose.** The mouth is then fitted to the nose above it, as that nose was fitted to the eyes
(`LIP_FIT`): a resting mouth is drawn at least 1.3 times as wide as the nose, up to 15% larger, so a small bow
under a broad nose does not look pinched; and it is moved up or down by up to four units toward an upper lip of
much the same length, so a short nose does not leave a long empty space above the mouth. It always keeps clear of
the nose and the chin. Expressions (an open mouth, a pout, a grin) are drawn as they are.

**Men's and women's mouths.** There are two sets of resting mouths: the women's (`RESTING.lips`) and the men's
(`RESTING.lipsMasc`: the `lips_masc_` files, and the three neutral women's mouths, `lips_8`, `lips_9` and `lips_10`,
which both sets share). A mouth is inherited whatever the gender, and drawn to suit it: a shared mouth is drawn as it
is on anyone; otherwise a man born with a feminine mouth (`lips_4`, `_6`, `_7`, `_11`, `_14`) is drawn with the men's
mouth matched to it, and a woman born with a men's mouth with the women's match (`LIP_MATCH` in
`js/avatar/curation.js`, `lipsFor` in `js/avatar/catalog.js`). What is saved, and passed on to children, is the
mouth itself, so a son can have his mother's full lips and pass them on to a daughter. Randomly made men are born
with a men's mouth, and the creator offers each person only the mouths that can be drawn for them. The smirk, the
grin and the parted lips showing teeth (`lips_masc_01`, `_05`, `_08`) can be chosen but are never given at random.

**Lip colors.** Lipstick is worn as chosen, all over, by anyone, and by no child. Otherwise a woman's lips are her
skin warmed toward rose. A man's are a natural pair for his skin tone, from one shared palette (`NATURAL_LIP_UPPER`
and `NATURAL_LIP_LOWER` in `js/avatarPalettes.js`, one pair per tone in `SKIN_TONES` order): the upper lip a deeper
shade of the skin, the lower softer, so a mouth reads by its own fills rather than its outline at portrait size. From
porcelain to bronze both lips are one nude color instead, warming from golden so the mouth does not blend into the
cheeks. From chestnut down the upper is a rich deep brown and the lower a little lighter, a warm brown with only a hint
of rose, deepening gradually. The colors were chosen by lightness, chroma and hue against each skin. Every resting mouth draws its upper lip in `--lip-upper` (falling back to the lip color), so the
pair shows on every shape, thin, full or smiling: the men's mouths were drawn that way, and the script parts the women's
mouths, whose two lips were one path (`split_lip_tones`). Teeth, tongues and the inside of an open mouth are never
parted, and lipstick and women's natural lips set no upper color, so they look exactly as before. One mouth (`lips_4`)
was drawn with an outline half as heavy again as the rest, in a redder ink: the script trims the outside of its outline
and the line between its lips, and draws it in the same ink as the others (`THIN_OUTLINE`).

**Fitting hair.** The script also measures every hairstyle and head row by row and column by column (`edge` in the
manifest): the inner edges of the hair either side of the face, its hairline, the outline of its crown, and the
outline of each head. From those, `js/avatar/hairFit.js` corrects the plain fit for each pair, within small limits:
no background may show between hair and scalp, a fringe is lifted off the eyebrows where a small move does it, hair
that covers the top of the head goes on covering it, and a style too tall for the picture is flattened a little
above the crown. A style with a lock or sweep that hangs clear of the head on purpose is left alone. Babies' tufts
are not refitted. Nothing is special-cased by person: a new hairstyle or head only needs measuring (run the script).
A style placed so badly that the limits cannot save it is repaired in its file, once (`REFIT` in the script, with
the reason); stray specks are removed from hair files (`remove_specks`).

**Framing.** Adult heads differ in size by up to a fifth, so each is zoomed a little toward the average
(`frameFor`): faces fill the same share of a portrait, with the eyes on one line, whatever the hairstyle. Children
keep the plain picture. Every screen draws through `avatarSvg`, so a person is the same drawing everywhere; a screen
chooses only the size.

**Skin tones.** Fourteen, lightest to deepest (`SKIN_TONES` in `js/avatarPalettes.js`): porcelain, ivory, rose beige,
sand, beige, golden, caramel, olive, tan, bronze, chestnut, umber, espresso, ebony. Saves store the id, so a tone can be
added between two others, or retuned, without changing anyone's face. Anything that changes with depth (hair and eye
colors and hair texture at random, freckles, blush, lip colors) names the tone it starts at (`DEPTH` in
`js/avatar/catalog.js`), so adding a tone never moves where it starts.

**Reading faces on every skin tone.** All linework is one dark ink, which loses contrast as skin deepens while the
white of the eye gains it. From chestnut downward, in step with depth (`deepness`, `READABLE` in
`js/CharacterAvatar.js`): the whites are toned slightly toward the skin, the outlines of eyes and mouth (only the outlines, never the whites, irises or teeth) gain a little
weight, and brows get a faint lighter edge. A nose's skin is always the face's own skin color; on deeper tones only its lines get darker and heavier. Shapes, skin tones and everyone's own colors are unchanged;
lighter faces are untouched.

**Personal proportions.** Each person also has `inherited.tweaks`: eye spacing, eye size, eye height, nose size
and mouth size, each from -2 to 2 steps (`TWEAKS` in `js/avatar/catalog.js`, step sizes in `TWEAK_STEP` in
`js/CharacterAvatar.js`). They are set in the creator, vary a little at random, and children take each from a parent. Cosmetic surgery
(**Self** → **Cosmetic surgery** → *Facial reshaping*) changes them too, and children born afterward can take after the new face. Anyone's whole look can be edited from **People** → a person →
**Edit stats and talents** → **Edit their look**.

**Ages and dress.** Babies and toddlers have their own heads, baby hair and baby clothes; children have the child
head; from fifty, lines arrive and hair grays unless dyed. Portraits dress for the moment: prison orange in prison,
crown and robes for the royal family (a coronet for the peerage), and uniforms at work — police (tactical gear when
senior), fire service, the armed forces, white coats in medicine, a suit in law and finance. Hats have been withdrawn:
only crowns and tiaras are worn on the head. Hairstyles that hide an eye or much of the face (`HAIR_COVERS_FACE` in
`js/avatar/curation.js`) are never given at random, though they can still be chosen.

**The character creator.** Title screen → **Design a life** → **Design your look**; in a life, **Self** →
**Beauty salon** (styling only); or `avatar-lab.html`. Six tabs (face, eyes, nose and mouth, hair, clothes, extras),
hair filtered by length or by what suits your texture, a preview at other ages, and **Randomize**.

**How appearance is saved**

```js
appearance: {
  v: 3,
  inherited: { head, skin, eyes, eyeColor, brows, nose, lips, hairColor, hairTexture, marks: [], tweaks: {} }, // set once, at birth
  style: { hair, hairDye, glasses, makeup, lipColor, jewelry: [], outfit, outfitColor, hat }, // the salon and wardrobe
}
```

A child is built from the parents' `inherited` halves only, so a parent's dye, haircut or clothes never reach a
child. Saves from the two earlier avatar systems are converted on load, deterministically: an old part always
becomes the same new part (relatives who shared a nose still do), colors keep their names, and anything missing is
chosen from the character's id, so nobody's face changes between loads.

**How to add artwork**

1. Drop the new SVGs (or a `.zip` of them, nested zips too) into the repository and run
   `python3 scripts/build-avatar-manifest.py path/to/pack.zip` — or put loose SVGs anywhere under `assets/avatars/`
   and run `python3 scripts/build-avatar-manifest.py`. Files are sorted by their name's prefix (`hair_`, `outfit_`,
   `nose_`, ...), cleaned, fitted onto the shared face and listed in the manifest. Processed files are marked and
   skipped next time, so running it again is safe. `-v` prints how each file was placed.
2. For a new hairstyle, add its texture to `HAIR_TYPE` in `js/avatar/curation.js` (the check below will remind you).
3. Run `node tests/avatar.mjs` and look at the new parts in `avatar-lab.html`, section 3.

Part ids are written into saves: add new ones freely, and avoid renaming a file. A part that goes missing falls back
to a stable replacement instead of breaking.

## The world

Pathways has 103 places to live: the 102 on the reference list (16 in North America, 11 in South America, 28 in Europe,
13 in Africa, 12 under "Middle East", 18 in Asia, 4 in Oceania) and Ghana. Not all are sovereign states, and the game
says so: Puerto Rico and Aruba are territories, Hong Kong is a special administrative region, Taiwan is a self-governing
jurisdiction whose status is disputed. Each has its own currency code, languages, cities, pay and prices, taxes, school
system and form of government. Codes, names, currencies, languages, time zones, capitals, regions and cities are checked
against published sources, and so are the main laws, legal ages, citizenship rules and forms of government (see
`docs/WORLD_DATA.md`).

| What | Where |
|---|---|
| What each place is: codes, kind, parent, capital, languages, time zone, government | `js/data/world.js` |
| The 48 newest places, one row each | `js/data/worldNew.js` |
| Names, currency, taxes, cities; living conditions; political systems | `js/data/countries.js`, `js/data/living.js`, `js/data/politics.js` |
| Profiles, search and comparison (one source for every screen) | `js/engine/world.js` |
| The World Explorer | `js/ui/world.js` |
| What is real, what is game, and what is unverified | [`docs/WORLD_DATA.md`](docs/WORLD_DATA.md) |
| Checking the reference data against ISO, CLDR, IANA and GeoNames; the results | `scripts/verify-world.py`, `js/data/worldVerification.js` (generated) |
| Checking laws, ages, citizenship and government against pinned Wikipedia revisions; the results | `scripts/verify-laws.py`, `js/data/lawVerification.js` (generated) |

**The World Explorer** opens from the title screen (**The world**), from **Design a life** (**Explore the world**) and from
the **Self** tab. Search by country, city, language, currency or code (accents are ignored: "turkiye", "sao paulo"), filter by
region, open a profile, and compare a place with where you live. A profile keeps three things apart: facts about the place,
how the game models living there, and what has happened there in your save.

### Papers: birthplace, citizenship and residence

Three separate records (`js/engine/citizenship.js`, rules in `js/data/citizenship.js`):

- **Citizenship** comes from your parents, and from the place itself where being born there is enough (most of the
  Americas). A child can hold several. Someone born in a territory holds the nationality of the state it belongs to.
- **Residence**: citizens live in their own country, and its territories, as of right. Anyone else is a permanent resident
  from the day they move, with a history of everywhere they have lived.
- **Becoming a citizen**: after the years of residence the place asks for (five by default; three if married to a citizen,
  which shortens the wait and grants nothing by itself), with a fee and a test that is easier if you speak the language.
  Places that allow one nationality only make you give up the others, or take theirs away when you acquire another.
  Only citizens vote.

The **Passport** (Self tab) shows all of it and is where you apply. The rules are gameplay configuration and are unverified;
see [`docs/WORLD_DATA.md`](docs/WORLD_DATA.md).

### Money in more than one currency

`js/engine/currency.js`. Everyday money is always in the currency of the country you live in. Beyond that you can hold
accounts in other currencies (**Holdings** → **Currencies**), change money between them for a 1.5% fee, and see the record of
each exchange with the rate that was used. When you move abroad you choose how much to change and how much to leave behind
in the old currency. Net worth and estates count every currency once. Rates are fictional: each currency wanders a few per
cent a year around a fixed starting rate. Amounts are whole units and every conversion rounds down, so exchanging never
creates money.

### Routes into a country, and visas that run out

`js/engine/immigration.js`, numbers in `js/data/immigration.js`. Moving abroad is a choice between routes, each with its own
conditions, cost, odds and the status it gives:

| Route | For | You arrive as |
|---|---|---|
| As a citizen | citizens, including of a territory's parent state | citizen |
| Free movement | citizens of a country in the same free-movement area | permanent resident |
| To join family | a spouse who is a citizen there, or close family living there | permanent resident |
| Sponsored by an employer | a degree or a trade; comes with the job | work visa, 4 years |
| As a student | a school-leaving qualification and a year's funds | student visa, 4 years, no full-time work |
| As an investor | a large sum | permanent resident |
| Settlement program | points for education, work, age and language | permanent resident |
| Seeking protection | people whose own country is in crisis; no fee | temporary, 3 years |
| To retire | 55 or over, with a pension or savings to live on | retirement visa, 5 years, renewed while the money lasts; no work |

Routes that are closed are shown with the reason. A temporary status is renewed while its reason holds (a job, a course, a
crisis at home), becomes permanent after five years, and otherwise ends: one year's warning, then the return home. A graduate
gets two years to find a sponsor. Citizenship is for permanent residents.

Family who move with you hold a status of their own: citizens of the place need none, and anyone else is your
**dependant**, for as long as your own permission lasts and permanently once yours is. A child who turns eighteen on a
dependant visa needs a status of their own (a course, a job, or a year to leave), and a dependant whose sponsor leaves must go
too. When you become a citizen your children under eighteen become citizens with you; a husband or wife applies in their own
right. The passport lists your household and how each of them stands.

A husband or wife now decides for themselves whether to come. If they stay, the marriage continues across a border: it wears
with distance, and a strong one often ends with them following.

Flights abroad have a purpose (a holiday, seeing family, or looking with a move in mind, which helps a later application),
give a little practice in a language you have begun, and are listed on the passport. A criminal record can get a visitor
turned back at the border.

All of this is gameplay configuration, the same shape for every country, and describes no real visa.

### One place to ask what the law is

`js/engine/rules.js`, values in `js/data/rules.js`. Every legal question the game asks goes through `rule(id, place)` or
`may(action)`: the ages for voting, driving, drinking, gambling, marrying, leaving school and drawing a pension; whether
alcohol, gambling, divorce and same-sex marriage are legal; how the law treats gay and transgender people; the death penalty;
conscription. An answer is built in layers, the last one winning:

1. the default;
2. the state a territory belongs to (Puerto Rico starts from the United States);
3. the place itself;
4. a region inside it (the table is ready; regions arrive with states and provinces);
5. anything changed during this life, which is kept in the save and never written back to the reference data.

So at nineteen you can go to a bar in the United Kingdom and not in the United States, vote at sixteen in Brazil, and find
that the Philippines has annulment and no divorce. Now and then a country somewhere changes one of its laws; you hear of it
when it is where you live or a country you are a citizen of, and the World Explorer lists the change.

**Changing the law in office.** A head of government can put these laws to the legislature (Work → Bring in a law → The
law of the land): marriage, protection in law, the death penalty, military service, gambling, alcohol, divorce, and the
voting, drinking and pension ages. Parties vote on them by their views on freedoms, order and public provision, so a bill
your own party dislikes brings rebels. The public has a view as well, which starts from the law the country already has. A
bill costs nothing and has no committee stage; it counts as one of the year's two bills; a crown with real power can refuse
it; where one person rules, it is a decree. The world's own reforms in a country your life has a government for now need a
government that wants them.

**Regional law.** Where a country leaves some of these laws to its states, provinces or emirates, the head of a region
can change them, one a year, through the regional assembly. Which ones depends on the country: an American state can set
the death penalty, gambling and the driving, drinking and gambling ages; a Canadian province the same except the death
penalty, which is federal; a German Land only gambling; an Indian state or an emirate can ban alcohol; in Brazil, France,
Italy or Russia none of these are regional (`REGIONAL_POWERS` in `js/data/rules.js`, checked against sources where they
exist; see `docs/WORLD_DATA.md`). A law applies to everyone living in the region (where the game records no states, the
area around the city). What is left to the regions is theirs alone: the national government cannot change it, and in the
world's own slow reforms these laws change one region at a time.

The values are hand-compiled, one per place, and unverified. They are not legal information.

### Cities and regions that differ

`js/engine/cities.js`, rows in `js/data/cities.js`. A city is no longer only a name. Each has a profile against its country
as a whole: what homes cost to buy and rent, and what work pays. Twelve countries (the United States, the United Kingdom,
Canada, Mexico, Brazil, France, Germany, Japan, India, South Korea, Australia and the United Arab Emirates) have a row for
every city, with the state, province or region it is in. Everywhere else the capital and the first-listed city get a generic
profile and are marked as estimates.

- Property listings, rent and salaries follow the city. A house keeps the value of the city it stands in.
- **Moving** (Pursuits) lets you move to another city without leaving the country: a moving cost, a job that transfers if
  the employer has a place for you, a home that stays where it is, and an entry in the record of where you have lived.
- When you emigrate you choose the city you arrive in.
- A region can have its own law, through the rule engine: the death penalty by American state, the drinking age by Canadian
  province, alcohol by emirate.

Safety, schools and hospitals also vary a little by kind of city: the capital and the largest city have the major hospitals
and slightly better schools, and a little more crime; smaller cities are safer, with fewer specialist hospitals. This is a
rule by kind of city, not data about any named place, and it is modest next to the differences between countries.

The multipliers are rough estimates for play, not statistics.

### A world that moves without you

`js/engine/economy.js`, numbers in `js/data/economy.js`. Each year, in every country:

- **The economy turns** between boom, steady and recession. Where you live this changes how easy it is to be hired, how
  likely you are to be laid off, what house prices do, and where the currency is heading. Now and then a financial crisis
  crosses every border at once.
- **Crises end, and new ones begin.** A war can end in a ceasefire, a collapsed economy can recover, and an unstable country
  can slide into rationing or runaway prices. Everything that read a country's crisis before (the ban on leaving a country at
  war, the protection route, prices, approval of the government) now reads the world as it is in this life.
  Rarely, armed conflict breaks out in a country that is already deeply unstable. It is reported as conflict within that
  country, never as one named country attacking another: the game does not invent wars between real nations.
- **The news** records all of it, with changes of law. **World news** (Self tab) lists what touches you first: where you
  live, where you were born, countries you are a citizen of, and where your family and property are. Only those reach the
  journal.
- **People you know move.** Brothers, sisters, friends and grown children sometimes move abroad, more often from a country
  in trouble; some come home, and some move to be nearer to you. You can fly out to see them, and family abroad opens the
  family route if you want to follow.

All of it is fiction, kept in the save. The reference data is never rewritten, so each new life starts from the same world.

### Property across borders, and tax by place

`js/engine/realEstate.js`, with `quoteForeign`, `payForeign` and `receiveForeign` in `js/engine/currency.js`.

- **Buying abroad** (Holdings → Browse property → In another country): choose a country and a city, and see that year's
  listings in the local currency. A purchase is outright (no lender there will lend to someone who does not live there), with
  5% in fees. It is paid from your account in that currency first, and the rest from everyday money at today's rate, less the
  bank's fee. The exchange is written in the currency record.
- **Owning it**: a property is valued where it stands and brought home at today's rate, so what it is worth to you moves with
  the currency as well as the market. It can be let, and stayed in when you visit. If you move to that country it becomes a
  home in local money, at the same worth.
- **Selling it** pays in the money of the place, into your account in that currency.
- **One housing market per country.** Each country's prices move with its own economy (and now and then slump), so a home in
  Mexico and one in Canada no longer rise and fall together.
- **Loans and rent keep their currency.** A mortgage is held in the currency it was taken out in, and a tenancy is paid in
  the money of the place: moving abroad no longer converts them. Payments, upkeep and local tax on a property abroad come
  from your account in that currency first, then from everyday money at today's rate; rent abroad is paid into that
  account. Net worth, debts and estates count each loan at today's rate.
- **Tax by place**: property tax and tax on rent are charged by the country the property is in. At death, property abroad is
  taxed by the country it stands in and everything else by the country you lived in; the obituary lists each. An inheritance
  from someone who lived abroad is taxed there.

### How tax and health care work, country by country

`js/engine/systems.js`, shapes in `js/data/systems.js`.

**Income tax** is the country's headline rate run through a schedule: an allowance, then bands. There are four shapes: none
(the United Arab Emirates and others that charge nothing), one flat rate (Russia, Ukraine, Hungary and others), rising bands
(the default, and the United States), and steeply rising bands (much of western Europe, Japan, South Korea, Canada,
Australia). The top band is each country's real top rate, from "List of countries by tax rates" (`TAX_TOP`; for the
United States the federal 37%). The low paid keep more than before and high earners less. Holdings shows the rate on what you earn now and on
anything more you earn.

**Estate and inheritance tax** (`js/engine/inheritance.js`, rules in `js/data/inheritance.js`) depends on who inherits. Some
countries tax the estate as a whole before it is shared (the United States above USD 15 million, the United Kingdom at 40% above
GBP 325,000, Japan, South Korea, Taiwan, South Africa, the Philippines); others tax each heir on what they receive, with a spouse
usually exempt, a child paying little, and anyone else much more (Germany, France, Spain, Italy, Ireland, the Netherlands and
others); many charge nothing. A will that leaves everything to friends costs more than one that leaves it to children, and
charity is untaxed. Rates and allowances come from PwC Worldwide Tax Summaries and Wikipedia; see `docs/WORLD_DATA.md`.

**Health care** has six models:

| Model | Where (examples) | What you pay |
|---|---|---|
| Public | United Kingdom, Canada, Australia, Brazil | almost nothing |
| Compulsory insurance | Germany, France, Japan, South Korea | a yearly contribution if you earn, and a fifth of each bill |
| Private insurance | United States | a fifth with cover, which a full-time job brings or you buy; the whole bill without |
| Through your employer | United Arab Emirates | a tenth with a full-time job; the whole bill without |
| Public clinics, private care | Mexico, India | two fifths |
| Out of pocket | where the game had no public care | the whole bill |

Private cover is bought and canceled at the doctor's, lapses if it cannot be paid for, and does not travel to another country.

These are shapes for play. The thresholds are multiples of a typical wage in the game, not real brackets, and which country
gets which shape or model is unverified.

### Families and couples that cross borders

- One new family in ten has a parent who came from another country: they have that country's name and nationality (and the
  local one too, where both allow it), their own parents still live there, and the child is born with whatever both parents
  and the place give. The country is drawn evenly from the whole world.
- Now and then a child's family emigrates, far more often from a country in crisis. The parents and young brothers and
  sisters come; grandparents and friends stay, and can be visited.
- Some of the people an adult meets grew up abroad. Marrying one opens the family route to their country, shortens the wait
  for its citizenship, and grants nothing by itself.
- Politics goes on in countries you have left and still have ties to, so a country you return to has moved on.
- Portuguese is a language of its own in the game now (Portugal, Brazil, Angola), and someone born where the same language is
  spoken arrives already speaking it.

### Travel, immigration and living abroad

**Explore the World** (Self tab; Pursuits → Travel; People → Family archive) is one hub over the Global Life engine. Each part
keeps apart things that are easy to confuse: where someone was born, where they are now, where they live, which nationalities
they hold, which passports they carry, what a border asks of them, and whether they may live, study or work somewhere.

| Engine | What it keeps |
|---|---|
| `js/engine/geo.js` | a stable id for every city (`jp/Kyoto`), its GeoNames position, landmass, time zone, season, and the jurisdiction it belonged to in a given year (Leipzig in 1980 was East Germany) |
| `js/engine/documents.js` | passports (issued only to nationals; expiring or being lost never touches citizenship), what each border asks of each nationality, ETAs and e-visas decided at once, visitor and student visas decided when the year turns, days spent abroad and the Schengen 90-in-180 count |
| `js/engine/travel.js` | trips: plan, invite (each person decides for themselves, once), choose transport by era (no planes in 1800, a change of planes at a hub on long flights, local arrival times across the date line), stay, things to do, pay once, cancel by the terms, set off, do things there, come home |
| `js/engine/relocation.js` | moving abroad as a case: apply, a decision when the year turns, then a checklist read from saved state (housing, money, the family's passports, the pets, the journey) before the move itself |
| `js/engine/chronicle.js` | the ledger (every payment once, every refund once), canonical life events (one per thing that happened, with a stable id) and the archive of past lives |
| `js/engine/globalLife.js` | the year's turn: decisions due, papers that run out, everyone's residence history, relatives abroad who visit, a parent's language picked up at home, settling in after a move, births abroad |
| `js/engine/globalStory.js` | the views: Places I've Lived, Our Global Story (map and timeline by generation, person, country, period and kind), the House Chronicle, a person's geography |

- **A trip is not a move.** Taking a trip changes where the player is, never where they live. Days away are counted at the border.
  A one-tap holiday is recorded as a trip too, so the Travel Journal sees every trip.
- **Time.** The world clock moves a year at a time. Inside a year a calendar date moves forward only as journeys take people away
  and back, and starts again on 1 January; nobody ages on a trip. A trip booked for a year and not taken is taken as planned before
  the year turns. Applications that take time are decided at the turn of the year, once, and the decision is kept.
- **Moving** never grants a nationality or permanent residence by itself; marriage and owning property grant neither; a work visa
  becomes permanent residence only through the route's own conditions; citizenship only by applying. The old home, friends, family
  and property stay where they are, in the records. Pets travel only with an arrangement, or stay with family.
- **Children born abroad** get the nationalities the place and each parent give (`js/data/citizenship.js`): Mexican parents in Japan
  give a Mexican child; a Korean and a Spanish parent in Canada give a Canadian and Spanish child. No child inherits a visa.
- **Generations.** When an heir carries on, the life that ended is archived with its places, trips and papers; every event carries
  over with its id; homes keep their ids. Our Global Story shows all of it; an ancestor's papers stay private.
- **Health care follows status** (`VISA_HEALTH` in `js/data/systems.js`, a gameplay rule): where care is for everyone, work and
  student visa holders pay a yearly health charge and are covered like residents (unpaid, they pay in full); a retirement visa gives
  no public care, so private cover is bought or the whole bill paid. The moving checklist says what care will look like on arrival.
- **Stories of a life abroad** (`js/engine/abroadArcs.js`, scenes in `js/data/events/abroadArcs.js`), each begun only from the save: a job offer
  abroad for someone qualified and established (apply, go and meet them, talk it over, or say no); a husband or wife living in another
  country (ask them to come, which is their decision and their permission; move to them, which is your application; visit; let it be);
  going home after ten years away when a parent there is growing old; retiring near a child abroad, or somewhere warmer and cheaper;
  a teenager's first trip abroad with the family (to family abroad if there is any, somewhere no visa is needed); an exchange
  semester for a university student; a child growing up with a parent's language at home (spoken at home, weekend school, or let
  go); and an established family business opening a branch abroad, near a relative who lives there.
  A "yes" is an application or a draft trip, never an approval.
- **Moving with children** (`js/engine/familyMove.js`): a child under 18 whose other parent is alive and not coming moves only with
  that parent's agreement or a court's permission (which weighs the child's age, who they are close to, and why the family is
  moving); otherwise the child stays with that parent. Children who move start at the local school in the new town and settle in at
  their own pace (younger and easy-going children sooner; a new language and a worrier later). Game rules, not family law.
- **Businesses abroad** (`js/engine/businessAbroad.js`, on the business engine): start a business in another country without moving
  (a manager runs it from the start; the money is changed at today's rate), or open a branch of an established business abroad,
  paid from its own account. Each keeps its accounts in local money and pays its tax there; what it pays the owner is changed and
  taxed where the owner lives, once. Owning one gives no right to live there: after a year of trading with staff, the business-owner
  route opens (an application; a permission renewed while the business trades, permanent after five years).
- **Qualifications abroad** (`js/engine/credentials.js`): sixteen regulated careers (medicine, dentistry, pharmacy, nursing and
  midwifery, physiotherapy, veterinary work, law, teaching, chartered accountancy and engineering, electrical and plumbing work,
  airline flying) are practiced only where the qualification is recognized. Where someone trained, or has practiced, counts; anywhere
  else they apply to the professional body (a fee, the language at the level the profession asks, a decision when the year turns: a
  license, a supervised adaptation year and an exam, or a refusal). Inside a recognition area (the European free-movement area,
  Trans-Tasman) it is a registration. A job offer does not license anyone. Game rules, the same everywhere.
- **A move cancels trips** booked to leave from the old home, on their refund terms, before savings change currency.
- **Long lives stay small**: a finished trip older than three years keeps its summary, cost and memories and drops its journey legs and
  booking lines; ledger entries older than ten years become yearly totals; days abroad are kept only as long as a limit could count them.
- **Any year from 1800** (Historical Eras): transport is what existed then (sail, stagecoach, then railways, steamships, cars,
  propeller planes, jets), before 1914 no border asks for papers and anyone may go and settle, between the wars passports and visas
  return, and a country at war admits no visitors. Places are named as they were (the Australian colonies in 1825, Leipzig in East
  Germany in 1980). Prices follow the era's money, like every other price in the game.
- **Older saves** gain empty records: no passports, visas, trips or events are invented for them, and old trips stay as they were
  recorded (country and year).

The visit rules, visa names, passport terms, transport dates and earlier jurisdictions are simplified and unverified gameplay
configuration (`js/data/travel.js`); positions are from GeoNames (`scripts/build-coordinates.py`). See `docs/WORLD_DATA.md`. None of
it is travel or immigration advice.

### The brief's ten scenarios

`node tests/world-scenarios.mjs` plays the Living World brief's scenarios A to J through the engine: born in Orlando; a
Brazilian childhood moved to Portugal; India to Canada as a student; a marriage between Japan and the United Kingdom; a royal
child; a mayor's budget; dollars, pesos and a house in Mexico; three generations across three countries; a recession; and
twenty-five years away. A scenario whose character dies early of something unrelated is played again.

The Living World engine is complete as a first version. `docs/WORLD_DATA.md` lists what is simplified, unverified or not
modeled, which is where further work would go.

## One year at a time

Every choice happens in the year it is made; "Age up" lives the
year and then shows what it changed. Things you would otherwise repeat every
year can be set once on the **Your life this year** card (Pursuits): a hobby
focus, a posting routine, a savings goal, care for your animals, family
traditions. See [`docs/YEARLY.md`](docs/YEARLY.md) for how it works and what
is not built.

## Health, mental health and accessibility

**My Health** (Self tab) holds a character's health record: how they have been
sleeping, their energy, stress and pain, what they have been experiencing,
their diagnoses, appointments, therapy, medicines, supports, medical history and
goals, with a **Treatment Journey** and a **DBT Journey** of their own.

- **Conditions are not diagnoses.** Depression, anxiety, BPD, bipolar disorder,
  ADHD, autism, dyslexia, deafness, epilepsy and thirty more can be present for
  a long time before anyone names them. Experiences have several possible
  explanations; an assessment can diagnose, refer, wait, or find nothing.
  Diagnoses can be revised, and a second opinion is always open.
- **Care happens week by week.** Clinics and clinicians persist in each city;
  clinicians are people in your life who age, move and retire. Appointments
  take time and money (once). "Let the weeks pass" moves care on inside the
  year.
- **Medicine is a decision with a prescriber.** Trials unfold over weeks and go
  differently for different people. Follow-ups lead to a proposal you accept or
  decline: carry on, adjust, switch (supervised, with the old trial kept) or
  reduce gradually. A rule registry checks every prescription. No doses appear
  anywhere.
- **Therapy builds skills.** CBT, individual DBT, a DBT skills group (four
  modules, a standing group with its own facilitators), and more. Skills open
  new choices in everyday scenes without deciding how they go.
- **Accessibility removes barriers, not people's traits.** Needs (with or
  without a diagnosis), equipment, school and work accommodations, and home
  adaptations. Asking shares the need, never the diagnosis.
- **Families share genes, not diagnoses.** Predisposition is inherited from
  biological parents and makes things more or less likely, never certain.
  Family medical history shows only what relatives chose to share.
- **Private by default.** Health milestones are hidden from the obituary and
  from descendants unless shared.
- **The body too.** Asthma, high blood pressure, diabetes, heart disease, cancer
  and back pain are found at check-ups and assessments and managed over years;
  hospital stays lead to rehabilitation with goals; every bill is an insurance
  claim you can see (and appeal, if a private insurer refuses it); family
  members can get care of their own.
- **Part of everyday life.** A dot on Self when care needs you, and scenes that
  follow the health record: telling a partner, a child's assessment, supporting
  someone you love, access at work and with friends.

The design, the sources, and what has not yet been clinically reviewed are in
[`docs/HEALTH.md`](docs/HEALTH.md).

## Layout

```
index.html, manifest.json, sw.js, icons/
css/            base, layout, components, modals
js/main.js      boot and screen routing
js/state.js     live GameState store
js/save.js      save slots and graveyard
js/rng.js       seeded RNG (state is saved with the game)
js/types.js     master schemas (JSDoc)
js/engine/      year processor, event engine, effects, conditions, generation,
                health (and health/: the health engine), education, finance, relationships, death
js/data/        countries, traits, birthConditions, illnesses, health/, events/
js/avatar/      portrait parts, catalog, renderer, inheritance, live editor
js/ui/          shell, modals, screens/, tabs/
avatar-lab.html a workbench for avatar artwork
tests/          checks that run on Node alone
```

## Historical Eras

A life can begin in any year from 1800 (the character creator's year of birth), and the world's year decides what life
is like: five eras (Early Era to 1918, Between the Wars, Mid-Century, Late 20th Century, Modern Day from 2000) in one
registry, `js/data/history.js`, answered by `js/engine/history.js`. The year processor's era step (`js/engine/eras.js`)
runs as each year begins. From 2025 on, every answer is today's game unchanged.

| What changes | How |
|---|---|
| Careers | Jobs exist from when they did (no programmers in 1900), with the titles of the time, kept by a job once taken; some were closed to women by law then (the marriage bar, law, uniformed services), through the rule engine. Parents' occupations and NPCs' jobs are of their time |
| Money | Wages and prices move together on a price-level and real-wage index ([estimate]); old currencies (marks, francs, lire, pesetas, Australian and New Zealand pounds and others) and their change to the euro at the official rates, applied once, through the same conversion as emigrating |
| Laws | A historical layer in the rule engine: women's vote by country, the voting age, same-sex marriage, divorce, Prohibition, conscription, the law on being gay, the death penalty, school-leaving age. Dated facts carry a source note; places without their own record use the period's usual law, marked as such |
| Schooling | Most children leave school at the leaving age in earlier eras (the player is offered it, and it is not dropping out); university is rarer; degree subjects exist from when they did |
| Health | Shorter lives in earlier eras, extra risk at working ages, young children in the family who may not survive (never the player as a baby), the danger of childbirth, the 1918 influenza; treatments as medicine then could give them |
| Events | The world wars (with each country's year of entry), the Depression, the postwar boom, the oil crisis, the end of the Cold War, independence: news, economies held in a slump or boom, the call-up for young men where the law conscripted, losses in the family. No battles, no real leaders |
| Scenes | Present-day scenes stay in the present (by the technology they mention, or a reviewed first year); a modern choice in an older scene is hidden. About thirty scenes belong to their decades, from the railway reaching town to the millennium |
| Screens | The creator names the era of a birth year; the Self tab, Digital History and the Family Archive show the times |

`docs/HISTORICAL_ERAS.md` maps where each system meets the eras, and what is a fact and what an estimate. Lives saved
before eras keep their money as it was; lives in the present are unaffected.

## Digital Life

Pursuits → **Digital Life** (*Your connections, your creativity, your world.*): the character's accounts, feed,
messages and group chats, friends and connections, online communities, posts, Creator Studio, online reputation,
digital memories and digital history — or, before there is an online world, the letters, visits and telephone calls
of the time. It is one engine, the **Digital World Engine**, in `js/engine/digital/`, with its registry in
`js/data/digital.js`; the year processor runs it with the rest of the world (`tickDigital`).

| Part | Where | What it does |
|---|---|---|
| Registry | `js/data/digital.js` | Communication technologies (letters to shared presence) with first year, spread and infrastructure needed; devices; places to get online; the game's own platforms (Corkboard, Chatterbox, Inkwell, Guildhall, Hearth, Vista, Murmur, Glimmer, Beacon, Kindling, Spinnet, Lumen) with launch, decline and closing years, age limits, formats, privacy settings, rules and pay; topics, communities, sponsors, trends, project kinds |
| Core | `core.js` | `state.digital` (one per saved life), stable ids, spare hours a year, life events (the Life Story and Family Archive read these), the one reputation record per character |
| Technology | `tech.js` | The only place a year becomes "does this exist yet": adoption by year and country infrastructure, platform status, devices, school/library/work access |
| Accounts | `accounts.js` | Accounts always owned by a real character; guardian consent for young teenagers, decided once a year; handles that change while the account stays the same; `canSee`, the single privacy rule every screen uses; follows, requests, blocks, mutes |
| Posts | `content.js` | Posting (format, topic, real source, audience, time); the audience's response worked out once and kept; comments and moderation; the feed, with disposable "around the platform" background posts kept apart from anything that happened to anyone |
| Messaging | `messaging.js` | Letters, telegrams, calls, texts, email, video calls and direct messages, by era and by what both people have; group chats; replies drawn from the other person's real life; protections for young players |
| Communities | `community.js` | Communities with a few real, persistent members and a member count; friendships that move into the Relationship engine; online dating that hands a first date to the Romance engine |
| Creators | `creator.js` | Channels, stages earned by circumstance, projects with checked transitions, livestreams, collaborations with real people, sponsorships that pay only when delivered, a ledger (gross, platform fee, costs, tax, net) paid through the Finance engine, at most once per key; going full-time through the Occupation engine's creator career |
| Professional | `professional.js` | A profile that is the real résumé; referrals from contacts at their actual employers and recruiter messages, which feed the career engine's existing hiring odds |
| Reputation | `reputation.js` | Recognition, credibility and loyalty kept apart; controversies that record what really happened; safety problems and sensible responses; breaks, notifications and a small, personal effect on mood |
| People | `npc.js` | Close family and friends join platforms (or never do), follow people they know, share news that really happened to them, move on when a platform fades |
| Stories | `stories.js` + `js/data/events/stories/digital.js` | The Story Director's digital scenes, found in saved state: an old friend to reconnect with, a teenager's first video, an ancestor's archive, a controversy, bullying |
| Legacy | `legacy.js` | Accounts become memorials at death; the digital world passes to the heir; descendants see public and family-shared posts, never private messages |
| Year | `tick.js` | The yearly order of work; migration of older saves (the old handle and follower count become one account, with no posts invented); the old `player.social` numbers kept in step |

The screen is `js/ui/digital.js`. Portraits anywhere in it open the person's own profile (the same one the People
tab opens); where the player is — section, filters, the open post or conversation, scroll position — is kept while
they visit a profile, and when Digital Life is closed and opened again.

More of it, by part:

| Part | Where | What it does |
|---|---|---|
| Public life | `civic.js` | Office-holders, candidates and royals speak through official accounts (kept apart from personal ones): a statement nudges approval in office or a campaign's appeal by a capped amount, or a royal's public image, and the country's press reports it. Elections are still counted by the Politics engine. Being widely known brings interviews and panels, a loss of privacy, and — for something the player really did and was never caught for — an allegation, which is not a conviction |
| Study | `school.js` | The school's own systems by era (paper, email, a portal with marks), online study groups with real classmates (a small effect on marks; followers count for nothing), a portfolio of finished work (which helps in creative careers), digital skills |
| More messaging | `messaging.js` | Plans and invitations that really happen the next year (and are remembered), photos, anniversary wishes, talking about the relationship (which can clear the air or start a row), venting (the only thing a leak can ever be made of), birthday messages from family (three a year at most), helping an older relative get online |
| More creators | `creator.js` | Optional posting routines; merchandise (with the cost of making it), labeled affiliate links, licensing offers for good work, paid collaborations paid on publication; livestreams scheduled for later with chosen equipment; project work counts as practice for the matching skill |
| Other people | `npc.js` | Gifted friends start channels of their own; people join communities for their hobbies; an online friend who ends up in the player's field becomes a colleague; a few well-known creators on each platform to follow, who are strangers, not friends |
| Radio and television | `broadcast.js` | Once a year, an evening's listening or viewing (news, music, plays, sport, serials, cartoons) with whoever is at home, or at a neighbor's when there is no set; the first set in the house as a life moment; now and then a broadcast the whole household remembers. Sets are household devices like any other |
| Story arcs | `stories.js` | Also: a creator's crossroads (make it a job, keep it on the side, step back), burnout after two heavy years, stopping decades later; life after going viral; a bigger creator reaching out; a recruiter; an invitation to moderate; meeting an online friend; a partner abroad; old posts decades on (shared with the family, they join the archive); a child's school photography project |

Also: the character creator can start a life in any year from 1800; scenes that mention modern technology, and the
creator career, only appear once the registry says that technology exists where the player lives; the feed carries
the country's real news; trips the player took and homes they bought or renovated can be posted about (a trip names
the place visited, never the home); profile pictures (portrait, initials, a pet, a symbol — never someone else) and
links to one's own other accounts; devices are belongings with a condition; a self-set limit on screen time; locked
accounts can be recovered; neighborhood groups follow a move; a university's community is made of real classmates;
dating has preferences (ages, distance, what one is looking for); the Family Archive opens from the People tab too.

Still not built: business partnerships (there is no business system in the game for an online friend to join);
content projects live in
the Digital World because the game has no separate hobby-project system.

## Where to edit content

| To change | Edit |
|---|---|
| School stages, programs after high school (university, cosmetology, graduate, medical, law), tuition, entry GPAs, housing costs | `js/data/schools.js` |
| University majors, their entry GPAs and audition majors | `js/data/majors.js` |
| Clubs, classes, try-outs, yearly skill gains, the contact a club introduces | `CLUBS` in `js/data/schools.js` |
| High-school crowds | `CLIQUES` in `js/data/schools.js` |
| Kinds of university that make offers (names, cost, aid, what each is known for) | `SCHOOL_TYPES` in `js/data/schools.js` |
| Apprenticeship trades, gap-year options, yearly priorities | `TRADES`, `GAP_YEARS`, `PRIORITIES` in `js/data/schools.js` |
| Part-time jobs and pay | `js/data/partTimeJobs.js` |
| Careers: ladders, pay bands, entry requirements, doors opened by storylines, fame | `js/data/careers.js` |
| Freelance gigs and fame actions | `GIGS`, `FAME_ACTIONS` in `js/data/careers.js` |
| Interview questions and audition pieces | `js/data/interviewQuestions.js` |
| Workplace events | `js/data/events/work.js` |
| Property types, mortgage terms, rent and bills | `js/data/properties.js` |
| Vehicles (bikes and boards for children, motorbikes, cars, boats, aircraft), the age each can be bought at, licenses, servicing | `js/data/vehicles.js` |
| Funds, shares and coins (all fictional); bank loans; overdraft and bankruptcy | `js/data/securities.js` |
| Gambling stakes, lottery prizes, the bookmaker's cut | top of `js/engine/gambling.js` |
| Money events (leaks, tenants, breakdowns, tips) | `js/data/events/money.js` |
| Crimes and the age each opens at, strangers, ways of killing, lawyers, prison gangs, sentence rules | `js/data/crimes.js` |
| Property tax by country | `PROPERTY_TAX` in `js/data/countries.js` |
| Monarchies: which countries have a crown, the titles used there, allowances, public duties, how rare a royal birth is | `js/data/royalty.js` |
| How each country is governed, what its offices are called, campaign platforms, budgets and moves, what office-holders can do | `js/data/politics.js` |
| Political scenes (class president, polling day, scandals, removal votes, uprisings) | `js/data/events/politics.js` |
| Royal and noble scenes (palace invitation, honors, scandal, protocol) | `js/data/events/royal.js` |
| Moving abroad: who comes, how likely relatives are to say yes, shipping costs, the passport | `js/engine/emigration.js` |
| Transport by era, places to stay, things to do on a trip, kinds of trip, refund terms, passports, visit rules by destination, pets moving, earlier jurisdictions | `js/data/travel.js` |
| City coordinates (generated from GeoNames: run `scripts/build-coordinates.py --write`) | `js/data/coordinates.js` |
| The land outline on the family map (generated from Natural Earth: see `scripts/build-land.py`) | `js/data/land.js` |
| Escape puzzle maps (run `node tests/escape-layouts.mjs` after editing) | `js/data/prisonLayouts.js` |
| Treatment costs and success rates, surgeries and surgeons, activity and holiday prices, follower packs, emigration fee | `js/data/activities.js` |
| Trips: getaways, theme parks, cruises, flight classes, and the stories told about them | `js/data/activities.js` (`HOLIDAYS`, `CABINS`, `TRIP_STORIES`) |
| How long people live: the mortality curve, the constitution rolled at birth, and what good habits add | `js/engine/death.js` (`mortalityChance`, `rollLongevity`, `careShift`) |
| Illnesses (what they do each year, who gets them) | `js/data/illnesses.js` |
| Health, online and living-abroad scenes | `js/data/events/leisure.js` |
| Epitaphs (titles, inscriptions, what earns each) and the untaxed estate allowance | `js/data/epitaphs.js` |
| Age down: how many years can be taken back | `UNDO_YEARS` in `js/save.js` |
| Which stats and talents can be edited on other people | `EDITABLE_METERS`, `EDITABLE_TALENTS` in `js/engine/relationships.js` |
| Wills: who inherits, who gets which property or vehicle, what happens at death | `js/engine/death.js` |
| Skills that can be practiced, sessions a year, lesson price | `js/data/skills.js` (rules in `js/engine/skills.js`) |
| Orientation, gender, transition steps and costs, how family respond | `js/engine/identity.js` |
| Scenes about identity | `js/data/events/identity.js` |
| Countries: currency, tax rates, cities, public services | `js/data/countries.js` |
| What each country is like to live in: pay, prices, safety, health care, power and water, stability, hazards, laws, crises | `js/data/living.js` (simplified, mid-2020s; edit a row and the game follows) |
| What living somewhere does each year, how wealth softens it, and what the law allows | `js/engine/living.js` |
| Scenes that depend on the country | `js/data/events/country.js` |
| First names and surnames for each country (people are named from where they live) | `js/data/names.js` |
| Child acting: ages, levels, pay, and the head start it gives an adult actor | `child_actor` in `js/data/careers.js` |
| Prison events | `js/data/events/prison.js` |
| Gift tiers, rings, wedding sizes, fees | top of `js/engine/relationships.js`, `romance.js`, `children.js` |
| Romance and family events | `js/data/events/romance.js`, `family.js` |
| Other people's lives: ambitions, hobbies, school and adult moments, family size limits | `js/data/npcLife.js` |
| Scenes that other people's lives ask you to respond to | `js/data/events/familyLives.js` |
| Friend scenes (new groups, fallings-out, memories) | `js/data/events/friends.js` |
| Early-life scenes (infancy to the teens) | `js/data/events/early.js` |
| Everyday adult and later-life scenes | `js/data/events/everyday.js` |
| Higher-rate income tax and yearly living costs | `js/engine/finance.js` (`incomeTax`, `lifestyleCost`) |
| How performance and promotion work | `js/engine/career.js` (`tickCareer`) |
| One-off events | `js/data/events/*.js` |
| Multi-year storylines: musical theater, mentors, school paper | `js/data/events/stories/*.js` (each file's header explains its flags and contacts) |

Storyline scenes are ordinary events with a few extra fields: `priority`,
`exclusive`, `queuedOnly`, cast by contact tag (`'tag:director'`), outcome
variants chosen from history with `when([...], outcome)`, memories stored on
people with `mem()`, and follow-up scenes with `queue()`.

## Royalty

Seventeen countries have a reigning royal family in the game: the United
Kingdom, Spain, Sweden, Norway, Denmark, the Netherlands, Belgium, Monaco,
Japan, Thailand, Malaysia, Morocco, Jordan, Saudi Arabia, Kuwait, Qatar and
the United Arab Emirates. Monaco's sovereign is a prince, not a king.
Malaysia has nine royal houses: the one in the game rules a state by
inheritance, and its sultan takes a five-year turn as king every 45 years. Titles follow each country
(Infanta in Spain, Emperor in Japan, Sheikh in the Emirates; dukes, earls and
barons where a nobility survives). Every house and person is invented.

- **Born to it:** rarely by chance, or chosen under "Born into" when designing a
  life in a monarchy. A royal child has a place in the line of succession and
  can inherit the throne. A noble's child inherits the title from their parents.
- **Married into it:** the famous, wealthy and successful are sometimes invited
  to the palace, where an unmarried royal may take an interest. Marrying one
  needs the palace's consent, which depends on your good name, criminal record
  and past marriages. It can be refused, and asked for again the next year.
- **Public image:** a royal's standing with the public, shown on the Self tab.
  Public duties (three a year) raise it; idleness, scandal and convictions sink
  it. If it falls far enough the palace removes the title, and a monarch is
  made to abdicate.
- **Honors:** in the United Kingdom and Spain the crown honors commoners who
  give a great deal or become widely known.

### The royal house and the dynasty journal

Each monarchy has a royal house: a family tree of real people going back
about 150 years, kept in the save (`state.dynasties`). Everyone in it has a
face inherited from their parents through the ordinary avatar genetics, a
birth and death, a marriage, and a story. The player's own parents, siblings,
spouse and children are the same people as in the People tab, linked in.

- **The line of succession is worked out from the tree** under each country's
  law (`law` in `js/data/royalty.js`): eldest child, sons first, or men only
  through fathers. Marrying in gives a title and never a place in the line;
  adopted children follow the law; someone who abdicates stays out.
- **The house lives a year at a time.** Relatives marry, have children, cause
  scandals, give up their place, divorce and die, and the line moves. When the
  monarch dies the first in line takes the throne, whoever that is.
- **The dynasty journal** (Self tab, "The dynasty", or "The royal family and
  its history" for a commoner): every monarch back to the founder, the living
  family, the line of succession with the reason for each place, and the
  house's history. Tap anyone, living or long dead, for their portrait, their
  reign and what of them reaches you, such as "You have her eyes".
- **It carries on.** Continue as a child and the house, its history and your
  former self all remain; the heir takes whatever place is really theirs.

- **Rivalries.** An ambitious relative close to you in the line may come to
  resent you. The story runs over several years (overlooked, finding allies,
  going public) and your choices decide whether it ends in peace, a long
  silence, or a public crisis. Not every life has one.
- **A royal childhood and a royal wedding.** Nannies, etiquette, the first
  public engagement, boarding school, being the spare. Marrying in, you choose
  the scale of the wedding, the cameras and the honeymoon, and the public
  reacts to each.

- **Three reputations.** Public approval, the family's regard and the tone of
  the press are separate and move for different reasons; the Reputation screen
  (Self tab) lists what changed and why. The family notices who does their
  duties, and halves the allowance of someone it has closed ranks against.
- **The press.** Stories are either true or rumor. A rumor can be denied or
  ignored; denying the truth can come back. Stories fade over the years, and
  cost approval while they are loud.
- **Love and children.** Someone born royal can fall for a commoner in secret,
  be found out, and choose between them and the family. Marrying out brings
  the spouse into the family tree (and, where the house's law says so, takes a
  princess out of it). Grown children refuse their training, want another
  life, marry for love, or give up their place.

- **Reigning.** What a monarch can do depends on the kind of monarchy (`type`
  in `js/data/royalty.js`). Where the crown only advises, it can address the
  nation, give honors, open the palace accounts, press the government in
  private, or refuse to sign a law. Where it governs, it can build, dismiss
  officials, favor relatives, silence critics, or hand power to an elected
  parliament for good.
- **A monarchy can fall.** Each country has a level of support for having a
  crown at all. If it stays very low there is a referendum, which a royal
  player can campaign in. If it is lost the monarchy is abolished: titles and
  residences go, the family become private citizens, and the player can stay
  or go into exile. The house and its history remain, and a republic that goes
  badly sometimes asks its royal house back.

- **Residences.** The palaces belong to the country and can never be sold.
  The family's own castle and estates belong to the head of the house, who
  pays for their upkeep and can open them to visitors, restore them or sell
  them. Some houses are land-rich and some are threadbare. Private property
  stays with the family if the monarchy falls.
- **Household staff.** A private secretary, a press secretary and (for the
  head of the family) an estate steward. They are people under People, hired
  from three candidates whose ability shows and whose loyalty does not. A good
  one makes risky acts safer, takes the heat out of stories, or cuts the cost
  of the estates; a disloyal one leaks.
- **Duties of four kinds:** public service, ceremonial, diplomatic and family,
  thirteen in all, each moving a different mix of the reputations.

- **Noble titles.** A title such as "Duke of Ghent" is a record of its own
  (`state.titles`), with a holder and a history. Each country with a nobility
  has a few old families. Someone born noble is heir to a named title, which
  comes to them when its holder dies. A reigning monarch can create one title
  a year, for a relative or for someone in their life, hereditary or for life,
  and can revoke any. Hereditary titles pass to the eldest child, and die out
  when there is none.

The rules are in `js/engine/royalty.js` (the player's side), `js/engine/peerage.js`
(noble titles), `js/engine/household.js`
(residences and staff), `js/engine/reign.js`
(powers, abolition, exile and restoration), `js/engine/court.js`
(rivalries and the wedding), `js/engine/reputation.js` (the three reputations
and the press),
`js/engine/dynasty.js` (the house) and `js/engine/succession.js` (the law);
the screens are in `js/ui/royalty.js` and `js/ui/dynasty.js`.
Scenes can test `monarchy`, `isRoyal`, `isNoble`, `titled`, `reigning`,
`royalBy` and `royal.image`, and use the `image()`, `meetRoyal()` and
`honor()` effects.

## Politics

From 18 you can run for office from the Work tab. The ladder is city
councillor, mayor, a seat in the national legislature, head of a region, and
head of government, each with the title the country uses (Governor and
President in the United States, First Minister and Prime Minister in the
United Kingdom, Chancellor in Germany, Taoiseach in Ireland). Countries
without regions skip that rung.

- **Systems:** presidential, parliamentary, one-party (China, Vietnam, Cuba:
  a committee chooses, not the voters) and none (the Emirates). In Russia,
  Venezuela and Egypt the count leans toward those already in power.
- **Campaigns:** one a year. Pick what you stand for, how much of your own
  money to spend, and two moves. Charm, intellect, fame, a clean record and
  experience all count: student council, the debate team, a law or politics
  degree, helping on a campaign, and above all the rung below.
- **In office:** a salary, a term, and an approval meter. Two actions a year;
  doing nothing costs approval. At the end of a term you stand again or step
  down. Presidents are held to their country's term limit. Low approval brings
  a recall, an impeachment or a vote of no confidence.
- **At the top:** national holidays, a statue of yourself, a pardon for
  yourself, or seizing emergency powers and ruling without elections, which
  can end in an uprising.

### School

School is shaped by the country (`js/data/education.js`): what each stage is
called and when it starts (primary school at 5 and sixth form at 16 in one
place; école primaire at 6 and lycée at 15 in another), how work is marked
(letters, out of 20, out of 10, percentages, 1 to 6, or a grade point
average), and what a school-leaver walks away with. Inside the game there
are always three stages and marks from 0 to 4; the player sees the country's.

- **Schools are places.** A town has named schools of different kinds
  (state, faith, selective, private, boarding, performing arts, sports
  academy, or lessons at home) and they persist in the save: the next child,
  and the next generation, can sit in the same classrooms. The family
  chooses, by what it can afford, what the child is good at, and what it has
  always done; from 11 the child can ask to change, once per stage.
- **Subjects have their own marks** (`js/engine/grades.js`, checked by
  `tests/schooling.mjs`). A year's mark comes from ability, work, interest,
  attendance and teaching together, with work counting for as much as
  ability. Each child has a bent for some subjects; interest grows with
  success, good teachers and clubs. One subject a year can be given extra
  attention, and a tutor works on the weakest.
- **The class stays.** Classmates move up the school together instead of
  being replaced each year, grow closer or do not by how well they suit the
  player, and the closest becomes a best friend. Those the player was close
  to stay friends after school; the rest are remembered and can turn up
  again decades later. Two teachers at each stage are people with a subject
  and a way of teaching.
- **The school book** (Work tab) shows the school, every subject, the class
  and teachers, and every school attended. Rules: `js/engine/schooling.js`.

- **School life** (`js/engine/schoollife.js`, scenes in
  `js/data/events/schoolLife.js`). Classmates have interests and clubs of
  their own, and news of their own each year. The player's friendship group
  is whoever they are actually close to, usually found through a shared club.
  - *Clubs and teams* have a year: a season for the school team (in a sport
    the country plays), a competition for the debaters and the band, a
    production for the drama club. Standing in a club grows with skill and
    time, and can end in being chosen to lead it. The best older players are
    noticed by university coaches.
  - *Productions* begin with an audition against a named classmate, and the
    part goes to whoever suits it. Every part played is kept for good.
  - *Courses* are chosen for the last stage of school: three electives
    beside the core, and up to two subjects at an advanced level.
  - *Scenes* come from what is true of this class: a first day, a birthday
    party, a best friend moving away, friends falling out, a rumor, being
    bullied (with adults who act when told), a teacher who sees something,
    a false accusation, the dance, the final exams, the last day.

### Getting into university

- **A catalog per country** (`js/engine/university.js`, patterns in
  `js/data/universities.js`). Nine invented institutions, named for the
  country's own cities and kept in the save: an old and very selective one,
  two large public universities, a technical institute, two regional
  universities, a small college, a conservatoire that teaches only the arts,
  and an open university that takes anyone. They differ in how hard they
  are to get into, what they cost, where they are, what they are good at,
  and how generous they are. None is real.
- **A round of applications.** From 16, or any time after leaving school:
  choose a subject, add up to five places, write a personal statement, and
  send. Still at school, offers are conditional on final marks and settled
  on results day; with results in hand, answers are final. Waiting lists
  move, one decision a round can be appealed, and one place can be held for
  a year.
- **How it is decided** (`js/engine/admissions.js`, checked by
  `tests/admissions.mjs`). The record, not the mind: marks against what the
  place usually takes, advanced courses in the subject, teachers'
  recommendations, life outside lessons, the statement, and, where it
  applies, what the applicant had to work with, a family history there, or a
  coach's request. Performance courses are decided by audition. The most
  selective turn away good applicants for want of room. Every answer comes
  with its reasons.
- **Help with the cost.** A scholarship for merit, athletics or performance
  (the largest only), plus a grant for need, each as a share of tuition
  waived. What is left is paid by parents, savings or a loan. A merit
  scholarship is lost if marks fall; help for need is not.

### University life

Once enrolled (`js/engine/campus.js`, scenes in `js/data/events/campusLife.js`):

- **The course is credits.** A degree is 120 credits. A light, standard or
  heavy load earns 24, 30 or 40 a year and moves marks up or down, so a
  degree takes five, four or three years. A minor can be taken alongside,
  goes on the degree, and counts where an employer asks for that subject.
  Changing course keeps every credit within a family of subjects and loses
  a year's worth between families. Marks under 1.8 mean academic probation
  before anything worse.
- **People.** One professor knows the player; going to office hours each
  year turns that into a recommendation. A roommate, in halls as well as in
  a flat, is a person with a way of living: they become a close friend, or
  the argument has to be had. Friends made here stay.
- **Organizations.** Up to two of ten: students' union, a subject society,
  sport, drama (cast by audition), the newspaper, debating, a party branch,
  volunteering, music, and fraternities or sororities where those exist.
  Standing grows, and can end in an election.
- **Internships.** After the first year, three postings each summer in the
  fields the subject leads to, one of them the one everybody wants. Getting
  one depends on marks, a professor's backing, leadership and where one is
  studying. A summer that goes well ends with a job held open, and any
  internship is a foot in the door for that career.
- **A year abroad** in one of four countries the university sends students
  to: the language, a friend for life, and a better chance of a visa there.
- **Graduation** records the minor and any organization led, and notes it
  when nobody in the family has done it before.

University and training are in `js/engine/education.js`.

### After the first degree, and later in life

`js/engine/adulted.js`, with the programs as data in `js/data/schools.js`:

- **Professional schools**: medicine, law, business, dentistry, pharmacy,
  veterinary medicine, teacher training and nursing (which needs no degree).
- **Licensing exams.** A professional degree lets you sit the exam; passing
  it lets you practice. Once a year, with a choice of how to prepare.
  Teaching is the exception: schools hire graduates without the
  certificate, and prefer those with it. People who qualified in older
  saves are treated as already licensed.
- **A doctorate**: a topic, a supervisor with a style of their own, a
  stipend, papers published along the way, and a defense. Four to eight
  years; it opens university teaching.
- **Part-time study** keeps the job and takes longer. An employer can be
  asked to pay, once a year, and says yes to people it wants to keep.
- **Ways back in**: an adult school certificate for people who left without
  one, technical college as a paid-for alternative to an apprenticeship,
  and one-year certificates that open some degree-only careers by a
  narrower door.
- **Credits are kept.** Leaving a degree banks what was earned; coming back
  counts it, less a year's worth if the subject is a long way from the old one.

### Education through a whole life

- **Your children's schooling** (`js/engine/kidschool.js`, scenes in
  `js/data/events/parenting.js`). Children go to the same schools and
  universities as everyone else in the world. At each stage you choose
  where they go: the local school, private, boarding, somewhere that fits
  their gifts, or what they want. From the People tab: help with homework
  (patient, strict, or hands-off — strictness helps some children and
  backfires with others), pay for a tutor, turn up to their concert or
  match, change their school, talk about university. Scenes for a bad
  report, a prize, and a grown child going back to study.
- **The family's record** (`js/engine/edlegacy.js`, Work tab → *Family
  schooling*). Each generation's schools, degrees, prizes and the teacher
  who mattered pass to the heir. An heir carries on at the school they
  were at, and arriving at a university a parent attended is noted.
  Family history is noticed in admissions; it guarantees nothing.
- **A royal education** (`js/engine/royaled.js`). At ten: palace tutors,
  the family's boarding school, or a day school. One royal lesson a year
  from the royal card: protocol, the constitution, diplomacy, a language,
  cadet training. At seventeen, the family's expectations — and the choice
  to follow them, serve first, or go your own way. A title earns nothing
  at admissions.
- **Politics.** State schools' teaching follows what national and local
  government spend on them, a little each year. A rival on the ballot may
  be someone from your school year, often from the school council. Politics
  students can intern in a politician's office; one who remembers you well
  may endorse you later, as may a school-council friend.

- **Families shape the choice, not the genes.** Whether a child goes to
  university depends on their marks, and on what the family brings: a
  parent who went, money at home, the school they attended. Grandchildren
  go to school too, so an heir of any generation arrives with a record.

### Schools and degrees in each country's own terms

Schools and universities are named in the country's language
(`js/data/localNames.js`): a *Lycée* in France, a *Gesamtschule* in
Germany, an *Instituto* in Spain and Latin America, numbered schools in
East Asia. All the place words are invented. University results are shown
the way each country writes them (`showDegree` in `js/engine/grades.js`):
honors classes in the UK and much of the Commonwealth, marks out of 20 in
France, 1,0–5,0 in Germany, out of 110 in Italy, out of 10 in Spain and the
Netherlands, A–F in Scandinavia, a GPA in the United States and East Asia.
Underneath, every mark is still on one 0–4 scale.

### What if?

At a turning point (an offer, a proposal, a betrayal, a term ending, a crown)
the scene offers **What if?**: the moment is kept as a second saved life with
the choice still to make, so both roads can be lived. Settings (on the Self
tab) has the same button for decisions made outside scenes. A life can have
four timelines; each gets its own run of luck from the moment it parts. The
title screen tags them and compares them side by side. Which scenes count is
a list in `js/engine/turning.js`; the copying is `forkGame` in `js/save.js`.

### Languages

A language is a skill, and now it matters (`js/engine/languages.js`, with
where each is spoken in `js/data/skills.js`): speaking a country's language
makes a visa likelier and work there easier, not speaking it makes both
harder, and living there teaches it slowly. Languages spoken well count with
employers anywhere, and a head of government who speaks a partner's language
does better on a visit or in talks.

### The political world

Each country has a political life of its own (`state.polities`), which goes on
whether or not the player takes any part.

- **Parties and politicians.** Three to five invented parties, each with
  positions on six issues (`js/data/parties.js`), and politicians who persist:
  they have faces, ages and careers, lead their parties, win and lose, retire
  and die. Nothing here describes a real party.
- **Elections on a calendar.** General elections fall every four to six years
  by country. Voters are five groups with their own priorities and turnout.
  Votes become seats by proportional lists or by districts, depending on the
  country; presidents are elected separately, with a run-off where the country
  holds one. A parliament with no majority produces a coalition or a minority
  government, and coalitions can collapse into an early election.
- **Governments change the law.** Income tax, university funding, health
  funding and housing each move a step at a time, toward what the governing
  parties stand for, within a budget: a government deep in deficit has to
  raise tax or cut something. The changes reach everyone's tax bill, tuition,
  medical costs and rent (`js/engine/policy.js`), and the journal reports them.
- **The player's part.** Join or leave a party from the Politics screen (Work
  tab, "The political world"). A party's backing helps in a campaign; an
  independent has no machine for the bigger races. Offices are contested on
  the calendar, in the year before polling, against a named opponent who
  remembers the result. A head of government can bring in laws, which pass if
  they have the seats.
- **A campaign.** Standing for office is a race in stages (`js/engine/campaign.js`),
  kept in the save so it can be put down and picked up:
  - *The nomination.* A party member seeking anything above the council must
    first beat a named colleague for the party's backing, by winning over the
    members, the leadership, or by outspending them. A loser can stand aside,
    or leave the party and run as an independent.
  - *The pledge.* Each one takes a position on an issue, so it pleases the
    voter groups who want that and puts off those who do not.
  - *The trail.* Four stretches, one thing in each: doors, rallies, courting
    one group of voters, advertising, raising money, a private poll, attack
    adverts, and worse. A published poll follows each, and polls are out by a
    few points, the same way all campaign long.
  - *The debate.* Three questions. A straight answer, a crowd-pleasing promise
    (which comes due in office), an attack, or a dodge.
  - *Polling day.* The result is worked out once and stored; election night
    shows it arriving area by area, after an exit poll that may be wrong.
  A campaign left unfinished when the year ends plays itself out. One-party
  states have no voters to win: the committee decides.
- **Standing again.** At the end of a term the office-holder fights the same
  kind of campaign to keep the job, running on their record.
- **Governing** (`js/engine/government.js`), for a head of government:
  - *The cabinet.* Five departments, each run by a minister who is a
    politician like any other, with a skill of their own. Able ministers lift
    the government and help its bills; an empty post drags it down. Ministers
    are caught in scandals (stand by them or dismiss them), resign on
    principle, or walk out when the leader is weak. Every government in the
    world has a cabinet, not only the player's.
  - *Bills.* A bill goes to committee, where another party may name its
    price, and then to a vote that is counted party by party
    (`js/engine/legislature.js`, checked by `tests/legislature.mjs`). The
    leader can whip, buy votes, appeal to the country, or stake the
    government on it. Where the crown still governs, it may refuse assent.
  - *The budget.* Once a year: tax and every department on one page, one vote
    on the whole. Deficits pile up as debt. A parliamentary leader without a
    majority who loses a budget falls, and must face the voters.
  - *The other side.* A leader without a majority sees the legislature pass
    laws of its own. A president can sign or veto, and a veto can be overridden
    by two thirds.
  Policing joins tax, tuition, health and housing as something governments
  change: it moves the chance that a crime is solved.
- **Leading a party** (`js/engine/leadership.js`). In a parliamentary country
  nobody is elected head of government: they lead the party that can command
  the legislature. A sitting member can challenge their party's leader, and
  the party's members of the legislature vote. A leader whose party governs
  becomes head of government at once; otherwise they take the party into the
  next general election, with a campaign of their own that is worth points to
  the whole party, and a night on which the seats come in. They govern if, and
  only if, their party leads the government; a leader who loses has the party
  to face. Presidential countries keep the race between two candidates.
- **Scandal** (`js/engine/scandal.js`). What an office-holder does in the dark
  (contracts for friends, bought votes, favors for donors) is kept as a
  secret with a weight of evidence that fades over the years. A reporter may
  pick one up: a rumor can be confessed, denied or suppressed; a story can
  be apologized for, pinned on an aide, or sent to an inquiry; and an inquiry
  clears or condemns.
- **The news** (`js/engine/news.js`). Each country has invented newspapers
  that lean one way or the other, a tabloid and a broadcaster. What happens
  in politics is reported in the Politics book's News tab, and the same event
  reads differently in a paper that likes the player and one that does not.
- **The next generation** inherits the country's politics as they were: the
  parent becomes a name in its history.
- **Political families** (`js/engine/kin.js`). A spouse or grown child may go
  into politics, in the family's party or, now and then, the other one. They
  fight their own elections, and the player can campaign beside them, pay
  for the leaflets, or stay out; they get into trouble, and the player
  stands by them or does not. A relative in the legislature can be given a
  ministry, which the family likes and the newspapers notice. What a
  generation did in office becomes the family name: it helps the next one,
  unless it ended in disgrace. An heir who was already in office carries on
  in it.
- **Causes** (`js/engine/activism.js`). Twelve invented campaigns, one for
  each side of each issue. A member collects signatures, marches, organizes
  and, in time, speaks for it. A cause that grows loud enough can force the
  government to change a law. Where protest is not tolerated, marching gets
  people arrested, and governments give way far less.
- **Political staff** is a career of its own, from campaign organizer to
  chief of staff, and counts as experience with voters.
- **Abroad** (`js/engine/diplomacy.js`). Each country deals most with six
  others, and stands somewhere between hostile and close friends with each.
  Governments have good and bad years abroad, sign trade agreements (money
  for the treasury) and defense pacts (an ally in a crisis), and tear them up
  when relations sour. A head of government makes state visits, proposes
  agreements, sends aid and imposes sanctions, with a foreign minister whose
  skill tells; and faces crises, to be settled by talks, sanctions, a show of
  force or giving way.
- **The crown and the government.** Where a monarch reigns without ruling,
  the head of government is received every week: they can ask advice, keep
  to formalities, or leak what was said and lose the palace for good. A
  player who is the monarch is sent the government's real laws to sign, by
  the real head of government, and a refusal that carries the country undoes
  the law. A republican cause and a loyalist one can be joined where there
  is a crown; a republican movement that grows loud enough wins a referendum.
- **Cities and regions** (`js/engine/local.js`). A mayor or the head of a
  region presents a budget of their own each year: local taxes, clinics and
  schools, policing and housing, voted on by a council in which their own
  side holds the largest block. What is decided stays with the place, and
  moves the tax, medical bills, rents and policing of whoever lives there.
- **A citizen's vote.** An adult citizen can say how they will vote (the
  Parties page); the vote is recorded at each general election. Newcomers
  wait five years, and nobody votes where no votes are counted.
- **Loose ends tied.** A party leadership that has just changed hands can be
  contested by a sitting member. Allegations are not always true: a false
  one can still make the papers, and an inquiry clears it. Scandal follows
  a public figure out of office. A relative in the legislature may, rarely,
  come to lead their party and the country.
- **Where there are no elections,** ministers are appointed and rule by
  decree. In a monarchy the monarch remains head of state whatever the voters do.

The rules are in `js/engine/politics.js` (the player's career), `js/engine/polity.js`
(the political world) and `js/engine/elections.js` (the arithmetic, checked by
`tests/elections.mjs`); the screens are in `js/ui/politics.js`, `js/ui/campaign.js` and `js/ui/polity.js`. Scenes can test `inOffice`, `officeTier`, `democracy`,
`partyState` and `politics.approval`, and use the `approval()`, `reelect()`,
`ousted()` and `resignOffice()` effects.

## Work

The Work button on the Work & School tab opens the occupation hub: current jobs (with pay, hours, performance,
satisfaction and stress), the people at work, a job board of real openings at persistent employers, offers and
recruiters, part-time work, a freelance practice, special careers (auditions, portfolios, selection boards), the
military of the country you live in, qualifications, your working history with milestones, retirement, and
businesses of your own (staff, prices, the accounts and their tax, partners, selling, handing on), and a household
plan agreed with a spouse: whose career comes first, and who looks after the children.

There are 193 career tracks and 714 job titles in 19 families. A track is one entry in `js/data/occupations.js`.
How it all fits together (employers, hiring, payroll, the time budget, workplaces, records across generations)
is in [docs/CAREERS.md](docs/CAREERS.md), with an audit of which occupations from the brief live where.

## People you know

Settings (on the title screen and at the bottom of the Self tab) holds a list
of names and genders you add yourself. In each life they can turn up as
friends, classmates, colleagues, dates and strangers, never as born family,
and each at most once at a time. The list is stored in this browser
(`js/people.js`), separately from the saved lives, and travels with them in a
transfer code or cloud saves.

## Moving saves between devices

Saves live in the browser, so each device has its own. Two ways to share them,
both under **Settings**:

- **Transfer saves:** copy a code or save a file on one device, then load it on
  the other. No account needed. Loading can keep what is already there and add
  the new lives, or replace everything.
- **Cloud saves:** sign in with an email and password, and the same lives,
  graves and People you know are kept on every device that signs in. This needs
  a free Supabase project. The steps are in
  [docs/cloud-saves.md](docs/cloud-saves.md), and the two values it gives you go
  in `js/sync/config.js`. Until then the game works exactly as before.

When two copies are combined, the most recently played copy of each life wins,
graves and people are joined, and deletions are carried over. The code is in
`js/sync/`: `bundle.js` packs, combines and unpacks saves; `cloud.js` handles
accounts and syncing; `config.js` holds the project address and public key.

## Adding events

Add an object to a file in `js/data/events/` (or a new file registered in
`events/index.js`). See `js/types.js` for the `GameEvent` schema and
`events/helpers.js` for the effect constructors.

After adding or changing a scene, run `node tests/events.mjs`. It checks every
scene for duplicate ids, missing outcomes, unknown effects and conditions, and
names used in the text with nobody cast as them.

## Status

All ten phases are built: core engine, saves, character creation and family,
education with storylines, careers with fame, relationships with independent
family lives, the economy, crime and prison, health and activities, death and
legacy, and a final pass that brought the game to over 200 scenes, rebalanced money
and promotions, and checked the layout at iPad and phone sizes. Since then: a modular
avatar system with a live editor, wills with named heirs, skills to practice,
orientation and gender identity, living conditions by country, royalty with a living royal house and a dynasty journal,
politics, a list of people you know who are written into your lives,
moving saves between devices with a transfer code or cloud saves, a working life with persistent
employers, coworkers, side jobs, freelancing and recruiters, and a health engine for mental and
physical health, therapy, medication, disability and accessibility (not yet clinically reviewed:
see `docs/HEALTH.md`).

The layout has been checked in a desktop browser emulating iPad and phone
screens (portrait and landscape). It has not been run on a physical iPad.
