import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import multer from "multer";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import {
  AnalyticsEventType,
  BookingStatus,
  ConversationStatus,
  LeadStatus,
  MessageRole,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import pg from "pg";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  XAI_API_KEY: z.string().optional(),
  XAI_BASE_URL: z.string().url().default("https://api.x.ai/v1"),
  XAI_MODEL: z.string().default("grok-3-mini"),
  XAI_EMBEDDING_MODEL: z.string().default("grok-embedding-1"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("AI Concierge <noreply@aiconciergeassistant.com>"),
  WEB_APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:4000"),
});

export const env = envSchema.parse(process.env);

const firebaseAdminEnabled = Boolean(
  env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY,
);

if (firebaseAdminEnabled && getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  __aiConciergePool?: pg.Pool;
  __aiConciergePrisma?: PrismaClient;
};

const pool =
  globalForPrisma.__aiConciergePool ??
  new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 5,
  });

const prisma =
  globalForPrisma.__aiConciergePrisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__aiConciergePool = pool;
  globalForPrisma.__aiConciergePrisma = prisma;
}

export const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const chatClient = env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: env.GROQ_BASE_URL,
    })
  : env.XAI_API_KEY
  ? new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: env.XAI_BASE_URL,
    })
  : env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;
const embeddingClient = env.XAI_API_KEY
  ? new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: env.XAI_BASE_URL,
    })
  : env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : null;
const aiProvider = env.GROQ_API_KEY
  ? "groq"
  : env.XAI_API_KEY
    ? "xai-grok"
    : env.OPENAI_API_KEY
      ? "openai"
      : "fallback-local";
const transporter =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      })
    : null;

type AuthToken = {
  userId: string;
  businessId: string;
  role: UserRole;
};

type BookingSignals = {
  guestName?: string;
  email?: string;
  phone?: string;
  arrivalDate?: Date;
  departureDate?: Date;
  guests?: number;
  roomType?: string;
  estimatedValue?: number;
};

type RetrievedSnippet = {
  id: string;
  content: string;
  score: number;
};

type RegionalSettings = {
  businessId: string;
  defaultLanguage: "en-CA" | "fr-CA";
  additionalLanguages: string[];
  province: string;
  timezone: string;
  currency: "CAD";
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthToken;
    }
  }
}

const asyncHandler =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthToken;
    req.auth = payload;
    next();
  } catch {
    if (!firebaseAdminEnabled) {
      res.status(401).json({ error: "Invalid token." });
      return;
    }

    try {
      const decoded = await verifyFirebaseIdToken(token);
      const email = decoded.email?.toLowerCase();

      if (!email) {
        res.status(401).json({ error: "Firebase token is missing email." });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        res.status(401).json({ error: "No workspace is linked to this Firebase account." });
        return;
      }

      req.auth = {
        userId: user.id,
        businessId: user.businessId,
        role: user.role,
      };
      next();
    } catch {
      res.status(401).json({ error: "Invalid token." });
    }
  }
});

const signupSchema = z.object({
  businessName: z.string().min(2),
  businessEmail: z.string().email(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const firebaseSignupSchema = z.object({
  idToken: z.string().min(1),
  businessName: z.string().min(2),
  businessEmail: z.string().email(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  name: z.string().min(2),
});

const firebaseLoginSchema = z.object({
  idToken: z.string().min(1),
});

const widgetMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  visitorName: z.string().optional(),
  visitorEmail: z.string().email().optional().or(z.literal("")),
});

const adminReplySchema = z.object({
  content: z.string().min(1),
});

const supportReplySchema = z.object({
  customerMessage: z.string().min(1),
  channel: z.string().default("WEB_CHAT"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
});

const createShiftSchema = z.object({
  teamMember: z.string().min(2),
  role: z.string().min(2),
  start: z.string().datetime(),
  end: z.string().datetime(),
  notes: z.string().optional(),
});

const createAutomationSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["INVOICE_REMINDER", "INVENTORY_CHECK", "FOLLOW_UP", "OTHER"]),
  schedule: z.enum(["DAILY", "WEEKLY", "MONTHLY", "MANUAL"]),
  enabled: z.boolean().default(true),
});

const internalAssistantSchema = z.object({
  question: z.string().min(1),
  context: z.string().default("INTERNAL"),
});

const regionalSettingsSchema = z.object({
  defaultLanguage: z.enum(["en-CA", "fr-CA"]),
  additionalLanguages: z.array(z.string()).default([]),
  province: z.string().min(2),
  timezone: z.string().min(2),
  currency: z.literal("CAD").default("CAD"),
});

const takeoverSchema = z.object({
  enabled: z.boolean(),
});

const settingsSchema = z.object({
  brandColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
  welcomeMessage: z.string().min(10),
  websiteUrl: z.string().url().optional().or(z.literal("")),
});

const knowledgeSchema = z.object({
  title: z.string().min(2),
  sourceType: z.enum(["FAQ", "ROOM", "POLICY", "PRICING", "SERVICE", "FILE"]),
  content: z.string().optional(),
});

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const HANDOFF_MESSAGE =
  "A team member has been notified and will continue the conversation shortly.";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function uniqueBusinessSlug(name: string) {
  const base = slugify(name) || "hospitality";
  let attempt = base;
  let counter = 1;

  while (await prisma.business.findUnique({ where: { slug: attempt } })) {
    counter += 1;
    attempt = `${base}-${counter}`;
  }

  return attempt;
}

function signToken(user: AuthToken) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });
}

async function verifyFirebaseIdToken(idToken: string) {
  if (!firebaseAdminEnabled) {
    throw new Error("Firebase Admin SDK is not configured.");
  }

  return getAuth().verifyIdToken(idToken);
}

function toEmbeddingArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry));
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function fallbackEmbedding(input: string) {
  const dimensions = 64;
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    let hash = 0;

    for (const character of token) {
      hash = (hash * 31 + character.charCodeAt(0)) % dimensions;
    }

    vector[Math.abs(hash)] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function toPrismaJsonEntry(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => toPrismaJsonEntry(entry)) as Prisma.InputJsonArray;
  }

  if (typeof value === "object") {
    return toPrismaJsonObject(value as Record<string, unknown>);
  }

  return String(value);
}

function toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      entry === undefined ? [] : [[key, toPrismaJsonEntry(entry)]],
    ),
  ) as Prisma.InputJsonObject;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function embedText(text: string) {
  if (!embeddingClient) {
    return fallbackEmbedding(text);
  }

  try {
    const response = await embeddingClient.embeddings.create({
      model: env.XAI_API_KEY ? env.XAI_EMBEDDING_MODEL : env.OPENAI_EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0]?.embedding ?? fallbackEmbedding(text);
  } catch {
    return fallbackEmbedding(text);
  }
}

function chunkText(content: string, maxLength = 600, overlap = 120) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const slice = normalized.slice(cursor, cursor + maxLength);
    const boundary = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
    const end = boundary > maxLength * 0.55 ? cursor + boundary + 1 : cursor + slice.length;
    const chunk = normalized.slice(cursor, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

function detectIntent(message: string) {
  const normalized = message.toLowerCase();

  if (/(book|reserve|availability|available|check-in|check out|dates|stay|night)/.test(normalized)) {
    return "booking_request";
  }

  if (/(price|pricing|rate|cost|discount)/.test(normalized)) {
    return "pricing_question";
  }

  return "inquiry";
}

function extractBookingSignals(message: string): BookingSignals {
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0];
  const phoneMatch =
    message.match(/(?:\+?1[-. ]?)?(?:\(?\d{3}\)?[-. ]?)?\d{3}[-. ]?\d{4}/)?.[0];
  const dates = message.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  const guestsMatch = message.match(/(\d+)\s+(?:guest|guests|people|travellers|travelers)/i);
  const nameMatch = message.match(/(?:my name is|i am|this is)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)/i);
  const roomMatch = message.match(/\b(suite|king room|queen room|double room|loft|studio)\b/i);
  const valueMatch = message.match(/\$?(\d{2,5})(?:\s*(?:cad|canadian|per night|nightly))?/i);

  return {
    guestName: nameMatch?.[1]
      ?.split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    email: emailMatch,
    phone: phoneMatch,
    arrivalDate: dates[0] ? new Date(`${dates[0]}T00:00:00.000Z`) : undefined,
    departureDate: dates[1] ? new Date(`${dates[1]}T00:00:00.000Z`) : undefined,
    guests: guestsMatch ? Number(guestsMatch[1]) : undefined,
    roomType: roomMatch?.[1],
    estimatedValue: valueMatch ? Number(valueMatch[1]) : undefined,
  };
}

function hasLeadSignal(message: string, signals: BookingSignals) {
  const intent = detectIntent(message);
  const hasContact = Boolean(signals.email || signals.phone);
  const hasStayDetails = Boolean(signals.arrivalDate || signals.departureDate || signals.guests);
  return intent === "booking_request" && (hasContact || hasStayDetails);
}

async function retrieveKnowledge(businessId: string, query: string) {
  const queryEmbedding = await embedText(query);
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { businessId },
    select: {
      id: true,
      content: true,
      embedding: true,
    },
  });

  const ranked = chunks
    .map<RetrievedSnippet>((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, toEmbeddingArray(chunk.embedding)),
    }))
    .sort((left, right) => right.score - left.score)
    .filter((chunk) => chunk.score > 0.12)
    .slice(0, 6);

  return ranked;
}

function buildFallbackReply(
  businessName: string,
  snippets: RetrievedSnippet[],
  intent: string,
  handoffPrompt = true,
) {
  if (snippets.length === 0) {
    return `I do not see that detail in ${businessName}'s knowledge base yet. I can still help collect your dates, guest count, and email so the team can follow up quickly.`;
  }

  const summary = snippets
    .slice(0, 3)
    .map((snippet) => `- ${snippet.content}`)
    .join("\n");

  const cta =
    intent === "booking_request" || handoffPrompt
      ? "\n\nIf you want, I can also capture your stay details and pass them to the team as a booking request."
      : "";

  return `Here is what I found from the property's knowledge base:\n${summary}${cta}`;
}

async function generateReply(options: {
  businessName: string;
  businessEmail: string;
  welcomeMessage: string;
  userMessage: string;
  history: Array<{ role: MessageRole; content: string }>;
  snippets: RetrievedSnippet[];
}) {
  const intent = detectIntent(options.userMessage);

  if (!chatClient) {
    return buildFallbackReply(options.businessName, options.snippets, intent);
  }

  const knowledgeBlock = options.snippets.length
    ? options.snippets.map((snippet, index) => `[${index + 1}] ${snippet.content}`).join("\n")
    : "No relevant snippets were found.";

  try {
    const completion = await chatClient.chat.completions.create({
      model: env.GROQ_API_KEY ? env.GROQ_MODEL : env.XAI_API_KEY ? env.XAI_MODEL : env.OPENAI_MODEL,
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: [
            `You are an AI concierge for ${options.businessName}, a Canadian hospitality business.`,
            "Only answer with information grounded in the provided knowledge snippets.",
            "If the knowledge base does not contain the answer, say so clearly and offer to capture the guest's dates, email, and preferences for a human follow-up.",
            "Your goal is to increase bookings, qualify leads, and sound polished and trustworthy.",
            `Business support email: ${options.businessEmail}.`,
            `Default welcome message: ${options.welcomeMessage}`,
          ].join("\n"),
        },
        ...options.history.slice(-8).map((message) => ({
          role: message.role === MessageRole.USER ? ("user" as const) : ("assistant" as const),
          content: message.content,
        })),
        {
          role: "user",
          content: [
            `Knowledge snippets:\n${knowledgeBlock}`,
            `Visitor message:\n${options.userMessage}`,
            `Detected intent: ${intent}`,
            "Respond in a concise, premium, conversion-friendly tone. Mention uncertainty when the answer is not covered by the snippets.",
          ].join("\n\n"),
        },
      ],
    });

    return (
      completion.choices[0]?.message?.content?.trim() ??
      buildFallbackReply(options.businessName, options.snippets, intent)
    );
  } catch {
    return buildFallbackReply(options.businessName, options.snippets, intent);
  }
}

async function sendNotificationEmail(options: {
  businessName: string;
  to: string;
  subject: string;
  html: string;
}) {
  if (!transporter) {
    console.info(`[email preview] ${options.subject}`);
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

async function trackEvent(
  businessId: string,
  type: AnalyticsEventType,
  conversationId?: string,
  payload?: Record<string, unknown>,
) {
  await prisma.analyticsEvent.create({
    data: {
      businessId,
      type,
      conversationId,
      payload: payload ? toPrismaJsonObject(payload) : undefined,
    },
  });
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalhostUrl(value: string) {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(stripTrailingSlash(value));
}

function resolveWidgetSnippetUrls(req: Request) {
  const requestOrigin = req.get("origin");
  const fallbackOrigin = req.get("x-forwarded-proto") && req.get("x-forwarded-host")
    ? `${req.get("x-forwarded-proto")}://${req.get("x-forwarded-host")}`
    : req.protocol && req.get("host")
      ? `${req.protocol}://${req.get("host")}`
      : undefined;

  const preferredOrigin = requestOrigin ?? fallbackOrigin;
  const useRequestOrigin = preferredOrigin ? !isLocalhostUrl(preferredOrigin) : false;

  const appBaseUrl = useRequestOrigin
    ? stripTrailingSlash(preferredOrigin!)
    : stripTrailingSlash(env.WEB_APP_URL);

  const apiBaseUrl = isLocalhostUrl(env.API_URL)
    ? `${appBaseUrl}/api`
    : stripTrailingSlash(env.API_URL);

  return { appBaseUrl, apiBaseUrl };
}

function formatWidgetSnippet(slug: string, urls: { appBaseUrl: string; apiBaseUrl: string }) {
  return `<script src="${urls.appBaseUrl}/widget.js" data-business="${slug}" data-host="${urls.appBaseUrl}" data-api="${urls.apiBaseUrl}"></script>`;
}

async function getRegionalSettingsForBusiness(businessId: string): Promise<RegionalSettings> {
  const existing = await prisma.regionalSettings.findUnique({
    where: { businessId },
  });

  if (existing) {
    return {
      businessId: existing.businessId,
      defaultLanguage: existing.defaultLanguage as RegionalSettings["defaultLanguage"],
      additionalLanguages: Array.isArray(existing.additionalLanguages)
        ? existing.additionalLanguages.map((item) => String(item))
        : ["fr-CA"],
      province: existing.province,
      timezone: existing.timezone,
      currency: existing.currency as "CAD",
    };
  }

  const created = await prisma.regionalSettings.create({
    data: {
      businessId,
      defaultLanguage: "en-CA",
      additionalLanguages: ["fr-CA"],
      province: "ON",
      timezone: "America/Toronto",
      currency: "CAD",
    },
  });

  return {
    businessId: created.businessId,
    defaultLanguage: created.defaultLanguage as RegionalSettings["defaultLanguage"],
    additionalLanguages: Array.isArray(created.additionalLanguages)
      ? created.additionalLanguages.map((item) => String(item))
      : ["fr-CA"],
    province: created.province,
    timezone: created.timezone,
    currency: created.currency as "CAD",
  };
}

async function maybeUpsertBooking(options: {
  businessId: string;
  businessName: string;
  businessEmail: string;
  conversationId: string;
  existingLeadStatus: LeadStatus;
  message: string;
  signals: BookingSignals;
}) {
  if (!hasLeadSignal(options.message, options.signals)) {
    return null;
  }

  const existing = await prisma.booking.findFirst({
    where: { conversationId: options.conversationId },
    orderBy: { createdAt: "desc" },
  });

  const bookingData = {
    guestName: options.signals.guestName,
    email: options.signals.email,
    phone: options.signals.phone,
    arrivalDate: options.signals.arrivalDate,
    departureDate: options.signals.departureDate,
    guests: options.signals.guests,
    roomType: options.signals.roomType,
    notes: options.message,
    estimatedValue: options.signals.estimatedValue,
    status: BookingStatus.NEW,
  };

  const booking = existing
    ? await prisma.booking.update({
        where: { id: existing.id },
        data: bookingData,
      })
    : await prisma.booking.create({
        data: {
          businessId: options.businessId,
          conversationId: options.conversationId,
          ...bookingData,
        },
      });

  const nextLeadStatus =
    options.signals.arrivalDate || options.signals.departureDate
      ? LeadStatus.BOOKING_REQUESTED
      : LeadStatus.QUALIFIED;

  await prisma.conversation.update({
    where: { id: options.conversationId },
    data: {
      leadStatus: nextLeadStatus,
      visitorName: options.signals.guestName,
      visitorEmail: options.signals.email,
      visitorPhone: options.signals.phone,
    },
  });

  await trackEvent(
    options.businessId,
    nextLeadStatus === LeadStatus.BOOKING_REQUESTED
      ? AnalyticsEventType.BOOKING_REQUESTED
      : AnalyticsEventType.LEAD_CAPTURED,
    options.conversationId,
    {
      email: options.signals.email,
      arrivalDate: options.signals.arrivalDate?.toISOString(),
      departureDate: options.signals.departureDate?.toISOString(),
      guests: options.signals.guests,
    },
  );

  if (!existing || options.existingLeadStatus === LeadStatus.NEW) {
    await sendNotificationEmail({
      businessName: options.businessName,
      to: options.businessEmail,
      subject: `New lead for ${options.businessName}`,
      html: `
        <h2>New AI Concierge lead</h2>
        <p><strong>Guest:</strong> ${options.signals.guestName ?? "Unknown"}</p>
        <p><strong>Email:</strong> ${options.signals.email ?? "Not provided"}</p>
        <p><strong>Phone:</strong> ${options.signals.phone ?? "Not provided"}</p>
        <p><strong>Arrival:</strong> ${options.signals.arrivalDate?.toISOString().slice(0, 10) ?? "Not provided"}</p>
        <p><strong>Departure:</strong> ${options.signals.departureDate?.toISOString().slice(0, 10) ?? "Not provided"}</p>
        <p><strong>Guests:</strong> ${options.signals.guests ?? "Not provided"}</p>
        <p><strong>Message:</strong> ${options.message}</p>
      `,
    });
  }

  return booking;
}

async function readKnowledgeContent(
  body: z.infer<typeof knowledgeSchema>,
  file?: Express.Multer.File,
) {
  if (file) {
    return file.buffer.toString("utf-8");
  }

  return body.content?.trim() ?? "";
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-concierge-api",
    aiProvider,
    embeddingProvider: embeddingClient ? (env.XAI_API_KEY ? "xai-grok" : "openai") : "fallback-local",
  });
});

app.post(
  "/api/auth/firebase/signup",
  asyncHandler(async (req, res) => {
    const payload = firebaseSignupSchema.parse(req.body);
    const decoded = await verifyFirebaseIdToken(payload.idToken);
    const email = decoded.email?.toLowerCase();

    if (!email) {
      res.status(400).json({ error: "Firebase account is missing an email." });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ error: "An account already exists for this Firebase email." });
      return;
    }

    const passwordHash = await bcrypt.hash(decoded.uid, 10);
    const slug = await uniqueBusinessSlug(payload.businessName);
    const business = await prisma.business.create({
      data: {
        name: payload.businessName,
        slug,
        email: payload.businessEmail.toLowerCase(),
        websiteUrl: payload.websiteUrl || null,
        users: {
          create: {
            name: payload.name,
            email,
            passwordHash,
            role: UserRole.OWNER,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = business.users[0];
    const token = signToken({
      userId: user.id,
      businessId: business.id,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        websiteUrl: business.websiteUrl,
        brandColor: business.brandColor,
        welcomeMessage: business.welcomeMessage,
      },
    });
  }),
);

app.post(
  "/api/auth/firebase/login",
  asyncHandler(async (req, res) => {
    const payload = firebaseLoginSchema.parse(req.body);
    const decoded = await verifyFirebaseIdToken(payload.idToken);
    const email = decoded.email?.toLowerCase();

    if (!email) {
      res.status(400).json({ error: "Firebase account is missing an email." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!user) {
      res.status(404).json({ error: "No workspace found for this Firebase account. Please sign up first." });
      return;
    }

    const token = signToken({
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        slug: user.business.slug,
        email: user.business.email,
        websiteUrl: user.business.websiteUrl,
        brandColor: user.business.brandColor,
        welcomeMessage: user.business.welcomeMessage,
      },
    });
  }),
);

app.post(
  "/api/auth/signup",
  asyncHandler(async (req, res) => {
    const payload = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (existingUser) {
      res.status(409).json({ error: "An account already exists for this email." });
      return;
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const slug = await uniqueBusinessSlug(payload.businessName);
    const business = await prisma.business.create({
      data: {
        name: payload.businessName,
        slug,
        email: payload.businessEmail.toLowerCase(),
        websiteUrl: payload.websiteUrl || null,
        users: {
          create: {
            name: payload.name,
            email: payload.email.toLowerCase(),
            passwordHash,
            role: UserRole.OWNER,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = business.users[0];
    const token = signToken({
      userId: user.id,
      businessId: business.id,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        websiteUrl: business.websiteUrl,
        brandColor: business.brandColor,
        welcomeMessage: business.welcomeMessage,
      },
    });
  }),
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      include: { business: true },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const matches = await bcrypt.compare(payload.password, user.passwordHash);
    if (!matches) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signToken({
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        slug: user.business.slug,
        email: user.business.email,
        websiteUrl: user.business.websiteUrl,
        brandColor: user.business.brandColor,
        welcomeMessage: user.business.welcomeMessage,
      },
    });
  }),
);

app.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: { business: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        slug: user.business.slug,
        email: user.business.email,
        websiteUrl: user.business.websiteUrl,
        brandColor: user.business.brandColor,
        welcomeMessage: user.business.welcomeMessage,
      },
    });
  }),
);

app.get(
  "/api/admin/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;

    const [business, conversations, bookings] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
      }),
      prisma.conversation.findMany({
        where: { businessId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 3,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.booking.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    const totalChats = conversations.length;
    const qualifiedLeads = conversations.filter((conversation) => conversation.leadStatus !== LeadStatus.NEW)
      .length;
    const conversionRate =
      totalChats === 0 ? 0 : Number(((qualifiedLeads / totalChats) * 100).toFixed(1));

    res.json({
      business,
      metrics: {
        totalChats,
        qualifiedLeads,
        bookings: bookings.length,
        conversionRate,
      },
      recentConversations: conversations,
      recentBookings: bookings,
    });
  }),
);

app.get(
  "/api/admin/knowledge",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const items = await prisma.knowledgeItem.findMany({
      where: { businessId },
      include: {
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ items });
  }),
);

app.post(
  "/api/admin/knowledge",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = knowledgeSchema.parse(req.body);
    const rawContent = await readKnowledgeContent(payload, req.file ?? undefined);

    if (!rawContent) {
      res.status(400).json({ error: "Provide text content or upload a file." });
      return;
    }

    const chunks = chunkText(rawContent);
    if (chunks.length === 0) {
      res.status(400).json({ error: "No valid knowledge content found." });
      return;
    }

    const knowledgeItem = await prisma.knowledgeItem.create({
      data: {
        businessId,
        title: payload.title,
        sourceType: payload.sourceType,
        rawContent,
      },
    });

    const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk)));
    await prisma.knowledgeChunk.createMany({
      data: chunks.map((chunk, index) => ({
        businessId,
        knowledgeItemId: knowledgeItem.id,
        content: chunk,
        embedding: embeddings[index],
        metadata: toPrismaJsonObject({
          sourceType: payload.sourceType,
          title: payload.title,
        }),
        sequence: index,
      })),
    });

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: knowledgeItem.id },
      include: {
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    });

    res.status(201).json({ item });
  }),
);

app.delete(
  "/api/admin/knowledge/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const knowledgeItemId = firstParam(req.params.id);

    if (!knowledgeItemId) {
      res.status(400).json({ error: "Knowledge item id is required." });
      return;
    }

    const existing = await prisma.knowledgeItem.findFirst({
      where: {
        id: knowledgeItemId,
        businessId,
      },
    });

    if (!existing) {
      res.status(404).json({ error: "Knowledge item not found." });
      return;
    }

    await prisma.knowledgeItem.delete({
      where: { id: existing.id },
    });

    res.status(204).send();
  }),
);

app.get(
  "/api/admin/conversations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const conversations = await prisma.conversation.findMany({
      where: { businessId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        bookings: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });

    res.json({ conversations });
  }),
);

app.post(
  "/api/admin/conversations/:id/takeover",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.auth!;
    const payload = takeoverSchema.parse(req.body);
    const conversationId = firstParam(req.params.id);

    if (!conversationId) {
      res.status(400).json({ error: "Conversation id is required." });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId,
      },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const status = payload.enabled ? ConversationStatus.HUMAN : ConversationStatus.OPEN;
    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status,
        assignedToId: payload.enabled ? userId : null,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        bookings: true,
      },
    });

    if (payload.enabled) {
      await prisma.message.create({
        data: {
          businessId,
          conversationId: conversation.id,
          role: MessageRole.SYSTEM,
          content: HANDOFF_MESSAGE,
        },
      });

      await trackEvent(businessId, AnalyticsEventType.HUMAN_HANDOFF, conversation.id, {
        assignedToId: userId,
      });
    }

    res.json({ conversation: updated });
  }),
);

app.post(
  "/api/admin/conversations/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.auth!;
    const payload = adminReplySchema.parse(req.body);
    const conversationId = firstParam(req.params.id);

    if (!conversationId) {
      res.status(400).json({ error: "Conversation id is required." });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId,
      },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    await prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        role: MessageRole.ADMIN,
        content: payload.content,
        metadata: toPrismaJsonObject({
          authoredByUserId: userId,
        }),
      },
    });

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ConversationStatus.HUMAN,
        assignedToId: userId,
        lastAssistantMessageAt: new Date(),
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        bookings: true,
      },
    });

    res.status(201).json({ conversation: updated });
  }),
);

app.get(
  "/api/admin/bookings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const bookings = await prisma.booking.findMany({
      where: { businessId },
      include: {
        conversation: {
          select: {
            id: true,
            visitorName: true,
            visitorEmail: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ bookings });
  }),
);

app.get(
  "/api/admin/widget",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const widgetUrls = resolveWidgetSnippetUrls(req);
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    res.json({
      business,
      widgetSnippet: formatWidgetSnippet(business.slug, widgetUrls),
    });
  }),
);

app.put(
  "/api/admin/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = settingsSchema.parse(req.body);

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        brandColor: payload.brandColor,
        welcomeMessage: payload.welcomeMessage,
        websiteUrl: payload.websiteUrl || null,
      },
    });

    res.json({ business });
  }),
);

app.post(
  "/api/admin/support/reply",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = supportReplySchema.parse(req.body);

    const snippets = await retrieveKnowledge(businessId, payload.customerMessage);
    const business = await prisma.business.findUnique({ where: { id: businessId } });

    const reply = await generateReply({
      businessName: business?.name ?? "Business",
      businessEmail: business?.email ?? "support@example.com",
      welcomeMessage: business?.welcomeMessage ?? "Welcome",
      userMessage: payload.customerMessage,
      snippets,
      history: [],
    });

    res.json({
      suggestedReply: reply,
      priority: payload.priority,
      channel: payload.channel,
      groundingSnippetCount: snippets.length,
    });
  }),
);

app.get(
  "/api/admin/shifts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const shifts = await prisma.shift.findMany({
      where: { businessId },
      orderBy: { start: "asc" },
    });
    res.json({ shifts });
  }),
);

app.post(
  "/api/admin/shifts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = createShiftSchema.parse(req.body);
    const shift = await prisma.shift.create({
      data: {
        businessId,
        teamMember: payload.teamMember,
        role: payload.role,
        start: new Date(payload.start),
        end: new Date(payload.end),
        notes: payload.notes,
      },
    });
    res.status(201).json({ shift });
  }),
);

app.get(
  "/api/admin/internal-assistant",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const question = String(req.query.question ?? "").trim();
    if (!question) {
      res.status(400).json({ error: "Question is required." });
      return;
    }

    const payload = internalAssistantSchema.parse({ question, context: String(req.query.context ?? "INTERNAL") });
    const snippets = await retrieveKnowledge(businessId, payload.question);
    const business = await prisma.business.findUnique({ where: { id: businessId } });

    const answer = await generateReply({
      businessName: business?.name ?? "Business",
      businessEmail: business?.email ?? "support@example.com",
      welcomeMessage: business?.welcomeMessage ?? "Welcome",
      userMessage: payload.question,
      snippets,
      history: [],
    });

    res.json({
      answer,
      usedKnowledgeSnippets: snippets.map((snippet) => ({
        id: snippet.id,
        score: Number(snippet.score.toFixed(3)),
      })),
    });
  }),
);

app.get(
  "/api/admin/automations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const automations = await prisma.automation.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ automations });
  }),
);

app.post(
  "/api/admin/automations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = createAutomationSchema.parse(req.body);
    const automation = await prisma.automation.create({
      data: {
        businessId,
        title: payload.title,
        type: payload.type,
        schedule: payload.schedule,
        enabled: payload.enabled,
      },
    });
    res.status(201).json({ automation });
  }),
);

app.post(
  "/api/admin/automations/:id/run",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const automationId = firstParam(req.params.id);
    if (!automationId) {
      res.status(400).json({ error: "Automation id is required." });
      return;
    }

    const item = await prisma.automation.findFirst({
      where: {
        id: automationId,
        businessId,
      },
    });
    if (!item) {
      res.status(404).json({ error: "Automation not found." });
      return;
    }

    const updated = await prisma.automation.update({
      where: { id: item.id },
      data: {
        lastRunAt: new Date(),
      },
    });
    res.json({ automation: updated, result: `${updated.type} executed.` });
  }),
);

app.get(
  "/api/admin/reports/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const period = String(req.query.period ?? "daily");
    const now = new Date();
    const from = new Date(now);
    if (period === "weekly") {
      from.setDate(now.getDate() - 7);
    } else {
      from.setDate(now.getDate() - 1);
    }

    const [conversations, bookings] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          businessId,
          createdAt: { gte: from },
        },
      }),
      prisma.booking.findMany({
        where: {
          businessId,
          createdAt: { gte: from },
        },
      }),
    ]);

    const summary = {
      period,
      from: from.toISOString(),
      to: now.toISOString(),
      totalConversations: conversations.length,
      humanHandoffs: conversations.filter((conversation) => conversation.status === ConversationStatus.HUMAN)
        .length,
      qualifiedLeads: conversations.filter((conversation) => conversation.leadStatus !== LeadStatus.NEW).length,
      bookingsCaptured: bookings.length,
      bookingStatuses: bookings.reduce<Record<string, number>>((acc, booking) => {
        acc[booking.status] = (acc[booking.status] ?? 0) + 1;
        return acc;
      }, {}),
    };

    res.json({ summary });
  }),
);

app.get(
  "/api/admin/regional-settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const settings = await getRegionalSettingsForBusiness(businessId);
    res.json({ settings });
  }),
);

app.put(
  "/api/admin/regional-settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = regionalSettingsSchema.parse(req.body);
    await prisma.regionalSettings.upsert({
      where: { businessId },
      create: {
        businessId,
        defaultLanguage: payload.defaultLanguage,
        additionalLanguages: payload.additionalLanguages,
        province: payload.province,
        timezone: payload.timezone,
        currency: payload.currency,
      },
      update: {
        defaultLanguage: payload.defaultLanguage,
        additionalLanguages: payload.additionalLanguages,
        province: payload.province,
        timezone: payload.timezone,
        currency: payload.currency,
      },
    });
    const settings: RegionalSettings = { businessId, ...payload };
    res.json({ settings });
  }),
);

app.get(
  "/api/widget/:slug/config",
  asyncHandler(async (req, res) => {
    const slug = firstParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: "Business slug is required." });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    const suggestions = await prisma.knowledgeItem.findMany({
      where: { businessId: business.id },
      select: { title: true },
      take: 4,
      orderBy: { updatedAt: "desc" },
    });

    res.json({
      business: {
        name: business.name,
        slug: business.slug,
        brandColor: business.brandColor,
        welcomeMessage: business.welcomeMessage,
      },
      suggestions: suggestions.map((item) => item.title),
    });
  }),
);

app.get(
  "/api/widget/:slug/conversations/:conversationId",
  asyncHandler(async (req, res) => {
    const slug = firstParam(req.params.slug);
    const conversationId = firstParam(req.params.conversationId);

    if (!slug || !conversationId) {
      res.status(400).json({ error: "Business slug and conversation id are required." });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId: business.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.json({ conversation });
  }),
);

app.post(
  "/api/widget/:slug/messages",
  asyncHandler(async (req, res) => {
    const payload = widgetMessageSchema.parse(req.body);
    const slug = firstParam(req.params.slug);

    if (!slug) {
      res.status(400).json({ error: "Business slug is required." });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    let conversation =
      payload.conversationId &&
      (await prisma.conversation.findFirst({
        where: {
          id: payload.conversationId,
          businessId: business.id,
        },
      }));

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          businessId: business.id,
          visitorName: payload.visitorName,
          visitorEmail: payload.visitorEmail || null,
          lastCustomerMessageAt: new Date(),
        },
      });

      await trackEvent(business.id, AnalyticsEventType.CHAT_STARTED, conversation.id, {
        source: "widget",
      });
    }

    await prisma.message.create({
      data: {
        businessId: business.id,
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: payload.message,
        metadata: toPrismaJsonObject({
          intent: detectIntent(payload.message),
        }),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        visitorName: payload.visitorName || conversation.visitorName,
        visitorEmail: payload.visitorEmail || conversation.visitorEmail,
        lastCustomerMessageAt: new Date(),
      },
    });

    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    const signals = extractBookingSignals(payload.message);
    const booking = await maybeUpsertBooking({
      businessId: business.id,
      businessName: business.name,
      businessEmail: business.email,
      conversationId: conversation.id,
      existingLeadStatus: conversation.leadStatus,
      message: payload.message,
      signals,
    });

    let assistantMessageContent = HANDOFF_MESSAGE;

    if (conversation.status !== ConversationStatus.HUMAN) {
      const snippets = await retrieveKnowledge(business.id, payload.message);
      assistantMessageContent = await generateReply({
        businessName: business.name,
        businessEmail: business.email,
        welcomeMessage: business.welcomeMessage,
        userMessage: payload.message,
        history: history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        snippets,
      });

      await prisma.message.create({
        data: {
          businessId: business.id,
          conversationId: conversation.id,
          role: MessageRole.ASSISTANT,
          content: assistantMessageContent,
          metadata: toPrismaJsonObject({
            intent: detectIntent(payload.message),
            snippetCount: snippets.length,
          }),
        },
      });
    } else {
      const latestSystemMessage = history
        .slice()
        .reverse()
        .find((message) => message.role === MessageRole.SYSTEM);

      if (latestSystemMessage?.content !== HANDOFF_MESSAGE) {
        await prisma.message.create({
          data: {
            businessId: business.id,
            conversationId: conversation.id,
            role: MessageRole.SYSTEM,
            content: HANDOFF_MESSAGE,
          },
        });
      }
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastAssistantMessageAt: new Date(),
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        bookings: true,
      },
    });

    res.status(201).json({
      conversation: updatedConversation,
      booking,
      assistantMessage:
        updatedConversation.messages[updatedConversation.messages.length - 1]?.content ??
        assistantMessageContent,
    });
  }),
);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);

  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      details: error.flatten(),
    });
    return;
  }

  res.status(500).json({
    error: "Internal server error.",
  });
});

const isVercelRuntime = process.env.VERCEL === "1";
const isRailwayRuntime = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

if (!isVercelRuntime || isRailwayRuntime) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.info(`AI Concierge API listening on http://localhost:${port}`);
  });
}
