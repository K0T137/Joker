# Feature Ideas — derived from jok.ge competitor analysis

Source: https://app.jok.ge bundle analysis, 2026-05-15  
Reference files: `Joker/competitor/jok-ge/`

---

## TIER 1 — Core gameplay & retention (build first)

### 1. Player Profiles + Stats
- Persistent profile page per player
- Lifetime stats: games played, win rate, bid accuracy
- Game history log (`jokerGamesLog` in their GraphQL)
- Route: `/profile`, `/player-stats`

### 2. Ranked Games + Rating System
- Separate ranked queue (vs casual)
- ELO or point-based rating that persists
- Rating history chart (`/rating-history`)
- Leaderboard / top players page (`/top-players`)
- GraphQL: `viewerPlayerRanks`, `topPlayers`

### 3. Post-Game Results Page
- Dedicated results screen after each game ends
- Score breakdown, who bid what, who won
- Route: `/result/:roomRefId`

### 4. Passcode / Private Rooms
- Room creator sets a 4–6 digit code
- Friends join by entering the code
- GraphQL: `joinRoomByPasscode`

### 5. Card Themes
- Multiple card face designs: ORIGINAL, CUSTOM_GEORGIAN, CUSTOM_REBEL, OLD_SCHOOL
- Route: `/deck-preview/:theme` (preview before applying)
- `saveGameTheme` mutation persists per-user choice

---

## TIER 2 — Engagement & social

### 6. Tournament System
- Bracket/group tournaments, subscribe/unsubscribe
- Routes: `/tournaments`, `/tournament/:id`
- GraphQL: `tournament`, `tournamentGroup`, `subscribeTournament`, `leaveTournament`, `finishTournamentGroup`
- Tournament configs: `tournamentGroupConfigs`, `tournamentConfig`

### 7. Respect / Honor System
- Players can give "respect" after a game
- Tracks AFK rate per player (`afkRate` field on player)
- Modifiable by admin: `fixHonorRate`

### 8. In-Game Protest
- Player can flag a move as illegal / protest it
- `PROTEST_MESSAGE` constant — likely a chat or modal

### 9. AFK Detection + Kick
- Track consecutive missed turns
- Auto-kick after threshold (`kickedUserIds` tracked on room)
- `afkRate` accumulated on player profile

### 10. Friends / Followers
- Follow other players
- Filter by following: `filterFollowingUserIds`
- Route: `/friends`

### 11. Community Chat
- Global or lobby chat room
- Realtime: `REALTIME_CHAT_MESSAGE`, `REALTIME_CHAT_MESSAGE_COMMIT`
- Emotions/reactions: `sendChatEmotion`
- Route: `/community`

### 12. Block + Report
- `blockPlayer` / `unblockPlayer`
- `reportPlayers` — report abuse

### 13. Incognito Mode
- Hide online status / presence
- `setIncognitoMode` mutation

---

## TIER 3 — Monetization & economy

### 14. Virtual Token Economy
- In-app currency: TOKENS, TOKENS_PACK_X
- Purchase packs via Stripe: `createStripeCheckoutSession`, `processTokenPurchase`
- Spend on avatars, card themes, VIP

### 15. VIP Service
- Premium subscription tier
- Route: `/vip-service`
- Unlocks cosmetics, ranked access, etc.

### 16. Shop / Store
- Products by key: `/product/:productKey`
- `shopProducts`, `shopProduct`, `storeProducts` queries
- `verifyPurchase`, `processPurchase`

### 17. Rewarded Ads
- Watch ad → earn tokens
- `REWARDED_ADS_WATCHED` event

### 18. Gifts
- Send gifts to other players: `SEND_GIFT`
- Open gift boxes: `openGiftBox`, `giftPack`

### 19. Referral System
- Invite code / referral link
- `referralData` query

---

## TIER 4 — Cosmetics

### 20. Layered Avatar Builder
- Full character customization: skin, eyes, eyebrows, facial hair, hair, glasses, clothes, accessories, earrings, tattoos
- Avatar packs purchasable
- Routes: `/avatar/edit`, `/avatar/shop`, `/avatar-packs`
- GraphQL: `avatarLayers`, `saveAvatarConfig`, `markAvatarLayerUsed`

### 21. Special Status / Badge
- Equippable status on profile: `setActiveSpecialStatus`
- Likely crown / title / flair system

---

## TIER 5 — Quality of life

### 22. Interactive Tutorial
- Onboarding flow teaching game rules
- Route: `/tutorial`

### 23. Email Verification + Account Recovery
- `emailVerificationRequest`, `emailVerificationComplete`
- `checkUserEmail`, `setUserEmail`

### 24. Change Nickname
- `changeNickname` mutation, `validateNickname`
- Route: `/user/change-nick`

### 25. Push Notifications
- OneSignal integration
- `savePlayerPushToken`, `savePlayerNotificationConfig`
- `/push/onesignal/` endpoint

### 26. Music / Soundtrack
- In-game background music channels
- `musicChannels`, `favoriteMusicChannel`, `favoriteSong`
- `saveMusicChannel`, `saveSong`, `selectMusicChannelStream`

### 27. Multi-device Disconnect
- See active sessions, kick old ones
- Route: `/active-devices`
- `disconnectDevice` mutation

### 28. Strip Mode (game variant)
- Route: `/strip-mode` — unclear rules variant

### 29. Play in Pairs
- `PLAY_IN_PAIRS` constant — team-based variant

---

## Game Engine Resilience (separate doc: engine-fixes.md)

See `Joker/docs/engine-fixes.md` for what to borrow from their reconnect/AFK/state-machine patterns.
