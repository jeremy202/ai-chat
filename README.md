# AI Concierge Assistant

Production-ready MVP for a niche SaaS platform that helps Canadian hotels, Airbnb hosts, and boutique hospitality businesses increase bookings with an AI-powered concierge assistant.

## Product thesis

The assistant is designed to:

- answer guest questions instantly
- recommend rooms and services using business-specific knowledge
- capture qualified leads and booking requests
- escalate to a human when needed
- show measurable ROI through chat, lead, and conversion analytics

## Tech stack

### Frontend

- Vue 3 + Composition API
- Vite
- Tailwind CSS v4
- Pinia + Vue Router

### Backend

- Node.js + Express + TypeScript
- REST API
- JWT authentication
- OpenAI API integration
- SMTP-compatible email notifications

### Data

- PostgreSQL
- Prisma ORM
- Multi-tenant schema
- Knowledge chunks with embeddings for RAG

## Monorepo structure

```text
.
├── apps
│   ├── api
│   │   ├── prisma
│   │   │   └── schema.prisma
│   │   ├── src
│   │   │   └── server.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web
│       ├── public
│       │   └── widget.js
│       ├── src
│       │   ├── components
│       │   │   ├── dashboard
│       │   │   └── widget
│       │   ├── pages
│       │   ├── services
│       │   ├── stores
│       │   ├── App.vue
│       │   ├── main.ts
│       │   ├── router.ts
│       │   └── style.css
│       ├── package.json
│       └── vite.config.ts
├── .env.example
└── package.json
```

## Full system architecture

### 1. Hosted business dashboard

The Vue dashboard is the control center for each tenant:

- signup/login
- business profile
- knowledge base uploads
- conversation monitoring
- booking request management
- analytics dashboard
- embed script generation

### 2. Embeddable website widget

Businesses place one script tag on their site:

```html
<script
  src="https://yourapp.com/widget.js"
  data-business-slug="northern-lights-boutique"
  data-position="bottom-right"
></script>
```

The script injects an iframe-based chat launcher that loads a hosted widget route:

```text
Customer website
  -> widget.js
     -> iframe to /widget/:businessSlug
        -> AI Concierge UI
           -> REST API /public/chat
```

This keeps business sites simple to set up in under 5 minutes.

### 3. Multi-tenant backend

Every request is scoped to a `businessId` either by JWT or by public business slug.

Core backend modules:

- Auth
- Business profile and embed configuration
- Knowledge base ingestion
- Retrieval + AI response orchestration
- Conversation and human handoff
- Booking capture
- Analytics aggregation
- Email notifications

### 4. Retrieval-Augmented Generation flow

```text
Admin uploads FAQ / room / pricing / policies
  -> split into chunks
  -> generate embeddings
  -> store in knowledge_base rows

Guest asks a question
  -> embed user query
  -> rank top knowledge chunks via cosine similarity
  -> inject only top relevant chunks into prompt
  -> ask model to answer only from approved knowledge
```

This reduces hallucinations and keeps responses aligned to the property.

### 5. Revenue-driving conversation flow

The AI is instructed to:

- greet and qualify the visitor
- identify booking intent, dates, party size, and preferences
- recommend relevant rooms/services
- capture name, email, and booking details
- trigger human handoff on uncertainty or high-value leads

## Database schema (PostgreSQL)

The Prisma schema is implemented in `apps/api/prisma/schema.prisma`.

### Tables

#### `businesses`

Each hospitality business/tenant.

Key fields:

- `id`
- `name`
- `slug`
- `type` (`hotel`, `airbnb_host`, `boutique_property`, `resort`, `other`)
- `contactEmail`
- `websiteUrl`
- `brandColor`
- `welcomeMessage`
- `aiTone`
- `timezone`
- `widgetEnabled`

#### `users`

Business operators/admins.

Relationship:

- many users belong to one business

Key fields:

- `email`
- `passwordHash`
- `role`
- `businessId`

#### `knowledge_base`

Chunks used for retrieval.

Key fields:

- `title`
- `category` (`faq`, `room`, `pricing`, `policy`, `amenity`, `local_info`, `other`)
- `content`
- `source`
- `embedding`
- `businessId`

#### `conversations`

Guest chat sessions.

Key fields:

- `channel` (`widget`, `dashboard`, `email`)
- `status` (`open`, `handoff_requested`, `human_active`, `closed`)
- `guestName`
- `guestEmail`
- `leadScore`
- `bookingIntent`
- `businessId`

#### `messages`

Messages within a conversation.

Key fields:

- `role` (`visitor`, `assistant`, `admin`, `system`)
- `content`
- `metadata`
- `conversationId`

#### `bookings`

Captured booking requests/leads.

Key fields:

- `status` (`new`, `qualified`, `contacted`, `won`, `lost`)
- `guestName`
- `guestEmail`
- `arrivalDate`
- `departureDate`
- `partySize`
- `budgetNote`
- `roomPreference`
- `source`
- `conversationId`
- `businessId`

#### `analytics`

Event-level metrics for reporting.

Key fields:

- `eventType`
- `eventValue`
- `metadata`
- `businessId`
- `conversationId`

### Relationships

```text
businesses 1---* users
businesses 1---* knowledge_base
businesses 1---* conversations
businesses 1---* bookings
businesses 1---* analytics
conversations 1---* messages
conversations 1---* bookings
```

## API endpoints

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Dashboard / business

- `GET /api/dashboard/summary`
- `GET /api/business/profile`
- `PATCH /api/business/profile`
- `GET /api/business/embed`

### Knowledge base

- `GET /api/knowledge-base`
- `POST /api/knowledge-base`

### Conversations / inbox

- `GET /api/conversations`
- `POST /api/conversations/:id/handoff`

### Bookings

- `GET /api/bookings`

### Public widget endpoints

- `GET /api/public/business/:slug`
- `POST /api/public/chat`

## Step-by-step implementation plan

### Phase 1: Foundation

1. Create monorepo with `apps/web` and `apps/api`
2. Configure TypeScript, build scripts, env handling, and lint/build workflows
3. Add PostgreSQL schema and Prisma client

### Phase 2: Multi-tenant core

1. Implement business/user models
2. Add JWT auth
3. Scope all tenant data through business ownership

### Phase 3: Revenue assistant engine

1. Build knowledge ingestion
2. Add embedding generation
3. Implement retrieval ranking
4. Add AI chat orchestration with booking intent detection
5. Persist messages, analytics, and booking requests

### Phase 4: Dashboard UX

1. Create hospitality-focused landing page
2. Add signup/login
3. Build dashboard tabs for setup, inbox, knowledge, bookings, analytics
4. Show embed instructions and ROI metrics

### Phase 5: Widget experience

1. Build hosted widget route
2. Add `widget.js` installer
3. Support mobile and desktop launcher positions

### Phase 6: Operations and deployment

1. Provision Postgres
2. Configure SMTP
3. Add production env variables
4. Deploy API and web
5. Add monitoring and rate limiting

## Code examples

### 1. AI chat handler (OpenAI integration)

From `apps/api/src/server.ts`:

```ts
const completion = await openai.responses.create({
  model: env.OPENAI_CHAT_MODEL,
  input: [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: `You are an AI concierge assistant for ${business.name}. Answer only using the approved business knowledge below. If the answer is unknown or policy-sensitive, say you will connect the guest to a human agent. Your goals are to increase qualified bookings, recommend relevant rooms/services, collect lead details, and stay warm, concise, and trustworthy for Canadian hospitality customers.\n\nApproved knowledge:\n${knowledgeContext}`,
        },
      ],
    },
    ...history.map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'input_text', text: message.content }],
    })),
    {
      role: 'user',
      content: [{ type: 'input_text', text: body.message }],
    },
  ],
});
```

### 2. Embedding + retrieval system

```ts
const embeddingResult = await openai.embeddings.create({
  model: env.OPENAI_EMBEDDING_MODEL,
  input: body.message,
});

const queryEmbedding = embeddingResult.data[0]?.embedding ?? [];

const knowledgeEntries = await prisma.knowledgeBaseEntry.findMany({
  where: { businessId: business.id },
  take: 50,
});

const rankedKnowledge = knowledgeEntries
  .map((entry) => ({
    entry,
    score: cosineSimilarity(queryEmbedding, normalizeEmbedding(entry.embedding)),
  }))
  .sort((left, right) => right.score - left.score)
  .slice(0, 4);
```

### 3. Chat widget script

From `apps/web/public/widget.js`:

```js
const iframe = document.createElement('iframe');
iframe.src = `${origin}/widget/${encodeURIComponent(slug)}`;
iframe.title = 'AI Concierge Assistant';
iframe.style.width = '380px';
iframe.style.height = '620px';
iframe.style.border = '0';
iframe.style.borderRadius = '20px';
iframe.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.28)';
iframe.style.display = 'none';
```

### 4. Booking capture logic

```ts
const extractedBooking = extractBookingSignals(body.message);

if (
  extractedBooking.guestName ||
  extractedBooking.guestEmail ||
  extractedBooking.arrivalDate ||
  extractedBooking.departureDate
) {
  await prisma.booking.upsert({
    where: {
      businessId_conversationId_guestEmail: {
        businessId: business.id,
        conversationId: conversation.id,
        guestEmail: extractedBooking.guestEmail || conversation.guestEmail || `guest-${conversation.id}@placeholder.local`,
      },
    },
    update: {
      guestName: extractedBooking.guestName || conversation.guestName || 'Guest',
      arrivalDate: extractedBooking.arrivalDate,
      departureDate: extractedBooking.departureDate,
      partySize: extractedBooking.partySize,
      roomPreference: extractedBooking.roomPreference,
      budgetNote: extractedBooking.budgetNote,
    },
    create: { ... }
  });
}
```

## Admin dashboard structure

### Overview

- monthly chats
- booking conversions
- active leads
- response speed/coverage messaging

### Setup

- copy/paste embed snippet
- onboarding checklist
- quick-start hospitality messaging

### Knowledge Base

- add FAQs, room details, pricing, policies
- control retrieval quality by category

### Inbox

- live conversation list
- handoff request markers
- visibility into visitor email, lead score, and booking intent

### Bookings

- booking request pipeline
- qualification notes
- date and room preference snapshots

### Architecture

- system blueprint
- database relationships
- API surface reference

## Deployment strategy

### MVP deployment

- **Frontend:** Vercel, Netlify, or Cloudflare Pages
- **Backend:** Render, Railway, Fly.io, or a container platform
- **Database:** Neon, Supabase Postgres, Railway Postgres, or managed Postgres
- **Email:** Postmark, Resend SMTP, SendGrid, or SES SMTP

### Recommended production topology

```text
Vite/Vue frontend CDN
  -> Express API service
     -> PostgreSQL
     -> OpenAI API
     -> SMTP provider
```

### Production hardening checklist

- secure env vars and key rotation
- HTTPS everywhere
- rate limiting on public chat endpoints
- audit logging for admin actions
- message retention rules
- retry logic for email delivery
- background jobs for heavy ingestion
- monitoring with Sentry / structured logs
- caching for high-traffic knowledge retrieval

## Local development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

Run separately if preferred:

```bash
npm run dev:web
npm run dev:api
```

## Notes on MVP vs scalability

### MVP choices

- single API service
- REST instead of microservices
- embeddings stored directly in PostgreSQL JSON
- iframe-based widget for easy installation
- lightweight analytics model

### Scalable evolution

- move embeddings to `pgvector`
- add queue workers for ingestion and email
- add WebSocket or SSE for live inbox updates
- add calendar/PMS integrations
- add Stripe billing and plan enforcement
- add role-based access and team inbox collaboration
