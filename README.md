# StudioSpace Server

Express and MongoDB API for the StudioSpace creative workspace marketplace.

**Live API:** https://studiospace-server-mu.vercel.app
**Client repository:** https://github.com/taniatajin/studiospace-client
**Live site:** https://studiospace-client-ecru-tau.vercel.app

## Features
- Studios CRUD with owner-only update and delete
- Search, category filter, price filter, sort and limit on the studios endpoint
- Booking system with Pending, Confirmed, Completed and Cancelled statuses
- Double-booking prevention that checks time overlap against confirmed bookings
- Host booking management: confirm, complete or decline requests
- JWT in HTTPOnly cookies with 401 Unauthorized for protected routes
- Saved studios wishlist toggle

## Tech Stack
Node.js, Express.js, TypeScript, MongoDB, JSON Web Token

## API Overview
| Method | Endpoint | Access |
| --- | --- | --- |
| GET | /studios | Public (supports search, category, sort, limit) |
| GET | /studios/:id | Public |
| GET | /studios/my | Private |
| POST, PUT, DELETE | /studios, /studios/:id | Private (owner only for update and delete) |
| GET | /bookings/availability | Public |
| POST | /bookings | Private |
| GET | /bookings/my, /bookings/host | Private |
| PATCH | /bookings/:id/cancel, /bookings/:id/status | Private |
| GET, POST | /wishlist, /wishlist/:studioId | Private |

## Local Setup
1. Run `npm install`
2. Copy `.env.example` to `.env` and fill in your values
3. Run `npm run seed` to add sample studios
4. Run `npm run dev` (runs on port 5000)

## Environment Variables
`PORT`, `MONGODB_URI`, `DB_NAME`, `JWT_SECRET`, `CLIENT_URL`