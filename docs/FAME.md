# Fame, celebrity and entertainment

Fame in Pathways comes from work that exists in the world: a part in a real
production, a record that came out, a tour that played. Nothing is a bare number
the game sets; every gain has a cause, and the archive can show you where it came from.

## Engines

| File | What it owns |
| --- | --- |
| `js/engine/fame.js` | The **fame profile** on every life: recognition by audience (film, TV, theater, music, digital, public, …) and by country, short-lived *attention* vs lasting *legacy*, favorability, credibility, family recognition. `gain()` and `regard()` are the only ways to change it, and each takes a reason. `hidden.fame` is kept as a derived headline so older systems still work; old saves are migrated honestly. |
| `js/engine/entertainment.js` | The **entertainment world**: studios, networks, theater companies, community theaters, talent agencies and outlets per country; working actors and directors who persist; productions with casts, schedules, budgets and reception; the casting board, auditions, contracts, time on set, credits, articles, and money held in trust for children. |
| `js/engine/press.js` | Agents, publicists, privacy, public appearances, rumors (true or not, kept separately from how sure the outlet was), corrections, brand deals. |
| `js/engine/awards.js` | Award bodies hold one season a year per place, judging work released that year. A season is decided once and stored. Music awards judge releases. |
| `js/engine/music.js` | Solo acts and bands of persistent people, songwriting from skill, singles/EPs/albums, release reception and charts, rival acts, royalties with a catalog tail, record deals (lawyer, negotiation, advance, recoupment, albums owed), gigs, tours with dated shows per city, members leaving, hiatus, splits, reunions. |
| `js/engine/sports.js`, `js/engine/sportsLife.js` | Sport is one system (see docs/YEARLY.md): from first lessons to clubs, drafts, the tour and contracts, every game and event played out. The fame side lives there too: fame from results feeds the **Sports fans** audience of the fame profile, national caps for the best team players, the World Games every four years for individual sports, and men's and women's professional leagues, each from its own year. Someone hired as a professional athlete from the jobs board is signed by a club, or goes on the tour, in the same system (`goPro`). **Sports fame comes only from these results.** |
| `js/engine/modeling.js` | Model agencies, yearly castings (catalog to magazine covers, runway shows abroad), a portfolio of real bookings. Bookings are the modeling career's work, so they shape its performance and fame and are not paid twice. |
| `js/engine/publishing.js` | Manuscripts written over seasons of work, publishers who judge the book and the name on it, self-publishing, release, reviews once, bestseller lists, advances earned back, royalties with a tail, the Lantern Prize. A published author is paid by their books instead of a salary. Memoirs sell on fame. |
| `js/engine/celebs.js` | Famous NPCs' own lives (marriages recorded on both sides, separations, children, scandals reported apart from whether they were true, retirements, returns, deaths) and the player's arc: rising, peak, fading, faded, comeback, with comeback offers (reality show, tribute, memoir, band reunion). |
| Celebrity brands | `fashion_label`, `beauty_brand`, `record_label`, `production_co` in the business engine: they need a known name to start and sell on the owner's fame and goodwill (`starPull`). |
| `js/ui/fame.js` | **My Fame**: Overview (with your arc, comeback offers and celebrity news), Opportunities, Music, Sport, Modeling, Writing, Current work, Representation, Public image, Awards, Connections, Archive, Family (every generation's credits, records, books, sport and awards, linked). Records link to each other (credit → production → castmate; award → season → nominees; record → act → everyone who was in it), with Back. |

Data lives in `js/data/fame.js` (audiences, eras, kinds of production, tiers, roles,
award bodies, venues, release types, deal terms). Everything named there is fictional.

## Rules the engines keep

- **Paid once.** Contracts, brand deals, royalties, advances and tours each have a payroll line with its own source key; `runPayroll` marks them paid, and a second call in the same year pays nothing. An act's money is split between its members.
- **Decided once.** A production's reception, a release's reviews and chart place, and an award season are settled once and stored.
- **No invented credits.** Credits, nominations and discographies are read from productions, releases and seasons, never written as free text.
- **Time is real.** Productions and tours take weeks; a stage run, a TV series and a tour clash with each other; everything appears in the weekly load.
- **Eras.** `MEDIA_ERAS` gates what exists in a year: no film before 1910, no TV before 1950, no recorded music before 1900, no awards before their founding year.
- **Children.** Under-18s need a guardian's agreement; a share of their pay is held in trust and released at 18. A famous parent gives family recognition, not credits, skill or an audience. Performers are exempt from the minimum working age, as child labor laws make them (a child works under an entertainment permit): from 6 a child may sign to perform, within the hours a minor may work, and every part a minor plays asks a little under half an adult's hours.
- **Theater districts.** A country's major stage stands in its real theater district where it has one (`THEATER_DISTRICTS` in `js/data/fame.js`): Broadway in New York, the West End, Toronto's Entertainment District, Melbourne's East End, the Gran Vía, the Grands Boulevards, Hibiya, Daehak-ro and Avenida Corrientes. A show there is a "Broadway musical". The district is a place; the theaters in it, their shows and any awards stay invented. A major stage built before districts, outside one, keeps its old name.
- **Titles that wink.** About a third of plays and musicals take a title that tips its hat to a famous show (`TITLE_NODS`: *Next to Nothing*, *Dogs!*, *A Bus Named Desire*), never one already running. The usual title is still drawn (kept as `drawn`), so the world's rolls are unchanged.
- **The child stage path.** Singing lessons, acting class, dance for the stage (6–12) and youth theater (7–13) train a child properly, up to `LESSON_CAP` on each talent (`js/data/childhood.js`). Most musicals and about a third of plays, at every level up to the major stage, have a child's part (`CHILD_PARTS` in `js/data/fame.js`): no grown performer is cast in it, and children audition against other children, stronger the bigger the stage. A child needs no agent or fame for one; the major stage wants one professional credit (a regional or touring part) or an agent. A child who worked on a professional stage is remembered by musical theater at 18: a better chance at its audition, and a place in the ensemble for a child of the major stage (`mt_performer` in `js/data/careers.js`).
- **Generations.** When a life continues as a child, the world carries over: the parent's productions, awards and bands are remembered as the parent's (an NPC id), and the heir starts with none of their own.

## Balance

`node scripts/balance/fame.mjs [seed] [lives] [years]` plays whole public careers in each field at three levels of
talent, with a keen player who practices every year, and reports peak fame, lasting fame, what they earned against
the country's average wage, how many became nationally and internationally known, and the save size. After the
balance pass (seed 7, six lives each, 20 years), roughly:

| Field | Peak fame | Earned (× average wage) | Notes |
| --- | --- | --- | --- |
| Acting | 65–70 | 3.5–4.5 | the quickest road to international fame, for someone who auditions constantly |
| Music | 30–47 | up to ~1 | touring is where the money is; most acts stay national at best |
| Modeling | 22–32 | 1–2 | a steady living, rarely a household name |
| Books | ~45 | ~1–1.4 | bestselling authors; wealth is rare |

Practice matters more than starting talent: after twenty keen years most players are near the top of their craft.
The pass also fixed sales and shows abroad being counted in the other country's currency (`wageIn` in util.js).

## Tests

```
node tests/fame.mjs    # profile, world, the acting vertical slice incl. reload, odds, schedules, awards once, eras, press truth, children, a 25-year career
node tests/child-stage.mjs  # lessons, children's parts by tier, children auditioning against children, a child's hours and permit, a theater childhood carried into musical theater
node tests/fame2.mjs   # sport played match by match with fame only from results, modeling, books, celebrity brands, famous lives, comebacks, the family record
node tests/music.mjs   # bands as people, songs, releases judged once, royalties paid once, deals and advances, tours, charts and music awards, leaving, saves, heirs, eras
```

## Lives in the past

The new-life screen offers a birth year back to 1920 (`js/data/eras.js`). What had not been invented does
not exist: careers (`CAREER_ERAS`: no software before 1955, no influencers before 2006), freelance services
(`SERVICE_ERAS`), kinds of business (`BUSINESS_ERAS`), social media (`SOCIAL_FROM`), dating apps (personal
ads before 2009), and every medium, sport and award by its founding year (`MEDIA_ERAS`, `data/sports.js`, award
bodies). Women's professional leagues begin in their own years. Money, currencies, laws, wars and the news of
the time follow the Historical Eras system (`engine/history.js`, `engine/eras.js`, docs/HISTORICAL_ERAS.md): fees,
wages and sales in the fame work are set in today's terms and reach the player in their era's money through it.

## Bands, genres and labels

`js/data/music.js` and `js/engine/music.js`.

- **Genres**: 39 of them, from blues and jazz to punk, metal, emo, grime, drill, K-pop and afrobeats, each from the year
  it began. Each has a usual line-up, wants something different (singing, playing, writing, presence: `genreFit`),
  is more or less popular worldwide and bigger in its heartlands, and goes in and out of fashion year by year (`heat`).
- **Positions**: vocalist, lead and rhythm guitar, bass, drums, keys, backing vocals, rapper, DJ and producer, sax,
  trumpet, violin, cello. How well the player plays one comes from the instrument they practice and their talent
  (`positionSkill`). Musicians in the world play one or two positions and love a few genres.
- **Bands looking for members**: each year there are notices from new bands and established ones (with their fans
  and their label) wanting a specific position. Three auditions a year; get in and you are in the band, in that
  position, alongside real people. Your own band can advertise for any position and choose from those who answer.
- **Labels**: two majors that sign anything, and independents that keep to a sound, chosen by what sells in that
  country (punk and metal labels in the UK, Latin labels in Mexico). Each has its own terms and a roster you can look
  through. Send demos (two a year); a label that is not into your sound will tell you.

## Agents

`js/engine/agents.js`. Every agent (talent agents at agencies, literary agents) is a person with their own
terms: a cut between 5% and 20% (leading agencies usually charge more, not always), their pull with the people
who hire (clout: it changes audition odds, offers, which publishers read a book and the advance), and a list of
clients who are real people in the world (actors with their credits, authors with their books; the biggest
names are with the leading agencies). Looking for an agent shows one at a time; you can sign, say no, or look
again, but only twice a year for each kind. Signing a new agent replaces the old one; work already signed keeps
the terms it was signed on (each contract and book records its agent's cut).

### Every kind of representative

The same rules hold for music managers (10–25%, `music.js`) and modeling
agencies' head bookers (15–25%, `modeling.js`), as well as talent and literary agents. Each has clients you can look
through (athletes with their ratings, acts with their fans, models with their covers), is shopped for one at a time
twice a year, and takes their cut of what they help earn: an athlete's or model's wage is paid after it, a manager
takes theirs from advances, royalties and tours. What they do for it: managers bring labels, bigger advances and bigger crowds; agencies get better castings.

Over time: any representative can be asked for a smaller cut once a year (a client worth it gets it; pushing without
the name can end it), can be let go, and lets go a client who stops working (two years without a job through a
talent agent, four without a book sold, a manager with nothing new in three years, an athlete who stops playing).
The best-connected representative brings brand deals, bigger ones, and takes their cut of those too.

## Also in the engines

- **Sport** is the one sports system (`engine/sports.js`, `engine/sportsLife.js`, tests in `tests/sports*.mjs`),
  shown in the fame screen's Sport tab and in full in Sport. What the separate fame sports engine used to do
  (leagues, circuits, the World Games, caps, women's leagues, coaching) is done there now. Lives saved with the old
  separate record keep it: seasons, titles, medals and caps come across when the save is loaded, and a player still
  playing is signed again in the same sport (soccer for football, track for athletics, martial arts for boxing).
- **Modeling**: each casting has a brief; how the model plays it (poised, energetic, warm, strange) changes the
  odds (`castingOdds`).
- **Books**: literary agents (15%, better reads and advances), translation deals, film options, and films made of
  the book (a real production with a cast to audition for), which send readers back to it.
- **Celebrity brands**: one product launch a year; hit, steady or flop, from the product and the owner's name.
- **Music**: music videos (from 1981), songs written for other acts with a writer's share, session work.

## Credits on other acts' records

`engine/music.js`. A session is credited on the act's next record, with what the player played there, and the
record's own credits list them (My Fame → Music → *Records you played on*). A song sold to an act can reappear on the
act's next EP or album (more than half the time, within three years): the album credits the player as a writer and
pays a writer's share of the whole record, by the song's share of its tracks.

## Not built yet

- Countries and borders are today's (see docs/HISTORICAL_ERAS.md for what the eras do and do not model).
- Sport: transfers between countries are for club team sports outside the draft leagues (baseball players from Japan
  and Korea are posted to the big leagues instead, `engine/asiaBaseball.js`); a coach runs one club's first team, not
  a national side; boxing has one sanctioning body.
