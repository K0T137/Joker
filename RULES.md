# Joker — ჯოკერი — Game Rules

Joker is a 4-player trick-taking card game from Georgia. Players bid on how many tricks they will take each round, then play to hit their bid exactly. Precision matters more than winning tricks.

---

## The Deck

**36 cards total:**

| Component | Cards |
|-----------|-------|
| Standard ranks (7–A) × 4 suits | 32 |
| 6♥ and 6♦ (only these two 6s) | 2 |
| Jokers | 2 |
| **Total** | **36** |

Note: 6♠ and 6♣ are not included.

**Rank order** (low → high): 6 · 7 · 8 · 9 · 10 · J · Q · K · A

Jokers have no rank or suit of their own — their behaviour is determined by how they are played.

---

## Game Structure

A full game consists of **4 pulkas**, **24 rounds total**.

| Pulka | Rounds | Cards dealt per player |
|-------|--------|------------------------|
| 1 | 8 | 1, 2, 3, 4, 5, 6, 7, 8 (ascending) |
| 2 | 4 | 9, 9, 9, 9 |
| 3 | 8 | 8, 7, 6, 5, 4, 3, 2, 1 (descending) |
| 4 | 4 | 9, 9, 9, 9 |

**Dealer** rotates clockwise after every round. The player immediately left of the dealer leads the first trick and (in 9-card rounds) chooses trump.

---

## Dealing & Trump

### Normal rounds (1–8 cards)

1. Dealer shuffles and deals the specified number of cards to each player.
2. The **top card of the remaining deck** is turned face-up — its suit is **trump**.
3. If the top card is a Joker, the round is played with **No Trump**.

### 9-card rounds

1. Dealer deals **3 cards** to each player.
2. The player **immediately left of the dealer** (the trump selector) looks at their 3 cards and **freely chooses trump** (any suit or No Trump).
3. Everyone receives their remaining **6 cards**, then bidding begins.

---

## Bidding

Starting from the player left of the dealer and going clockwise, each player bids how many tricks they expect to take this round.

**Valid bids:** 0 through the number of cards in the round.

**Restriction:** The last bidder (the dealer) **cannot** bid an amount that would make the total of all bids equal the number of tricks available. The total must be either over or under — a perfectly balanced table is forbidden.

Once all bids are placed, the game announces whether the table is **Shetenva** (total bids < tricks available) or **Tsaglejva** (total bids > tricks available).

---

## Playing Tricks

The player left of the dealer leads the first trick. Thereafter, the **winner of each trick leads the next**.

### Follow-suit rules

- Players **must follow** the led suit if they have it.
- If unable to follow suit, players **must play trump** if they have any.
- Only if a player has neither the led suit nor any trump may they play any card.

### Winning a trick

The trick is won by the **highest trump played**, or if no trump was played, by the **highest card of the led suit**.

---

## The Joker

The two Jokers are the most powerful cards. A Joker can be played at any time — it is never subject to follow-suit restrictions. When you play a Joker, you declare a mode.

---

### When the Joker is led (played first in the trick)

#### TAKE mode — Demands the highest of a suit

- Declare a suit.
- **Every player who holds any card of the declared suit must play their highest card of that suit.**
- The Joker wins the trick.
- **Exception:** if the declared suit is not trump and a player has none of it and plays trump instead, the highest trump wins.
- If a subsequent player also plays a HIGH or TAKE Joker, the last such Joker wins.

#### GIVE mode — Joker pretends to be the lowest

- Declare a suit.
- The Joker acts as the lowest card of that suit — it **intentionally loses**.
- Players must follow the declared suit normally if they have it.
- Only cards of the declared suit, any trump, or another HIGH Joker can win the trick; the winner among those is the highest by normal rank rules.

---

### When the Joker is played after the first card (2nd, 3rd, or 4th)

#### HIGH mode — Wins the trick

- The Joker **always wins** the trick, regardless of what was played before or after — unless another Joker is played as HIGH after it.
- No suit is declared; no special obligation is placed on remaining players.

#### LOW mode — Loses the trick

- The Joker **always loses** — guaranteed not to win.
- Useful for discarding without taking a trick.

---

### Joker conflicts (multiple Jokers in one trick)

| Situation | Result |
|-----------|--------|
| Two or more HIGH/TAKE Jokers | The **last** HIGH/TAKE Joker played wins |
| LOW Joker vs. any other card | LOW Joker always loses |

---

## Scoring

Scores are calculated at the **end of each round**.

| Bid | Tricks Taken | Score |
|-----|-------------|-------|
| 0 | 0 | **+50** |
| n | n (exact, did not take all tricks) | **+50 + n×50** |
| n | n (exact, took every trick in the round) | **+n×100** |
| n > 0 | 0 (Hisht — took nothing) | **−hisht penalty** |
| n | k, where 0 < k < n (partial) | **+k×10** |

> **Hisht** (ჰიშტი): bidding any positive number of tricks but winning zero. The penalty is configurable per room and depends on the game mode:
> - **Classic mode:** −200 · −500 · −200/−500 alternating by pulka · ×100 dynamic (penalty = cards in round × 100)
> - **Only9 mode:** −200 · −300 · −500 · −900
>
> Default is −200.

**Examples (default −200 hisht):**

| Round | Bid | Taken | Score |
|-------|-----|-------|-------|
| 3-card | 2 | 2 | +50 + 2×50 = **+150** |
| 9-card | 9 | 9 (all tricks) | 9×100 = **+900** |
| 5-card | 3 | 1 | 1×10 = **+10** |
| 4-card | 2 | 0 | **−200** (Hisht) |
| 6-card | 0 | 0 | **+50** |

---

## Pulka Bonus (Premia)

At the end of each pulka, a bonus/penalty is applied to players based on bid accuracy.

A player is **on premia** if they hit their bid exactly in **every round** of the pulka.

- **Premia winners** always receive **+own best single-round score** as a bonus.
- **Non-premia players** receive **−own best single-round score** as a penalty (when *Deductions* is enabled — the default).

**Special cases (configurable):**
- **Deductions off** — no penalties to non-premia players; premia winners still earn their bonus.
- **Multi-premia deduction** — if 2 or more players simultaneously reach premia, non-premia players are still penalised. Off by default (normally 2+ premia = no deductions).
- **Last bid untouchable** — the last round's score is excluded from the maxRound calculation used for bonuses/penalties. On by default.

**In Pairs mode:**
- Premia is assessed individually (each player must be exact every round).
- If your partner is on premia, you are **exempt** from the deduction.
- If players from **different teams** are simultaneously on premia, deductions cancel out for everyone.

The premia system can swing the game significantly — a player who scored +900 in one round stands to gain or lose that amount at the pulka end.

---

## Game End

After all 4 pulkas the game ends. The player with the **highest cumulative total** wins.

---

## Room Settings

The room host can configure the following options at room creation:

### Game Mode

| Mode | Description |
|------|-------------|
| **Classic** | Full 24-round game: pulkas 1 & 3 are ascending/descending 1–8 card rounds; pulkas 2 & 4 are four 9-card rounds each |
| **Only 9** | All rounds use 9 cards (trump-selection rounds only) — shorter, higher-variance games |

### Hisht Penalty

Configurable per mode (see Scoring section above for values).

### Play in Pairs

P1+P3 form one team, P2+P4 form the other. Final scores are merged: P3's total is added to P1's, P4's to P2's. Premia and deductions apply team-aware logic (see Pulka Bonus section).

### Deductions

Controls whether non-premia players are penalised at pulka end. On by default. Sub-options:
- **Multi-premia deduction** — penalise others even when 2+ players are simultaneously on premia.
- **Last bid untouchable** — exclude the last round's score from the bonus/penalty calculation.

---

## Quick Reference

| Term | Georgian | Meaning |
|------|----------|---------|
| Pulka | პულკა | One of the four blocks of rounds |
| Hisht | ჰიშტი | Bid > 0 but won 0 tricks — penalty configurable per room (−100 to −1000, default −200) |
| Atuzovka | ათუზოვკა | Dealer-determination draw at game start |
| Shetenva | შეტენვა | Total bids under tricks available |
| Tsaglejva | ცაგლეჯვა | Total bids over tricks available |
| Trump selector | — | Player left of dealer in 9-card rounds who chooses trump |
