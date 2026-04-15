<script setup lang="ts">
import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  ConciergeBell,
  MessageSquareMore,
  ShieldCheck,
  Sparkles,
} from "lucide-vue-next";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const primaryLink = computed(() => (auth.isAuthenticated ? "/dashboard" : "/signup"));

const features = [
  {
    title: "Booking-focused AI conversations",
    description:
      "Guide guests from question to reservation by answering pricing, room, amenity, and policy questions with grounded property context.",
    icon: Bot,
  },
  {
    title: "Hospitality-first knowledge base",
    description:
      "Upload FAQs, room descriptions, pricing rules, and house policies, then let retrieval keep the assistant accurate and conversion friendly.",
    icon: ConciergeBell,
  },
  {
    title: "Inbox with human handoff",
    description:
      "Move high-intent conversations to staff when needed without losing history, context, or captured guest details.",
    icon: MessageSquareMore,
  },
  {
    title: "ROI clarity for operators",
    description:
      "Surface chat volume, lead quality, booking requests, and conversion rates so boutique teams can connect AI directly to revenue.",
    icon: ChartNoAxesCombined,
  },
];
</script>

<template>
  <div class="app-shell px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <header class="glass-card flex items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/25"
          >
            <Sparkles class="h-5 w-5" />
          </div>
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">
              AI Concierge Assistant
            </p>
            <p class="text-sm text-slate-500">
              Hospitality AI for Canadian hotels, Airbnbs, and boutique stays
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink class="pill-button border border-slate-200 bg-white text-slate-700" to="/login">
            Log in
          </RouterLink>
          <RouterLink
            class="pill-button bg-slate-900 text-white shadow-lg shadow-slate-900/15"
            :to="primaryLink"
          >
            {{ auth.isAuthenticated ? "Open dashboard" : "Start free setup" }}
          </RouterLink>
        </div>
      </header>

      <section class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div class="glass-card overflow-hidden p-8 sm:p-10">
          <div
            class="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700"
          >
            <ShieldCheck class="h-4 w-4" />
            Multi-tenant, RAG-powered, booking-optimized
          </div>
          <h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            Turn guest questions into more confirmed stays.
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            AI Concierge Assistant helps hospitality brands respond instantly, recommend the right
            room or service, capture lead details, and escalate to staff only when it matters.
          </p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <RouterLink
              class="pill-button bg-teal-600 px-5 py-3 text-white shadow-xl shadow-teal-600/20"
              :to="primaryLink"
            >
              Launch the MVP
              <ArrowRight class="ml-2 h-4 w-4" />
            </RouterLink>
            <a
              class="pill-button border border-slate-200 bg-white px-5 py-3 text-slate-700"
              href="#roi"
            >
              See the ROI model
            </a>
          </div>

          <div class="mt-10 grid gap-4 sm:grid-cols-3">
            <div class="soft-panel p-5">
              <p class="text-sm text-slate-500">Setup time</p>
              <p class="mt-2 text-3xl font-semibold text-slate-950">&lt; 5 min</p>
              <p class="mt-2 text-sm text-slate-600">Drop in the script and connect your knowledge.</p>
            </div>
            <div class="soft-panel p-5">
              <p class="text-sm text-slate-500">Goal</p>
              <p class="mt-2 text-3xl font-semibold text-slate-950">More bookings</p>
              <p class="mt-2 text-sm text-slate-600">
                AI answers pricing and availability questions before the lead goes cold.
              </p>
            </div>
            <div class="soft-panel p-5">
              <p class="text-sm text-slate-500">Trust signal</p>
              <p class="mt-2 text-3xl font-semibold text-slate-950">Grounded RAG</p>
              <p class="mt-2 text-sm text-slate-600">
                The assistant responds from your uploaded policies, room details, and rates.
              </p>
            </div>
          </div>
        </div>

        <div class="glass-card p-6">
          <div class="rounded-[2rem] bg-slate-950 p-5 text-white">
            <div class="mb-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="rounded-2xl bg-white/10 p-3">
                  <Bot class="h-5 w-5 text-teal-300" />
                </div>
                <div>
                  <p class="font-medium">Maple Stay AI Concierge</p>
                  <p class="text-sm text-slate-300">Website widget preview</p>
                </div>
              </div>
              <span class="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                Live
              </span>
            </div>

            <div class="space-y-4 rounded-[1.75rem] bg-white/6 p-4">
              <div class="max-w-[88%] rounded-3xl rounded-bl-md bg-white/10 px-4 py-3 text-sm">
                Hi! I can help with availability, room recommendations, pet policies, and booking
                requests.
              </div>
              <div
                class="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-teal-400 px-4 py-3 text-sm text-slate-950"
              >
                We need a two-night stay for 2 guests in Vancouver. Is breakfast included?
              </div>
              <div class="max-w-[88%] rounded-3xl rounded-bl-md bg-white/10 px-4 py-3 text-sm">
                Yes — our Harbour King and Cedar Loft rates include breakfast for two. If you share
                your dates and email, I can capture a booking request for the team right away.
              </div>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <div class="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p class="text-sm font-medium text-white">Suggested next step</p>
                <p class="mt-2 text-sm text-slate-300">
                  Capture check-in/out dates and route warm leads into the bookings inbox.
                </p>
              </div>
              <div class="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p class="text-sm font-medium text-white">Human handoff</p>
                <p class="mt-2 text-sm text-slate-300">
                  Staff can take over premium conversations without losing transcript history.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-2">
        <div class="glass-card p-8">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Why this works</p>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <article
              v-for="feature in features"
              :key="feature.title"
              class="soft-panel flex h-full flex-col gap-4 p-5"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <component :is="feature.icon" class="h-5 w-5" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-slate-950">{{ feature.title }}</h2>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ feature.description }}</p>
              </div>
            </article>
          </div>
        </div>

        <div id="roi" class="glass-card p-8">
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Revenue-oriented by design
          </p>
          <div class="mt-6 space-y-4">
            <div class="soft-panel p-5">
              <p class="text-sm text-slate-500">Faster first response</p>
              <p class="mt-2 text-2xl font-semibold text-slate-950">Answer guests instantly, 24/7</p>
              <p class="mt-2 text-sm text-slate-600">
                Reduce missed bookings from after-hours website inquiries and peak-season lag.
              </p>
            </div>
            <div class="soft-panel p-5">
              <p class="text-sm text-slate-500">Lead qualification</p>
              <p class="mt-2 text-2xl font-semibold text-slate-950">
                Collect dates, preferences, and contact details automatically
              </p>
              <p class="mt-2 text-sm text-slate-600">
                Staff spend less time triaging and more time closing high-intent leads.
              </p>
            </div>
            <div class="soft-panel p-5">
              <p class="text-sm text-slate-500">Conversion insight</p>
              <p class="mt-2 text-2xl font-semibold text-slate-950">
                Measure chats, leads, bookings, and takeover moments
              </p>
              <p class="mt-2 text-sm text-slate-600">
                Operators get a clean view of whether the widget is moving revenue metrics.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
