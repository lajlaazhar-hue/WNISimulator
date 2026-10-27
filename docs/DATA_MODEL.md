# Data model

Three layers are kept apart:

1. **Source data** (`src/data/*.js`): wages, prices, tariffs, fares, each with a status and a source id. Versioned by year in the ids (`ump-banten-2026`).
2. **Scenario assumptions** (`state.config`): the player's choices (city, housing, commute distance, appliance profile, price adjustment).
3. **Game state** (the rest of `state`): wallet, savings, bills, transactions, food, mood, work, documents, loans, notifications.

All money is an integer number of minor units. For IDR that is sen (1 rupiah = 100), because some decrees publish sen (UMP Banten 2026 is Rp3.100.881,40).

## Entities

### Country — `src/data/countries.js`
| Field | Notes |
|---|---|
| `id`, `name`, `flagCode` | ISO-style codes |
| `currency`, `locale` | `IDR`, `id-ID` |
| `wageSystem` | Plain-language description of how the wage floor is set |
| `dataStatus` | `loaded` or `not_loaded` |

### Region (province) — `src/data/indonesia.js` → `provinces`
`id`, `name`, `countryId`, `administrativeLevel: 'province'`, `wage` (a WageReference).

### City / regency — `src/data/indonesia.js` → `cities`
`id`, `provinceId` (= `parentRegionId`), `name`, `kind` (`kota`, `kab`, `kota_adm`), `administrativeLevel`, `tier` (rent model A–D), `transport` (profile), `bus` (name of a reported city bus, if any), `wage` (WageReference or `null` when no UMK is loaded).

### WageReference
| Field | Example |
|---|---|
| `id` | `umk-tangsel-2026` |
| `countryId`, `regionId`, `cityId` | `id`, `banten`, `tangsel` |
| `wageType` | `UMP` or `UMK` (UMSP/UMSK not modelled) |
| `amountMajor` | `'5247870'` (string, exactly as published) |
| `currency`, `period` | `IDR`, `month` |
| `effectiveFrom`, `effectiveTo` | `2026-01-01`, `2026-12-31` |
| `grossOrNet` | `gross` (published minimum wages are gross) |
| `sourceId` | key into the source registry |
| `verificationStatus` | `VERIFIED` |
| `note` | conflicts between sources, caveats |

`engine.resolveWage(cityId)` returns the applicable reference plus `amount` (minor units), `fallback` (true when the UMP stands in for a missing UMK) and `notes`.

### PriceObservation (catalog item) — `src/data/catalog.js`
| Field | Notes |
|---|---|
| `id`, `store`, `name` | `name` is `{ id, en }` |
| `tier` | `budget`, `standard`, `premium` |
| `size`, `unitQty`, `unitLabel` | package and the unit used for unit pricing (`g`, `ml`, `pcs`) |
| `price` | minor units |
| `status`, `sourceId`, `observed` | `observed` is the source's publication date for Verified items |
| `essential`, `origin` | `origin`: `local` or `imported` |
| `effects` | gameplay effects (portions, supply days, mood) |
| `dept`, `brand`, `need`, `appeal` | department, fictional brand, `basic`/`desire`, temptation weight |
| `food`, `supply`, `owned`, `mood`, `course`, `health`, `durability`, `functional` | what the item does once you have it |
| `requires` | `infant`, `child` or `school`: shown only when the household has one |

Region is implicit: catalog prices are national. `config.priceAdjustBp` shifts them for a locality and relabels Verified prices as Estimated.

### TransportOption — computed by `engine.transportModes` / `engine.commutePlans`
Each plan: `id`, `label`, `legs[]` (each `{ label, cost, status, sourceId }`), `perTrip`, `dailyExtra` (parking), `monthlyFixed` (vehicle upkeep, instalments), `available`, `reason`, `tags`. Availability comes from the city's `transport` profile. Fares that are not loaded are `cost: null`, status `UNAVAILABLE`, and the plan is unavailable until the player enters a fare.

### HousingOption — computed by `engine.housingOptions(cityId)`
`id` (`kost_typical`…), `type` (`family`, `shared`, `kost`, `petak`, `apartment`), `tier`, `label`, `monthlyRent`, `deposit`, `includes { electricity, water, internet }`, `furnished`, `bathroom`, `ac`, `status`, `sourceId`, `note`. Rent tables live in `RENT` in `engine/core.js`. With a household, each option also has `fits` and `capacity` (food storage).

### Expense (bill) — `state.bills[]`
`id` (`<month>-<key>`, unique), `key` (`rent`, `water`, `electricity`, `internet`, `family`, `jkn`, `motorcycle`, `arrears-*`), `label`, `category`, `amount`, `dueDay`, `month`, `mandatory`, `adjustable`, `status` (`pending`, `overdue`, `paid`), `autopay`, `paidDay`, `lateFee`, `arrears`, `carried`.

### Transaction — `state.transactions[]` (newest first)
`id`, `month` (game month index), `y`, `m`, `day`, `merchant`, `category`, `cls`, `amount` (signed minor units), `currency`, `status` (`completed`, `failed`), `balanceAfter`, `items[]`, `split`, `note`.

`cls` drives the report:

| `cls` | Meaning |
|---|---|
| `income`, `income_extra` | salary, overtime |
| `mandatory` | bill payments |
| `essential`, `discretionary`, `mixed` | everyday spending (`mixed` carries a `split`) |
| `unexpected` | event costs (`split` says essential or discretionary) |
| `upfront` | deposits, devices |
| `savings_in`, `savings_out` | transfers, never consumption |

## Game state (v4)

One canonical object; every app reads it. Text stored in state (labels, notifications, merchants) is bilingual `{ id, en }`.

```js
{
  version: 4, seed, config,                       // config = player choices
  date, startAbs, monthIndex, phase,              // 'play' | 'report'
  wallet, savings, goals[], transactions[], bills[], notifications[],
  eventsLog[], activeEvent, eventQueue[],
  // life
  mood: { happiness, stress, energy, boredom, loneliness, frustration, confidence,
          motivation, social, anxiety, temptation, wellbeing },   // 0–100
  moodLog[], health: { condition, severity, daysLeft, eased, cycleStart, cycleLen, history[] },
  appearance: { clothing, workwear, hygiene, grooming, skin, footwear, comfort },
  sleep: { hours, debt }, day: { slots, used, leave, weather, friendFree, sickNote },
  todayLog, activityLog[], urges[], distress, routineStreak,
  // food & supplies
  supplies: { water, soap, shampoo, toothpaste, toothbrush, laundry, dish, gasMeals, baby,
              pads, deodorant, tissue, repellent, homeclean, coffee, cleanser, moisturizer,
              sunscreen, serum, makeup, grooming },
  food: { batches[{ type, qty, unitValue, storage, opened, expiresAbs }], meals, nutritionDays[], waste[] },
  // shopping
  orders[], courses[], wishlist[], owned: { items, phoneCondition, raincoat, umbrella },
  // work
  job, employment: { status, since, lastDayAbs, reason, sp, leaveBalance, unpaidLeave,
                     contributionMonths, severance, history[] },
  perf: { days[], avg, weeks[] }, benefits: { jht, jhtClaimableAbs, jkp, jknUntilAbs },
  appy: { listings[], applications[], cv, portfolio, gigs[], englishPractice, saved[] },
  schedule[], pendingJob, economy,
  // money
  loans[{ lenderId, amount, received, totalRepay, cost, apr, schedule[], status }], credit, loanOffers[],
  // documents & travel
  docs: { items: { [docId]: { status, readyAbs, expiresAbs, score, visa } }, passport },
  trips[], trip,
  electricity, dataPlanUntil, homeInternet, pendingMove, subscriptions[],
  counters, reports[], lastReport, monthStart, seq
}
```

`config` adds to v0.1: `character { age, gender, menstruates, education, experienceYears, skills[], certs[], english, otherLang, digital }`, `household { partner, partnerWorks, partnerIncome, sharedIncome, partnerContribution, children[{ age }], childcare, supportParents }`, `ride { provider, tier }`, `startEmployed`, `startJobId`, `tenureMonths`, `startingSavings`, `passport { has, type, yearsLeft }`, `ownsFridge`, `ownsRiceCooker`, `ownsFan`, `groceryBudget`, `jknMandiri`.

Absolute days (`*Abs`) are UTC days since 1970 (`engine.dayNumber`). Random outcomes use `engine.rng(state, ...tags)`, seeded by the game seed, the day and the tags, so the same seed and choices give the same game.

### Transaction classes

| `cls` | Meaning | In the report |
|---|---|---|
| `income`, `income_household`, `income_extra`, `benefit`, `severance` | salary, partner, gigs/overtime, JHT/JKP, severance | income |
| `mandatory` | bill payments | consumption |
| `essential`, `discretionary`, `mixed` | everyday spending (`mixed` has a `split`) | consumption |
| `unexpected` | event costs (`split`) | consumption |
| `upfront` | deposits | one-off |
| `loan_in` | loan money received | not income |
| `loan_repay` | instalments (`split.principal`, `split.interest`) | principal: debt reduction; interest: finance cost |
| `refund` | parcel refunds, trip refunds (`split`) | nets off consumption |
| `savings_in`, `savings_out` | transfers | never consumption |

### Migration

`deserialize` accepts v4 directly and runs `migrateV3` on v0.1 saves. Migration builds a fresh v4 game from the old config, then copies the money, bills, transactions, goals, calendar and notifications. It converts the old pantry into food batches and maps `ojol_motor`/`ojol_car` to the new provider-based `ojol` plan. The UI also reads the old `rls-save-v3` key.

## Report formulas

- **Essential expense ratio** = (bills + everyday essentials + essential surprises) ÷ income
- **Discretionary ratio** = (optional spending + optional surprises) ÷ income
- **Savings rate** = (transfers in − withdrawals) ÷ income
- **Remaining income** = income − consumption − finance cost − upfront costs.
- **Identity** (tested): `walletEnd − walletStart = income + loanIn − consumption − financeCost − upfront − netSavings − principalRepaid`.

## Update workflow

There is no live data feed. Updating is a manual, reviewable change:

1. Find the new figure in an official or credible source.
2. Add the source to `sources.js` with its URL, publication date and today's date as `accessed`.
3. Change the value in the data file and point it at the source id.
4. `npm test` (catches Verified values without sources), `npm run sources` (refreshes `docs/SOURCES.md`), `npm run build`.
5. If wages or prices changed meaning (new year), bump `STATE_VERSION` in `engine/core.js` and add a migration.
