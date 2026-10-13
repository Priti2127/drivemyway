# DriveMyWay 🚗

**Book a verified driver for your own car — on demand.**

DriveMyWay is a platform that connects car owners with verified professional drivers. Unlike ride-hailing apps (Uber, Ola), *you keep your car* — the driver comes to you.

---

## What problem does this solve?

- Tired after a long drive? Book a driver to take over.
- Elderly parent who owns a car but can't drive alone? Book remotely, track live.
- Post-event (late night, alcohol)? Get home safely in your own car.
- Need a professional driver for a corporate event? Done.

---

## Repository Structure

```
drivemyway/
├── backend/          # Node.js microservices (API)
│   ├── services/
│   │   ├── auth/
│   │   ├── booking/
│   │   ├── tracking/
│   │   ├── payment/
│   │   ├── notification/
│   │   └── driver-verification/
│   ├── shared/       # shared utils, middleware, types
│   └── gateway/      # API gateway config
├── apps/
│   ├── customer/     # React Native — customer-facing app
│   ├── driver/       # React Native — driver-facing app
│   └── family-tracker/ # React PWA — live trip tracking (no login needed)
├── docs/             # Architecture diagrams, ADRs
└── scripts/          # DB migrations, seed data, deployment scripts
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Apps | React Native (TypeScript) |
| Family Tracker | React + Vite (PWA) |
| Backend | Node.js + Express (microservices) |
| Database | PostgreSQL + Redis |
| Real-time | Socket.IO |
| Maps | Google Maps Platform |
| Payments | Razorpay |
| Auth | Firebase Phone OTP + JWT |
| Infra | AWS (ECS, RDS, ElastiCache, S3) |

---

## Getting Started

### Prerequisites
- Node.js >= 20
- PostgreSQL >= 15
- Redis >= 7
- React Native environment (Xcode / Android Studio)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/drivemyway.git
cd drivemyway

# Install all dependencies
npm run install:all

# Copy and fill environment variables
cp backend/services/auth/.env.example backend/services/auth/.env
# (repeat for each service)

# Run database migrations
npm run db:migrate

# Start all backend services (dev)
npm run dev:backend

# Start customer app (iOS)
cd apps/customer && npx react-native run-ios
```

---

## Core Features

- ⚡ **Instant + Scheduled booking** — book now or plan ahead
- 📍 **Live GPS tracking** — real-time map view for customer + family
- 🆘 **SOS button** — one-tap emergency alert to contacts + ops team
- ✅ **Driver KYC** — license, ID, and background check verified
- 📱 **Family tracking web link** — shared with relatives, no app download needed
- 💳 **UPI, card & wallet payments** — Razorpay powered
- 🛣️ **Route deviation alerts** — geofence-based safety monitoring

---

## Safety First

Safety is a first-class product requirement, not a feature:
- Real-time location shared with up to 3 emergency contacts
- Driver photo verification before every trip starts
- Route deviation alerts if driver goes off planned path
- SOS triggers SMS to contacts + ops team simultaneously
- Optional trip audio recording (encrypted, auto-deleted after 7 days)

---

## Contributing

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) spec.

```
feat: add driver location streaming
fix: handle booking cancellation edge case
docs: update API endpoint documentation
chore: upgrade razorpay sdk to v2.9
```

---

## License

MIT License — see [LICENSE](./LICENSE) file.

---

*Built with ❤️ for safer roads.*
