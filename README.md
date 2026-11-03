# HostelConnect — NSUT Dwarka

> Enterprise-Grade Next-Gen Hostel Management System tailored for Netaji Subhas University of Technology (NSUT), Sector 3, Dwarka, New Delhi.

---

## 1. Quick Start Guide

The three primary operational commands for HostelConnect:

### Command 1: Start
Start the MySQL 8.0 database, Express API, and Vite React client:
```bash
# Via Docker Compose:
docker compose up -d

# Or locally (with running native MySQL 8.0):
npm run start
```

### Command 2: Migrate
Run the migration runner (applies numbered `.sql` files in order and tracks them in `schema_migrations`) followed by the routine loader:
```bash
# Via Docker:
docker compose exec api npm run db:migrate && docker compose exec api npm run db:routines

# Or locally:
npm run db:migrate
npm run db:routines
```

### Command 3: Seed
Populate the database with initial baseline configuration (users, hostels, meal types, rooms, washing machines):
```bash
# Via Docker:
docker compose exec api npm run db:seed

# Or locally:
npm run db:seed
```

---

## 2. Testing & Verification

Run Vitest API and SQL assertion checks:
```bash
# Run all Vitest unit and API health tests
npm test

# Run SQL business rule assertion suite (fails if any violating rows return)
npm run test:sql
```

---

## 3. Architecture & Monorepo Structure

- `db/migrations/`: Numbered `.sql` schema migrations (`001_initial_schema.sql`).
- `db/routines/`: Idempotent stored procedures, functions, views, triggers, and events.
- `db/seed/`: Initial baseline configuration and synthetic student applicants.
- `server/`: Node 20 + Express + TypeScript (`mysql2/promise` with 100% parameterized queries, no ORM).
- `web/`: React 18/19 + Vite + TypeScript + Tailwind CSS (Neo-Brutalist design system, Cabinet Grotesk / Satoshi typography, high-contrast offset shadows, and 2px borders).
- `docs/`: Technical specifications (`SPEC.md`), design system (`DESIGN.md`), project proposal (`proposal.pdf`).
- `scripts/`: Migration runner (`migrate.ts`), routine loader (`routine-loader.ts`), seed runner (`seed.ts`), and SQL assertion runner (`sql-assertion-runner.ts`).
- `tests/`: Integration tests and declarative SQL assertion suite (`assertions.sql`).
