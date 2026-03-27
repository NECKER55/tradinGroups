# API Routes Checklist (based on SPECIFICHE.md)

Legend: `[x]` means the functionality is implemented in code.

## Auth
- [x] Register
- [x] Login
- [x] Refresh token
- [x] Logout
- [x] Current user profile (`/auth/me`)

## Users / Profile
- [x] Update username
- [x] Update email
- [x] Update `photo_url`
- [x] Change password

## Friendships
- [x] List friends and pending requests
- [x] Send friend request
- [x] Cancel sent request
- [x] Accept request
- [x] Reject request
- [x] Block user
- [x] Unblock user

## Groups
- [x] List my groups
- [x] List group members with role
- [x] Group profile info (name, photo, privacy, description)
- [x] Create group
- [x] Send invite (Admin/Owner)
- [x] Pending invites received
- [x] Accept invite
- [x] Reject invite
- [x] Cancel sent invite
- [x] Change member role (Owner only)
- [x] Remove member
- [x] Leave group
- [x] Update group name (owner/admin per policy)
- [x] Update group privacy (owner/admin per policy)
- [x] Update group photo
- [x] Update group description
- [x] Delete group
- [x] Update member budget (Admin/Owner)
- [x] Group ranking

## Trading / Orders / Portfolios
- [x] Private portfolio balance (GET)
- [x] Update private portfolio balance (PUT)
- [x] Create Buy/Sell order (POST)
- [x] Cancel pending order (DELETE)
- [x] Profile transaction history
- [x] Holdings by portfolio
- [x] Portfolio balance history

## Watchlist
- [x] List saved tickers
- [x] Add ticker
- [x] Remove ticker

## Search
- [x] Search stocks (ticker/company prefix)
- [x] Search users
- [x] Search groups

---

Quick notes:
- Registered routers: `auth`, `groups`, `trading` (see `src/routes/index.ts`).
- Main controllers in use include auth, groups, friendships, private balance, and trading orders.
