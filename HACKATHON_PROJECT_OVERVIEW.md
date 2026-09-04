# Hackathon Project Overview

## Project Name
Lab Readiness Management Portal

## What This Project Is About
Lab Readiness Management Portal is a web application that helps teams track workshop labs from request to readiness. It combines planning, execution, and risk visibility in one place so teams can identify delays early and act before workshop dates are impacted.

The solution includes:
- A React frontend for operations, managers, and testers
- A Node.js sync server that pulls data from CloudLabs APIs
- A local SQLite store for normalized, query-ready records

## Problem It Solves
Teams often track readiness across spreadsheets, emails, and manual follow-ups. This causes:
- Slow decision making
- Missed retest windows
- Late risk discovery
- Unclear ownership

## How This Project Fastens Work
This project speeds up operations by:
- Centralizing all lab and workshop readiness information in one portal
- Automatically classifying readiness and risk using defined business rules
- Showing near-term workshop risk windows (7/15/30 day views)
- Enabling role-based workflows (Admin, Tester, Manager)
- Reducing manual status chasing through notifications and sync status visibility

Expected impact:
- Faster triage and prioritization
- Fewer last-minute escalations
- Better tester throughput planning
- Higher on-time workshop readiness

## Key Features
- Executive dashboard with readiness and risk metrics
- Lab inventory with search, filters, and updates
- Upcoming workshops timeline and calendar views
- Tester workspace for assignment-based execution
- Retesting center for failed/outdated labs
- Reporting and analytics views
- Optional backend email alerting for near-deadline labs

## Architecture Summary
- Frontend: React + TypeScript + Vite + Tailwind + Recharts
- Backend: Node.js + Express + SQLite
- Data source: CloudLabs API (via periodic sync)
- Dev proxy: Frontend calls /api; Vite proxies to backend on port 3001

## Important Note for Engineering API Integration
For production-accurate results, the Engineering team must provide and maintain a valid CloudLabs API integration path (service credential or managed token flow).

If API credentials are missing, expired, or not integrated correctly:
- The UI can still load
- Live records from CloudLabs will not populate as expected
- Data may appear empty, stale, or incomplete

This is the most important dependency for reliable, real-time results.

## How to Run

### Prerequisites
- Node.js 18+ (Node 20 LTS recommended)
- npm

### Option A: Frontend Demo Mode (quickest)
Use this when presenting UI and workflows with seeded/local data.

1. From project root:
   - npm install
   - npm run dev
2. Open:
   - http://localhost:5173

### Option B: Full Stack Mode (frontend + backend sync)
Use this for API-driven data flow.

1. Install frontend dependencies (project root):
   - npm install
2. Install backend dependencies:
   - cd server
   - npm install
3. Create backend environment file:
   - Copy .env.example to .env in server folder
4. Set required values in .env:
   - CLOUDLABS_PARTNER_ID
   - CLOUDLABS_API_BASE
   - CLOUDLABS_ACCESS_TOKEN (or service credential flow)
5. Start backend:
   - npm run dev
6. In a second terminal, from project root start frontend:
   - npm run dev
7. Open frontend:
   - http://localhost:5173

## Validation Checklist After Startup
- Frontend opens at localhost:5173
- Backend health endpoint responds at /api/health
- Labs endpoint returns data at /api/labs
- Sync status endpoint returns latest run at /api/sync/status

## Common Issues and Fixes
- Error: vite is not recognized
  - Run npm install at project root
- Error: Cannot find package express
  - Run npm install in server folder
- Error: Missing required env var CLOUDLABS_PARTNER_ID
  - Add required values to server/.env
- API returns empty data
  - Refresh or replace CLOUDLABS_ACCESS_TOKEN
  - Verify partner ID and API base URL

## Hackathon Positioning
This project demonstrates a practical operations platform that can move from prototype to production with minimal architecture changes. It is strong for hackathon judging because it combines:
- Real business workflow value
- Measurable operational acceleration
- Scalable integration path with enterprise APIs
- Clear roadmap from demo mode to production-grade sync
