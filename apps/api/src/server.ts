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
  ConversationChannel,
  ConversationStatus,
  LeadStatus,
  MessageRole,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import pg from "pg";
import { z } from "zod";

const optionalUrlWithDefault = (fallback: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().default(fallback),
  );
const optionalTrimmedString = () =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().optional(),
  );

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  FIREBASE_PROJECT_ID: optionalTrimmedString(),
  FIREBASE_CLIENT_EMAIL: optionalTrimmedString(),
  FIREBASE_PRIVATE_KEY: optionalTrimmedString(),
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
  WEB_APP_URL: optionalUrlWithDefault("http://localhost:5173"),
  API_URL: optionalUrlWithDefault("http://localhost:8080"),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  SUPERADMIN_JWT_SECRET: z.string().optional(),
  SUPERADMIN_SEED_EMAIL: z.string().email().optional(),
  SUPERADMIN_SEED_PASSWORD: z.string().min(8).optional(),
  SUPERADMIN_SEED_NAME: z.string().optional(),
});

export const env = envSchema.parse(process.env);

class HttpError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function isMissingSuperadminTableError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === "P2021") return true;
  const message = String(candidate?.message ?? "").toLowerCase();
  return message.includes("superadmin_users") || message.includes("platform_audit_logs");
}

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

const prismaAny = prisma as any;
const PLATFORM_ROLE_SUPERADMIN = "SUPERADMIN" as const;
const BUSINESS_STATUS_ACTIVE = "ACTIVE" as const;
const BUSINESS_STATUS_SUSPENDED = "SUSPENDED" as const;

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
  impersonatedBySuperadminId?: string;
};

type SuperadminAuthToken = {
  superadminId: string;
  role: "SUPERADMIN";
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
  title?: string;
  sourceType?: string;
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
      superadminAuth?: SuperadminAuthToken;
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
    await ensureBusinessActiveOrThrow(payload.businessId);
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
      if (!(user as any).active) {
        res.status(403).json({ error: "User account is inactive." });
        return;
      }

      req.auth = {
        userId: user.id,
        businessId: user.businessId,
        role: user.role,
      };
      await ensureBusinessActiveOrThrow(user.businessId);
      next();
    } catch {
      res.status(401).json({ error: "Invalid token." });
    }
  }
});

const requireSuperadminAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing superadmin bearer token." });
    return;
  }

  try {
    const payload = jwt.verify(token, superadminJwtSecret) as SuperadminAuthToken;
    let superadmin;
    try {
      superadmin = await prismaAny.superadminUser.findUnique({
        where: { id: payload.superadminId },
        select: { id: true, active: true, role: true },
      });
    } catch (error) {
      if (isMissingSuperadminTableError(error)) {
        res.status(503).json({
          error:
            "Superadmin is not initialized in this environment yet. Run database schema sync and seed superadmin credentials.",
        });
        return;
      }
      throw error;
    }
    if (!superadmin || !superadmin.active || superadmin.role !== PLATFORM_ROLE_SUPERADMIN) {
      res.status(403).json({ error: "Superadmin access denied." });
      return;
    }
    req.superadminAuth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid superadmin token." });
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

const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const platformUserCreateSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["OWNER", "ADMIN", "AGENT"]).default("ADMIN"),
});

const platformUserUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["OWNER", "ADMIN", "AGENT"]).optional(),
  active: z.boolean().optional(),
});

const platformBusinessUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  subscriptionPlan: z.enum(["FREE", "PRO", "ENTERPRISE"]).optional(),
  subscriptionStatus: z.enum(["NONE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]).optional(),
});

const platformImpersonateSchema = z.object({
  userId: z.string().min(1),
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

const createEmployeeSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  roles: z.array(z.string().min(1)).min(1),
  availability: z.array(z.string().min(1)).default([]),
  maxHoursPerWeek: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

const autoAssignShiftSchema = z.object({
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
  whatsappVerifyToken: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
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

const superadminJwtSecret = env.SUPERADMIN_JWT_SECRET || env.JWT_SECRET;

function signSuperadminToken(superadmin: SuperadminAuthToken) {
  return jwt.sign(superadmin, superadminJwtSecret, { expiresIn: "12h" });
}

async function ensureBusinessActiveOrThrow(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new HttpError(401, "Business not found for authenticated user.");
  }
  if ((business as any).status === BUSINESS_STATUS_SUSPENDED) {
    throw new HttpError(403, "This workspace is suspended. Contact support.");
  }
}

async function writePlatformAuditLog(input: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prismaAny.platformAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: toPrismaJsonObject(input.metadata ?? {}),
    },
  });
}

async function verifyFirebaseIdToken(idToken: string) {
  if (!firebaseAdminEnabled) {
    throw new HttpError(503, "Firebase authentication is not configured on the server.");
  }

  try {
    return await getAuth().verifyIdToken(idToken);
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };
    console.error("Firebase token verification failed", {
      code: firebaseError?.code,
      message: firebaseError?.message,
    });
    throw new HttpError(401, "Invalid or expired Firebase token.", {
      firebaseCode: firebaseError?.code ?? "unknown",
      firebaseMessage: firebaseError?.message ?? "Unknown Firebase Admin verification error.",
    });
  }
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

  const sectionChunks = normalized
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0 && section.length <= maxLength);
  if (sectionChunks.length >= 4) {
    return sectionChunks.filter(
      (chunk) => chunk.length >= 60 && /[a-zA-Z]{3,}/.test(chunk) && /\s/.test(chunk),
    );
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const slice = normalized.slice(cursor, cursor + maxLength);
    const boundary = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
    const end = boundary > maxLength * 0.55 ? cursor + boundary + 1 : cursor + slice.length;
    const chunk = normalized.slice(cursor, end).trim();

    if (chunk.length >= 60 && /[a-zA-Z]{3,}/.test(chunk) && /\s/.test(chunk)) {
      chunks.push(chunk);
    }

    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

function detectIntent(message: string) {
  const normalized = message.toLowerCase();

  if (/(talk to (an )?(agent|human|staff)|human agent|live agent|representative|real person|customer support)/.test(normalized)) {
    return "human_handoff";
  }

  if (/(complaint|not happy|bad service|terrible|unacceptable|issue with my stay|lost property|lost item|left my)/.test(normalized)) {
    return "support_escalation";
  }

  if (/(group booking|group rate|wedding block|conference block|5\+ rooms|five rooms|corporate rate|business rate|accessibility|accessible room|wheelchair)/.test(normalized)) {
    return "special_request";
  }

  if (/(refund|chargeback|dispute|money back|billing issue|cancel and refund)/.test(normalized)) {
    return "refund_dispute";
  }

  if (/(book|reserve|availability|available|check-in|check out|dates|stay|night)/.test(normalized)) {
    return "booking_request";
  }

  if (/(price|pricing|rate|cost|discount)/.test(normalized)) {
    return "pricing_question";
  }

  return "inquiry";
}

function detectGuideFocus(message: string) {
  const normalized = message.toLowerCase();
  if (/(queen|king|suite|room type|room|sleep|balcony|kitchenette|bed)/.test(normalized)) {
    return "ROOM";
  }
  if (/(price|pricing|rate|cost|fee|cad|\$|discount|night)/.test(normalized)) {
    return "PRICING";
  }
  if (
    /(policy|pet|cancel|cancellation|check-in|check in|check-out|checkout|parking|refund|child|children|rollaway|late check-out|early check-in)/.test(
      normalized,
    )
  ) {
    return "POLICY";
  }
  if (/(amenities|wifi|wi-fi|gym|fitness|housekeeping|laundry|coffee|concierge)/.test(normalized)) {
    return "SERVICE";
  }
  if (/(address|location|nearby|attraction|cn tower|union station|waterfront|eaton)/.test(normalized)) {
    return "FAQ";
  }
  if (/(payment|visa|mastercard|amex|apple pay|google pay|debit)/.test(normalized)) {
    return "FAQ";
  }
  return null;
}

function extractRateSnippets(snippets: RetrievedSnippet[]) {
  const joined = snippets.map((snippet) => snippet.content).join("\n");
  const lines = joined
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const rates = lines
    .filter((line) => /(price|from cad|cad \$|\$)/i.test(line))
    .slice(0, 6);

  return rates;
}

function buildDeterministicReply(options: {
  userMessage: string;
  businessEmail: string;
  snippets: RetrievedSnippet[];
}) {
  const message = options.userMessage.toLowerCase();
  const rates = extractRateSnippets(options.snippets);

  if (/(rate|price|pricing|cost|how much)/.test(message) && rates.length > 0) {
    return [
      "Current room rates from our guide:",
      ...rates.map((line) => `- ${line}`),
      "",
      "If you share your dates and guest count, I can suggest the best-fit room and total estimate.",
    ].join("\n");
  }

  if (/(check-?in|check-?out|early check|late check)/.test(message)) {
    const relevant = options.snippets
      .map((s) => s.content)
      .find((content) => /(check-?in|check-?out|early check|late check)/i.test(content));
    if (relevant) return relevant;
  }

  if (/(pet|dog|animal)/.test(message)) {
    const relevant = options.snippets
      .map((s) => s.content)
      .find((content) => /(pet|dog|cleaning fee|lbs)/i.test(content));
    if (relevant) return relevant;
  }

  if (/(parking|park)/.test(message)) {
    const relevant = options.snippets
      .map((s) => s.content)
      .find((content) => /(parking|self-parking|first come|cad \$?25)/i.test(content));
    if (relevant) return relevant;
  }

  if (/(cancel|cancellation|refund policy|non-refundable|flexible rate)/.test(message)) {
    const relevant = options.snippets
      .map((s) => s.content)
      .find((content) => /(cancellation|non-refundable|flexible rate|48 hours)/i.test(content));
    if (relevant) return relevant;
  }

  if (/(breakfast|food|meal)/.test(message)) {
    const relevant = options.snippets
      .map((s) => s.content)
      .find((content) => /(breakfast|cad \$?18)/i.test(content));
    if (relevant) return relevant;
  }

  if (/(payment|visa|mastercard|amex|american express|apple pay|google pay|debit)/.test(message)) {
    const relevant = options.snippets
      .map((s) => s.content)
      .find((content) => /(visa|mastercard|american express|debit|apple pay|google pay)/i.test(content));
    if (relevant) return relevant;
  }

  return null;
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
  const normalizedQuery = query.toLowerCase();
  const preferredSourceType = detectGuideFocus(query);
  const pricingIntent = /(price|pricing|rate|cost|fee|discount|cad|\$)/.test(normalizedQuery);
  const policyIntent =
    /(policy|pet|cancel|cancellation|check-in|check in|check-out|checkout|parking|refund|child|children)/.test(
      normalizedQuery,
    );
  const queryTerms = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((term) => term.trim())
      .filter((term) => term.length > 2),
  );
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { businessId },
    select: {
      id: true,
      content: true,
      embedding: true,
      metadata: true,
      knowledgeItem: {
        select: {
          updatedAt: true,
        },
      },
    },
  });

  const newestTimestamp = chunks.reduce(
    (latest, chunk) => Math.max(latest, new Date(chunk.knowledgeItem.updatedAt).getTime()),
    0,
  );

  const ranked = chunks
    .map<RetrievedSnippet>((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      title:
        chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
          ? String((chunk.metadata as Record<string, unknown>).title ?? "")
          : "",
      sourceType:
        chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
          ? String((chunk.metadata as Record<string, unknown>).sourceType ?? "")
          : "",
      score: (() => {
        const semantic = cosineSimilarity(queryEmbedding, toEmbeddingArray(chunk.embedding));
        const normalizedContent = chunk.content.toLowerCase();
        const contentTerms = new Set(
          normalizedContent
            .split(/[^a-z0-9]+/g)
            .map((term) => term.trim())
            .filter((term) => term.length > 2),
        );
        const overlapCount = [...queryTerms].filter((term) => contentTerms.has(term)).length;
        const lexical = queryTerms.size > 0 ? overlapCount / queryTerms.size : 0;
        const metadata =
          chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
            ? (chunk.metadata as Record<string, unknown>)
            : {};
        const sourceType = String(metadata.sourceType ?? "").toUpperCase();
        const pricingPattern = /(price|pricing|rate|cad|\$|per night|nightly|from cad)/.test(
          normalizedContent,
        );
        const sourceBoost =
          (pricingIntent && sourceType === "PRICING" ? 0.05 : 0) +
          (policyIntent && (sourceType === "POLICY" || sourceType === "FAQ") ? 0.04 : 0) +
          (preferredSourceType && sourceType === preferredSourceType ? 0.08 : 0);
        const contentBoost = pricingIntent && pricingPattern ? 0.12 : 0;

        const updatedAtMs = new Date(chunk.knowledgeItem.updatedAt).getTime();
        const recencyBoost =
          newestTimestamp > 0 ? Math.max(0, Math.min(0.05, ((updatedAtMs / newestTimestamp) - 0.96) * 1.2)) : 0;

        return semantic * 0.64 + lexical * 0.22 + sourceBoost + contentBoost + recencyBoost;
      })(),
    }))
    .sort((left, right) => right.score - left.score)
    .filter(
      (chunk) =>
        chunk.score > (preferredSourceType ? 0.2 : 0.18) &&
        (!pricingIntent ||
          /(price|pricing|rate|cad|\$|per night|nightly|from cad)/.test(chunk.content.toLowerCase())) &&
        chunk.content.length >= 60 &&
        /[a-zA-Z]{3,}/.test(chunk.content) &&
        /\s/.test(chunk.content),
    )
    .slice(0, 8);

  return ranked;
}

function buildFallbackReply(
  businessName: string,
  businessEmail: string,
  snippets: RetrievedSnippet[],
  intent: string,
  handoffPrompt = true,
) {
  if (intent === "human_handoff") {
    return `Absolutely — I can connect you with a human agent. Please share your full name and best email or phone number, and our team will follow up quickly. You can also contact ${businessEmail} directly.`;
  }

  if (intent === "support_escalation") {
    return `I’m sorry you’re dealing with this. I can escalate this to our hotel team immediately. Please share your full name, reservation details, and what happened, or contact ${businessEmail} directly for priority support.`;
  }

  if (intent === "special_request") {
    return `I can help with that, and this request should be handled by our team to confirm details. Please share your dates, number of rooms/guests, and contact info, or email ${businessEmail} for direct assistance.`;
  }

  if (intent === "refund_dispute") {
    return `I can help escalate refund and billing disputes to hotel staff right away. Please share your booking name, reservation number, and the issue details, or contact ${businessEmail} for priority support.`;
  }

  if (snippets.length === 0) {
    return `I do not see that detail in ${businessName}'s knowledge base yet. I can still help collect your dates, guest count, and email so the team can follow up quickly.`;
  }

  const summary = snippets
    .slice(0, 3)
    .map((snippet) => {
      const compact = snippet.content
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const preview = compact.length > 220 ? `${compact.slice(0, 220).trim()}...` : compact;
      return `- ${preview}`;
    })
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
  const guideFocus = detectGuideFocus(options.userMessage);
  const topScore = options.snippets[0]?.score ?? 0;

  if (intent === "human_handoff" || intent === "refund_dispute" || intent === "support_escalation" || intent === "special_request") {
    return buildFallbackReply(options.businessName, options.businessEmail, options.snippets, intent);
  }

  if (!chatClient) {
    return buildFallbackReply(options.businessName, options.businessEmail, options.snippets, intent);
  }

  const deterministic = buildDeterministicReply({
    userMessage: options.userMessage,
    businessEmail: options.businessEmail,
    snippets: options.snippets,
  });
  if (deterministic) {
    return deterministic;
  }

  const knowledgeBlock = options.snippets.length
    ? options.snippets
        .map(
          (snippet, index) =>
            `[${index + 1}] (${snippet.sourceType || "KNOWLEDGE"}${snippet.title ? ` · ${snippet.title}` : ""}) ${snippet.content}`,
        )
        .join("\n")
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
            `Guide focus category: ${guideFocus ?? "GENERAL"}`,
            "Respond in a concise, premium, conversion-friendly tone.",
            "Use only the knowledge snippets for factual claims and avoid making up policies, prices, or services.",
            "When possible, cite snippet numbers like [1] or [2] in your answer.",
            "If a clear answer exists in snippets, answer directly first, then add one optional helpful next step.",
            "If key details are missing from snippets, explicitly say what is missing and offer to collect contact/stay details for human follow-up.",
            topScore < 0.25
              ? "Retrieved context confidence is low. Be transparent about uncertainty and ask one concise clarifying question."
              : "Retrieved context confidence is acceptable. Provide a direct answer grounded in snippets.",
          ].join("\n\n"),
        },
      ],
    });

    return (
      completion.choices[0]?.message?.content?.trim() ??
      buildFallbackReply(options.businessName, options.businessEmail, options.snippets, intent)
    );
  } catch {
    return buildFallbackReply(options.businessName, options.businessEmail, options.snippets, intent);
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizePhoneNumber(value: string | undefined | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[^\d+]/g, "");
}

async function sendWhatsAppMessage(options: {
  toPhone: string;
  text: string;
  accessToken?: string | null;
  phoneNumberId?: string | null;
}) {
  const accessToken = options.accessToken || env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = options.phoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { delivered: false, reason: "WhatsApp env not configured" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: options.toPhone,
          type: "text",
          text: { body: options.text.slice(0, 4000) },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("WhatsApp API send failed", response.status, body);
      return { delivered: false, reason: `HTTP ${response.status}` };
    }

    return { delivered: true };
  } catch (error) {
    console.error("WhatsApp API send exception", error);
    return { delivered: false, reason: "Exception while sending message" };
  }
}

async function processGuestMessage(options: {
  business: {
    id: string;
    name: string;
    slug: string;
    email: string;
    welcomeMessage: string;
    whatsappAccessToken?: string | null;
    whatsappPhoneNumberId?: string | null;
  };
  message: string;
  source: "widget" | "whatsapp";
  conversationId?: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
}) {
  const { business } = options;

  const normalizedVisitorPhone = normalizePhoneNumber(options.visitorPhone);
  const normalizedVisitorEmail = options.visitorEmail?.trim() || undefined;
  const normalizedVisitorName = options.visitorName?.trim() || undefined;

  let conversation =
    options.conversationId &&
    (await prisma.conversation.findFirst({
      where: {
        id: options.conversationId,
        businessId: business.id,
      },
    }));

  if (!conversation && options.source === "whatsapp" && normalizedVisitorPhone) {
    conversation = await prisma.conversation.findFirst({
      where: {
        businessId: business.id,
        channel: ConversationChannel.EMAIL,
        visitorPhone: normalizedVisitorPhone,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId: business.id,
        channel: options.source === "whatsapp" ? ConversationChannel.EMAIL : ConversationChannel.WIDGET,
        visitorName: normalizedVisitorName,
        visitorEmail: normalizedVisitorEmail || null,
        visitorPhone: normalizedVisitorPhone || null,
        lastCustomerMessageAt: new Date(),
      },
    });

    await trackEvent(business.id, AnalyticsEventType.CHAT_STARTED, conversation.id, {
      source: options.source,
    });
  }

  await prisma.message.create({
    data: {
      businessId: business.id,
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: options.message,
      metadata: toPrismaJsonObject({
        intent: detectIntent(options.message),
        source: options.source,
      }),
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      visitorName: normalizedVisitorName || conversation.visitorName,
      visitorEmail: normalizedVisitorEmail || conversation.visitorEmail,
      visitorPhone: normalizedVisitorPhone || conversation.visitorPhone,
      lastCustomerMessageAt: new Date(),
    },
  });

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  const signals = extractBookingSignals(options.message);
  const booking = await maybeUpsertBooking({
    businessId: business.id,
    businessName: business.name,
    businessEmail: business.email,
    conversationId: conversation.id,
    existingLeadStatus: conversation.leadStatus,
    message: options.message,
    signals,
  });

  let assistantMessageContent = HANDOFF_MESSAGE;
  if (conversation.status !== ConversationStatus.HUMAN) {
    const snippets = await retrieveKnowledge(business.id, options.message);
    assistantMessageContent = await generateReply({
      businessName: business.name,
      businessEmail: business.email,
      welcomeMessage: business.welcomeMessage,
      userMessage: options.message,
      history: history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      snippets,
    });

    const delivery =
      options.source === "whatsapp" && normalizedVisitorPhone
        ? await sendWhatsAppMessage({
            toPhone: normalizedVisitorPhone,
            text: assistantMessageContent,
            accessToken: business.whatsappAccessToken,
            phoneNumberId: business.whatsappPhoneNumberId,
          })
        : null;

    await prisma.message.create({
      data: {
        businessId: business.id,
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: assistantMessageContent,
        metadata: toPrismaJsonObject({
          intent: detectIntent(options.message),
          snippetCount: snippets.length,
          source: options.source,
          whatsappDelivered: delivery?.delivered,
          whatsappDeliveryReason: delivery?.reason,
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
          metadata: toPrismaJsonObject({ source: options.source }),
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
    },
  });

  return {
    conversation: updatedConversation,
    booking,
    assistantMessage: assistantMessageContent,
  };
}

function hasSchedulingConflict(
  shift: { start: Date; end: Date },
  targetStart: Date,
  targetEnd: Date,
) {
  return shift.start < targetEnd && shift.end > targetStart;
}

function estimateAvailabilityScore(availability: string[], shiftStart: Date) {
  if (availability.length === 0) return 0.35;
  const day = shiftStart.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const matched = availability.some((slot) => slot.toLowerCase().includes(day));
  return matched ? 1 : 0.4;
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

async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
}

async function ensureSeedSuperadmin() {
  if (!env.SUPERADMIN_SEED_EMAIL || !env.SUPERADMIN_SEED_PASSWORD) return;
  const email = env.SUPERADMIN_SEED_EMAIL.toLowerCase();
  const existing = await prismaAny.superadminUser.findUnique({ where: { email } });
  if (existing) return;
  const passwordHash = await bcrypt.hash(env.SUPERADMIN_SEED_PASSWORD, 10);
  await prismaAny.superadminUser.create({
    data: {
      name: env.SUPERADMIN_SEED_NAME?.trim() || "Platform Superadmin",
      email,
      passwordHash,
      role: PLATFORM_ROLE_SUPERADMIN,
      active: true,
    },
  });
  console.info("Seeded initial superadmin user", { email });
}

app.get("/api/health", async (_req, res) => {
  let database: "ok" | "error" = "ok";
  try {
    await checkDatabaseConnection();
  } catch (error) {
    database = "error";
    console.error("Healthcheck database probe failed", error);
  }

  res.json({
    status: database === "ok" ? "ok" : "degraded",
    service: "ai-concierge-api",
    database,
    aiProvider,
    embeddingProvider: embeddingClient ? (env.XAI_API_KEY ? "xai-grok" : "openai") : "fallback-local",
  });
});

app.get("/api/ready", async (_req, res) => {
  try {
    await checkDatabaseConnection();
    res.status(200).json({
      status: "ready",
      service: "ai-concierge-api",
      database: "ok",
    });
  } catch (error) {
    console.error("Readiness check failed", error);
    res.status(503).json({
      status: "not_ready",
      service: "ai-concierge-api",
      database: "error",
    });
  }
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
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            websiteUrl: true,
            brandColor: true,
            welcomeMessage: true,
          },
        },
      },
    });

    if (!user || !(user as any).active) {
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
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            websiteUrl: true,
            brandColor: true,
            welcomeMessage: true,
          },
        },
      },
    });

    if (!user || !(user as any).active) {
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
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            websiteUrl: true,
            brandColor: true,
            welcomeMessage: true,
          },
        },
      },
    });

    if (!user || !(user as any).active) {
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

app.post(
  "/api/platform/auth/login",
  asyncHandler(async (req, res) => {
    const payload = platformLoginSchema.parse(req.body);
    let superadmin;
    try {
      superadmin = await prismaAny.superadminUser.findUnique({
        where: { email: payload.email.toLowerCase() },
      });
    } catch (error) {
      if (isMissingSuperadminTableError(error)) {
        res.status(503).json({
          error:
            "Superadmin is not initialized in this environment yet. Run database schema sync and seed superadmin credentials.",
        });
        return;
      }
      throw error;
    }
    if (!superadmin || !superadmin.active) {
      res.status(401).json({ error: "Invalid superadmin credentials." });
      return;
    }
    const valid = await bcrypt.compare(payload.password, superadmin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid superadmin credentials." });
      return;
    }
    try {
      await prismaAny.superadminUser.update({
        where: { id: superadmin.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      if (isMissingSuperadminTableError(error)) {
        res.status(503).json({
          error:
            "Superadmin is not initialized in this environment yet. Run database schema sync and seed superadmin credentials.",
        });
        return;
      }
      throw error;
    }
    const token = signSuperadminToken({
      superadminId: superadmin.id,
      role: superadmin.role,
    });
    res.json({
      token,
      superadmin: {
        id: superadmin.id,
        name: superadmin.name,
        email: superadmin.email,
        role: superadmin.role,
      },
    });
  }),
);

app.get(
  "/api/platform/auth/me",
  requireSuperadminAuth,
  asyncHandler(async (req, res) => {
    const auth = req.superadminAuth!;
    const superadmin = await prismaAny.superadminUser.findUnique({
      where: { id: auth.superadminId },
      select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true },
    });
    if (!superadmin || !superadmin.active) {
      res.status(404).json({ error: "Superadmin not found." });
      return;
    }
    res.json({ superadmin });
  }),
);

app.get(
  "/api/platform/users",
  requireSuperadminAuth,
  asyncHandler(async (req, res) => {
    const query = String(req.query.q ?? "").trim();
    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        business: {
          select: { id: true, name: true, slug: true } as any,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: Boolean((user as any).active),
        businessId: user.businessId,
        business: user.business,
        createdAt: user.createdAt,
      })),
    });
  }),
);

app.post(
  "/api/platform/users",
  requireSuperadminAuth,
  asyncHandler(async (req, res) => {
    const payload = platformUserCreateSchema.parse(req.body);
    const business = await prisma.business.findUnique({ where: { id: payload.businessId } });
    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: "User already exists." });
      return;
    }
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prismaAny.user.create({
      data: {
        businessId: payload.businessId,
        name: payload.name,
        email: payload.email.toLowerCase(),
        passwordHash,
        role: payload.role,
        active: true as any,
      },
      include: { business: { select: { id: true, name: true, slug: true } as any } },
    });
    await writePlatformAuditLog({
      actorId: req.superadminAuth!.superadminId,
      action: "USER_CREATED",
      targetType: "USER",
      targetId: user.id,
      metadata: { role: user.role, businessId: user.businessId },
    });
    res.status(201).json({ user });
  }),
);

app.patch(
  "/api/platform/users/:id",
  requireSuperadminAuth,
  asyncHandler(async (req, res) => {
    const id = firstParam(req.params.id);
    const payload = platformUserUpdateSchema.parse(req.body);
    if (!id) {
      res.status(400).json({ error: "User id is required." });
      return;
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.role ? { role: payload.role } : {}),
        ...(payload.active !== undefined ? { active: payload.active as any } : {}),
      },
      include: { business: { select: { id: true, name: true, slug: true } as any } },
    });
    await writePlatformAuditLog({
      actorId: req.superadminAuth!.superadminId,
      action: "USER_UPDATED",
      targetType: "USER",
      targetId: user.id,
      metadata: payload,
    });
    res.json({ user });
  }),
);

app.get(
  "/api/platform/businesses",
  requireSuperadminAuth,
  asyncHandler(async (req, res) => {
    const query = String(req.query.q ?? "").trim();
    const businesses = await prisma.business.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        users: {
          where: { role: UserRole.OWNER },
          select: { id: true, name: true, email: true, active: true } as any,
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ businesses });
  }),
);

app.patch(
  "/api/platform/businesses/:id",
  requireSuperadminAuth,
  asyncHandler(async (req, res) => {
    const id = firstParam(req.params.id);
    const payload = platformBusinessUpdateSchema.parse(req.body);
    if (!id) {
      res.status(400).json({ error: "Business id is required." });
      return;
    }
    const business = await prisma.business.update({
      where: { id },
      data: {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.subscriptionPlan ? { subscriptionPlan: payload.subscriptionPlan } : {}),
        ...(payload.subscriptionStatus ? { subscriptionStatus: payload.subscriptionStatus } : {}),
      },
    });
    await writePlatformAuditLog({
      actorId: req.superadminAuth!.superadminId,
      action: "BUSINESS_UPDATED",
      targetType: "BUSINESS",
      targetId: business.id,
      metadata: payload,
    });
    res.json({ business });
  }),
);

app.get(
  "/api/platform/analytics",
  requireSuperadminAuth,
  asyncHandler(async (_req, res) => {
    const [businesses, users, conversations, bookings] = await Promise.all([
      prisma.business.count(),
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.booking.count(),
    ]);
    const suspendedBusinesses = await prismaAny.business.count({
      where: { status: BUSINESS_STATUS_SUSPENDED },
    });
    res.json({
      summary: {
        businesses,
        suspendedBusinesses,
        users,
        conversations,
        bookings,
      },
    });
  }),
);

app.post(
  "/api/platform/impersonate",
  requireSuperadminAuth,
  asyncHandler(async (req, res) => {
    const payload = platformImpersonateSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        business: {
          select: { id: true, name: true, slug: true, email: true, websiteUrl: true, brandColor: true, welcomeMessage: true },
        },
      },
    });
    if (!user || !(user as any).active) {
      res.status(404).json({ error: "Active user not found for impersonation." });
      return;
    }
    const token = signToken({
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
      impersonatedBySuperadminId: req.superadminAuth!.superadminId,
    });
    await writePlatformAuditLog({
      actorId: req.superadminAuth!.superadminId,
      action: "IMPERSONATION_STARTED",
      targetType: "USER",
      targetId: user.id,
      metadata: { businessId: user.businessId },
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: user.business,
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
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          websiteUrl: true,
          brandColor: true,
          welcomeMessage: true,
        },
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
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        websiteUrl: business.websiteUrl,
        brandColor: business.brandColor,
        welcomeMessage: business.welcomeMessage,
      },
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

app.put(
  "/api/admin/knowledge/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const knowledgeItemId = firstParam(req.params.id);
    if (!knowledgeItemId) {
      res.status(400).json({ error: "Knowledge item id is required." });
      return;
    }

    const payload = knowledgeSchema.parse(req.body);
    const rawContent = (payload.content ?? "").trim();
    if (!rawContent) {
      res.status(400).json({ error: "Provide text content before updating knowledge." });
      return;
    }

    const existing = await prisma.knowledgeItem.findFirst({
      where: { id: knowledgeItemId, businessId },
    });
    if (!existing) {
      res.status(404).json({ error: "Knowledge item not found." });
      return;
    }

    const chunks = chunkText(rawContent);
    if (chunks.length === 0) {
      res.status(400).json({ error: "No valid knowledge content found." });
      return;
    }

    const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk)));
    await prisma.$transaction([
      prisma.knowledgeItem.update({
        where: { id: existing.id },
        data: {
          title: payload.title,
          sourceType: payload.sourceType,
          rawContent,
        },
      }),
      prisma.knowledgeChunk.deleteMany({
        where: { knowledgeItemId: existing.id },
      }),
      prisma.knowledgeChunk.createMany({
        data: chunks.map((chunk, index) => ({
          businessId,
          knowledgeItemId: existing.id,
          content: chunk,
          embedding: embeddings[index],
          metadata: toPrismaJsonObject({
            sourceType: payload.sourceType,
            title: payload.title,
          }),
          sequence: index,
        })),
      }),
    ]);

    const item = await prisma.knowledgeItem.findUnique({
      where: { id: existing.id },
      include: {
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    });
    res.json({ item });
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
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        websiteUrl: true,
        brandColor: true,
        welcomeMessage: true,
      },
    });

    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    res.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        websiteUrl: business.websiteUrl,
        brandColor: business.brandColor,
        welcomeMessage: business.welcomeMessage,
      },
      widgetSnippet: formatWidgetSnippet(business.slug, widgetUrls),
      whatsappWebhookUrl: `${widgetUrls.apiBaseUrl}/api/whatsapp/${business.slug}/webhook`,
      whatsappConfigured: false,
    });
  }),
);

app.put(
  "/api/admin/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = settingsSchema.parse(req.body);
    const whatsappUpdateData = {
      whatsappVerifyToken: payload.whatsappVerifyToken?.trim() || null,
      whatsappAccessToken: payload.whatsappAccessToken?.trim() || null,
      whatsappPhoneNumberId: payload.whatsappPhoneNumberId?.trim() || null,
    };

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        brandColor: payload.brandColor,
        welcomeMessage: payload.welcomeMessage,
        websiteUrl: payload.websiteUrl || null,
        ...whatsappUpdateData,
      },
    });

    const whatsappConfigured = Boolean(
      payload.whatsappAccessToken?.trim() && payload.whatsappPhoneNumberId?.trim(),
    );

    res.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        websiteUrl: business.websiteUrl,
        brandColor: business.brandColor,
        welcomeMessage: business.welcomeMessage,
      },
      whatsappConfigured,
      whatsappWebhookPath: `/api/whatsapp/${business.slug}/webhook`,
    });
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
  "/api/admin/employees",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const employees = await prisma.employee.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      employees: employees.map((employee) => ({
        ...employee,
        roles: toStringArray(employee.roles),
        availability: toStringArray(employee.availability),
      })),
    });
  }),
);

app.post(
  "/api/admin/employees",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = createEmployeeSchema.parse(req.body);

    const employee = await prisma.employee.create({
      data: {
        businessId,
        fullName: payload.fullName,
        email: payload.email || null,
        phone: payload.phone || null,
        roles: payload.roles,
        availability: payload.availability,
        maxHoursPerWeek: payload.maxHoursPerWeek,
        notes: payload.notes,
        active: payload.active,
      },
    });

    res.status(201).json({
      employee: {
        ...employee,
        roles: toStringArray(employee.roles),
        availability: toStringArray(employee.availability),
      },
    });
  }),
);

app.post(
  "/api/admin/shifts/auto-assign",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { businessId } = req.auth!;
    const payload = autoAssignShiftSchema.parse(req.body);

    const shiftStart = new Date(payload.start);
    const shiftEnd = new Date(payload.end);
    if (shiftEnd <= shiftStart) {
      res.status(400).json({ error: "Shift end time must be after shift start time." });
      return;
    }

    const employees = await prisma.employee.findMany({
      where: { businessId, active: true },
      orderBy: { createdAt: "asc" },
    });

    const matchingEmployees = employees.filter((employee) =>
      toStringArray(employee.roles).some((role) => role.toLowerCase() === payload.role.toLowerCase()),
    );

    if (matchingEmployees.length === 0) {
      res.status(404).json({
        error: "No active employees found for this role. Add employee details first.",
      });
      return;
    }

    const recentShifts = await prisma.shift.findMany({
      where: {
        businessId,
        start: {
          gte: new Date(shiftStart.getTime() - 1000 * 60 * 60 * 24 * 7),
        },
      },
    });

    const recommendations = matchingEmployees
      .map((employee) => {
        const employeeShifts = recentShifts.filter((shift) => shift.teamMember === employee.fullName);
        const hasConflict = employeeShifts.some((shift) =>
          hasSchedulingConflict(shift, shiftStart, shiftEnd),
        );
        if (hasConflict) return null;

        const assignedHoursLastWeek = employeeShifts.reduce((total, shift) => {
          const shiftHours = (shift.end.getTime() - shift.start.getTime()) / (1000 * 60 * 60);
          return total + Math.max(shiftHours, 0);
        }, 0);

        const availabilityScore = estimateAvailabilityScore(
          toStringArray(employee.availability),
          shiftStart,
        );
        const weeklyLoadScore = Math.max(0, 1 - assignedHoursLastWeek / 40);
        const capScore = employee.maxHoursPerWeek
          ? Math.max(0, 1 - assignedHoursLastWeek / employee.maxHoursPerWeek)
          : 1;
        const score = availabilityScore * 0.45 + weeklyLoadScore * 0.35 + capScore * 0.2;

        return {
          employee,
          score,
          availabilityScore,
          weeklyLoadScore,
          capScore,
          assignedHoursLastWeek,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((a, b) => b.score - a.score);

    const winner = recommendations[0];
    if (!winner) {
      res.status(409).json({
        error: "No available employee without shift conflicts for the selected time.",
      });
      return;
    }

    const shift = await prisma.shift.create({
      data: {
        businessId,
        teamMember: winner.employee.fullName,
        role: payload.role,
        start: shiftStart,
        end: shiftEnd,
        notes: payload.notes || `Auto-assigned by AI assistant.`,
      },
    });

    res.status(201).json({
      shift,
      assignment: {
        employeeId: winner.employee.id,
        employeeName: winner.employee.fullName,
        confidence: Number(winner.score.toFixed(2)),
        reason: `Selected based on role match, current workload (${winner.assignedHoursLastWeek.toFixed(
          1,
        )}h in last 7 days), and availability fit.`,
      },
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

app.get(
  "/api/whatsapp/:slug/webhook",
  asyncHandler(async (req, res) => {
    const slug = firstParam(req.params.slug);
    const mode = String(req.query["hub.mode"] ?? "");
    const verifyToken = String(req.query["hub.verify_token"] ?? "");
    const challenge = String(req.query["hub.challenge"] ?? "");

    if (!slug) {
      res.status(400).json({ error: "Business slug is required." });
      return;
    }
    if (mode !== "subscribe") {
      res.status(400).json({ error: "Invalid webhook mode." });
      return;
    }
    const business = await prisma.business.findUnique({ where: { slug } });
    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    const expectedVerifyToken =
      String((business as Record<string, unknown>).whatsappVerifyToken ?? "") || env.WHATSAPP_VERIFY_TOKEN;
    if (!expectedVerifyToken || verifyToken !== expectedVerifyToken) {
      res.status(403).json({ error: "Invalid WhatsApp verify token." });
      return;
    }

    res.status(200).send(challenge);
  }),
);

app.post(
  "/api/whatsapp/:slug/webhook",
  asyncHandler(async (req, res) => {
    const slug = firstParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: "Business slug is required." });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        welcomeMessage: true,
      },
    });
    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }

    const entryList = Array.isArray((req.body as { entry?: unknown[] }).entry)
      ? ((req.body as { entry: unknown[] }).entry as unknown[])
      : [];

    for (const entry of entryList) {
      const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
        ? ((entry as { changes: unknown[] }).changes as unknown[])
        : [];

      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> }).value ?? {};
        const contacts = Array.isArray(value.contacts) ? (value.contacts as Array<Record<string, unknown>>) : [];
        const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : [];

        for (const incoming of messages) {
          const fromPhone = normalizePhoneNumber(String(incoming.from ?? ""));
          const textBody = String(
            ((incoming.text as Record<string, unknown> | undefined)?.body as string | undefined) ?? "",
          ).trim();
          if (!fromPhone || !textBody) continue;

          const contact = contacts.find((item) => String(item.wa_id ?? "") === fromPhone);
          const profile = (contact?.profile as Record<string, unknown> | undefined) ?? {};
          const visitorName = String(profile.name ?? "").trim() || undefined;

          await processGuestMessage({
            business,
            message: textBody,
            source: "whatsapp",
            visitorName,
            visitorPhone: fromPhone,
          });
        }
      }
    }

    res.status(200).json({ received: true });
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

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  res.status(500).json({
    error: "Internal server error.",
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
});

ensureSeedSuperadmin().catch((error) => {
  console.error("Failed to seed superadmin", error);
});

const isVercelRuntime = process.env.VERCEL === "1";
const isRailwayRuntime = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

if (!isVercelRuntime || isRailwayRuntime) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.info(`AI Concierge API listening on http://localhost:${port}`);
  });
}
