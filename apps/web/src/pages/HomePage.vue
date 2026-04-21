<script setup lang="ts">
import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  ConciergeBell,
  Globe2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  MessageSquare,
  Users,
  BarChart3,
  Languages,
  Clock,
  Headphones,
  LayoutGrid,
  Star,
} from "lucide-vue-next";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useLocaleStore } from "../stores/locale";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const locale = useLocaleStore();
const primaryLink = computed(() =>
  auth.isAuthenticated ? "/dashboard" : "/signup",
);

const features = [
  {
    titleKey: "feature.support.title",
    descriptionKey: "feature.support.description",
    icon: Bot,
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
  {
    titleKey: "feature.shifts.title",
    descriptionKey: "feature.shifts.description",
    icon: ConciergeBell,
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    titleKey: "feature.internal.title",
    descriptionKey: "feature.internal.description",
    icon: ShieldCheck,
    gradient: "from-violet-500/20 to-purple-500/20",
  },
  {
    titleKey: "feature.automations.title",
    descriptionKey: "feature.automations.description",
    icon: Sparkles,
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    titleKey: "feature.reports.title",
    descriptionKey: "feature.reports.description",
    icon: ChartNoAxesCombined,
    gradient: "from-rose-500/20 to-pink-500/20",
  },
  {
    titleKey: "feature.locale.title",
    descriptionKey: "feature.locale.description",
    icon: Globe2,
    gradient: "from-indigo-500/20 to-blue-500/20",
  },
];

const stats = [
  { labelKey: "stats.setup", valueKey: "stats.setupValue", icon: Clock },
  {
    labelKey: "stats.coverage",
    valueKey: "stats.coverageValue",
    icon: Headphones,
  },
  { labelKey: "stats.focus", valueKey: "stats.focusValue", icon: BarChart3 },
];

const howItWorks = [
  {
    step: "01",
    titleKey: "how.step1.title",
    descriptionKey: "how.step1.description",
  },
  {
    step: "02",
    titleKey: "how.step2.title",
    descriptionKey: "how.step2.description",
  },
  {
    step: "03",
    titleKey: "how.step3.title",
    descriptionKey: "how.step3.description",
  },
];

const outcomes = ["outcomes.1", "outcomes.2", "outcomes.3", "outcomes.4"];

const pricing = [
  {
    nameKey: "pricing.starter.name",
    price: "$49",
    periodKey: "pricing.period",
    descriptionKey: "pricing.starter.description",
    featured: false,
  },
  {
    nameKey: "pricing.growth.name",
    price: "$149",
    periodKey: "pricing.period",
    descriptionKey: "pricing.growth.description",
    featured: true,
  },
  {
    nameKey: "pricing.scale.name",
    price: "",
    periodKey: "",
    descriptionKey: "pricing.scale.description",
    featured: false,
  },
];

function onLocaleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  locale.applyLocale(target.value === "fr-CA" ? "fr-CA" : "en-CA");
}
</script>

<template>
  <div
    class="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100"
  >
    <!-- Animated Background Gradients -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div
        class="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-teal-500/10 blur-[120px]"
      />
      <div
        class="absolute top-60 -left-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-[120px]"
      />
      <div
        class="absolute bottom-40 right-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-[100px]"
      />
      <div
        class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-slate-900/0 via-slate-950/60 to-slate-950"
      />
    </div>

    <!-- Soft light streak overlay -->
    <div
      class="fixed inset-0 pointer-events-none opacity-25 bg-linear-to-b from-transparent via-white/2 to-transparent"
    />

    <div class="relative z-10">
      <div class="mx-auto max-w-11/12 px-3 py-6 sm:px-4 lg:px-5">
        <!-- Enhanced Header -->
        <header
          class="sticky top-4 z-50 rounded-2xl border border-white/8 bg-slate-900/75 px-4 py-3 backdrop-blur-xl shadow-xl shadow-black/20"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="relative">
                <div
                  class="absolute inset-0 rounded-xl bg-teal-500/30 blur-lg"
                />
                <div
                  class="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-teal-400 to-emerald-500 shadow-lg"
                >
                  <Sparkles class="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <p
                  class="text-sm font-bold uppercase tracking-[0.2em] bg-linear-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent"
                >
                  {{ locale.t("brand.name") }}
                </p>
                <p class="text-xs text-slate-400">
                  {{ locale.t("brand.tagline") }}
                </p>
              </div>
            </div>
            <div
              class="hidden items-center gap-6 text-sm font-medium text-slate-300 lg:flex"
            >
              <a
                href="#features"
                class="transition-colors hover:text-teal-300"
                >{{ locale.t("nav.features") }}</a
              >
              <a
                href="#how"
                class="transition-colors hover:text-teal-300"
                >{{ locale.t("nav.how") }}</a
              >
              <a
                href="#pricing"
                class="transition-colors hover:text-teal-300"
                >{{ locale.t("nav.pricing") }}</a
              >
            </div>
            <div class="flex items-center gap-3">
              <select
                class="rounded-full border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 cursor-pointer hover:bg-slate-800 transition-all backdrop-blur"
                :value="locale.locale"
                @change="onLocaleChange"
              >
                <option value="en-CA">{{ locale.t("locale.english") }}</option>
                <option value="fr-CA">{{ locale.t("locale.french") }}</option>
              </select>
              <RouterLink
                to="/login"
                class="hidden sm:inline-flex rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/10 hover:border-white/20"
              >
                {{ locale.t("cta.login") }}
              </RouterLink>
              <RouterLink
                :to="primaryLink"
                class="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-teal-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition duration-150 hover:brightness-110"
              >
                {{
                  auth.isAuthenticated
                    ? locale.t("cta.dashboard")
                    : locale.t("cta.start")
                }}
                <Rocket class="h-4 w-4" />
              </RouterLink>
            </div>
          </div>
        </header>

        <!-- Hero Section -->
        <section class="mt-6">
          <div class="relative">
            <div
              class="absolute -top-4 -left-4 rounded-full bg-teal-500/20 blur-3xl px-6 py-20"
            />
            <div
              class="relative rounded-3xl border border-white/8 bg-linear-to-br from-slate-900/90 to-slate-950/90 shadow-xl shadow-black/30 backdrop-blur-sm px-10 py-20"
            >
              <div
                class="grid gap-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
              >
                <div>
                  <div
                    class="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300 backdrop-blur"
                  >
                    <Zap class="h-3.5 w-3.5" />
                    {{ locale.t("hero.badge") }}
                  </div>
                  <h1
                    class="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
                  >
                    {{ locale.t("hero.title") }}
                  </h1>
                  <p
                    class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base"
                  >
                    {{ locale.t("hero.subtitle") }}
                  </p>
                  <div class="mt-6 flex flex-col gap-2.5 sm:flex-row">
                    <RouterLink
                      :to="primaryLink"
                      class="group inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-teal-500 to-emerald-500 px-6 py-3 font-semibold text-white shadow-md shadow-teal-500/25 transition hover:brightness-110"
                    >
                      {{ locale.t("cta.launch") }}
                      <ArrowRight
                        class="h-4 w-4 transition-transform group-hover:translate-x-1"
                      />
                    </RouterLink>
                    <a
                      href="#features"
                      class="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 font-medium text-slate-200 transition hover:bg-white/10"
                    >
                      {{ locale.t("nav.features") }}
                    </a>
                  </div>
                  <div class="mt-7 grid grid-cols-3 gap-2.5">
                    <div
                      v-for="stat in stats"
                      :key="stat.labelKey"
                      class="rounded-xl border border-white/6 bg-white/3 p-3 text-center transition hover:bg-white/6"
                    >
                      <component
                        :is="stat.icon"
                        class="mx-auto h-5 w-5 text-teal-400 mb-2"
                      />
                      <p
                        class="text-xs uppercase tracking-wider text-slate-400"
                      >
                        {{ locale.t(stat.labelKey) }}
                      </p>
                      <p class="mt-1 text-lg font-bold text-white">
                        {{ locale.t(stat.valueKey) }}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                      <div
                        class="h-2 w-2 rounded-full bg-emerald-400"
                      />
                      <p
                        class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
                      >
                        {{ locale.t("banner.preview") }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1 text-xs text-slate-500">
                      <MessageSquare class="h-3 w-3" />
                      <span>{{ locale.t("banner.assistant") }}</span>
                    </div>
                  </div>
                  <div class="space-y-3 rounded-2xl bg-slate-950/50 p-4">
                    <div class="flex gap-3 max-w-[85%]">
                      <div
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700"
                      >
                        <Users class="h-3.5 w-3.5 text-slate-300" />
                      </div>
                      <div
                        class="rounded-2xl rounded-bl-md bg-slate-800 px-4 py-2.5 text-sm text-slate-200"
                      >
                        {{ locale.t("banner.msg1") }}
                      </div>
                    </div>
                    <div class="flex gap-3 justify-end">
                      <div
                        class="rounded-2xl rounded-br-md bg-linear-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm text-white shadow-md"
                      >
                        {{ locale.t("banner.msg2") }}
                      </div>
                      <div
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/20"
                      >
                        <Bot class="h-3.5 w-3.5 text-teal-300" />
                      </div>
                    </div>
                    <div class="flex gap-3 max-w-[85%]">
                      <div
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700"
                      >
                        <Users class="h-3.5 w-3.5 text-slate-300" />
                      </div>
                      <div
                        class="rounded-2xl rounded-bl-md bg-slate-800 px-4 py-2.5 text-sm text-slate-200"
                      >
                        {{ locale.t("banner.msg3") }}
                      </div>
                    </div>
                  </div>
                  <div
                    class="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                  >
                    <Languages class="h-4 w-4 text-emerald-400" />
                    <p class="text-xs font-medium text-emerald-300">
                      {{ locale.t("banner.regionalApplied") }}
                      <span class="font-mono">fr-CA</span>,
                      {{ locale.t("banner.province") }}
                      <span class="font-mono">QC</span>, timezone
                      {{ locale.t("banner.timezone") }}
                      <span class="font-mono">America/Montreal</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Features Section -->
        <section id="features" class="mt-16 scroll-mt-20">
          <div class="text-center mb-12">
            <p
              class="text-sm font-semibold uppercase tracking-[0.3em] text-teal-400"
            >
              {{ locale.t("home.modules") }}
            </p>
            <h2
              class="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              {{ locale.t("home.modulesTitle") }}
            </h2>
            <p class="mt-4 text-slate-400 max-w-2xl mx-auto">
              {{ locale.t("home.modulesSubtitle") }}
            </p>
          </div>
          <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="feature in features"
              :key="feature.titleKey"
              class="group relative rounded-2xl border border-white/6 bg-linear-to-br from-slate-900/80 to-slate-950/80 p-6 transition hover:border-teal-500/30 hover:shadow-lg hover:shadow-teal-500/10"
            >
              <div
                class="absolute inset-0 rounded-2xl bg-linear-to-br opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none"
                :class="feature.gradient"
              />
              <div class="relative">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-teal-500/20 to-emerald-500/20 text-teal-300 transition-transform group-hover:scale-105"
                >
                  <component :is="feature.icon" class="h-6 w-6" />
                </div>
                <h3 class="mt-5 text-lg font-semibold text-white">
                  {{ locale.t(feature.titleKey) }}
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-slate-400">
                  {{ locale.t(feature.descriptionKey) }}
                </p>
              </div>
            </article>
          </div>
        </section>

        <!-- How It Works Section -->
        <section id="how" class="mt-16 scroll-mt-20">
          <div class="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <div
              class="rounded-3xl border border-white/8 bg-linear-to-br from-slate-900/80 to-slate-950/80 p-7 backdrop-blur-sm"
            >
              <div class="flex items-center gap-2 mb-6">
                <LayoutGrid class="h-5 w-5 text-teal-400" />
                <p
                  class="text-sm font-semibold uppercase tracking-[0.2em] text-teal-400"
                >
                  {{ locale.t("nav.how") }}
                </p>
              </div>
              <div class="space-y-4">
                <div
                  v-for="step in howItWorks"
                  :key="step.step"
                  class="group rounded-xl border border-white/6 bg-white/2 p-5 transition hover:border-teal-500/30 hover:bg-white/4"
                >
                  <div class="flex items-start gap-4">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-sm font-bold text-teal-300"
                    >
                      {{ step.step }}
                    </div>
                    <div>
                      <h3 class="font-semibold text-white">
                        {{ locale.t(step.titleKey) }}
                      </h3>
                      <p class="mt-1 text-sm text-slate-400">
                        {{ locale.t(step.descriptionKey) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="rounded-3xl border border-white/8 bg-linear-to-br from-slate-900/80 to-slate-950/80 p-7 backdrop-blur-sm"
            >
              <div class="flex items-center gap-2 mb-6">
                <Star class="h-5 w-5 text-teal-400" />
                <p
                  class="text-sm font-semibold uppercase tracking-[0.2em] text-teal-400"
                >
                  {{ locale.t("outcomes.title") }}
                </p>
              </div>
              <ul class="space-y-3">
                <li
                  v-for="outcome in outcomes"
                  :key="outcome"
                  class="flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/3"
                >
                  <CheckCircle2 class="h-5 w-5 text-teal-400 shrink-0" />
                  <span class="text-slate-300">{{ locale.t(outcome) }}</span>
                </li>
              </ul>
              <RouterLink
                :to="primaryLink"
                class="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-teal-500 to-emerald-500 px-5 py-3 font-semibold text-white shadow-md shadow-teal-500/25 transition hover:brightness-110"
              >
                <Rocket class="h-4 w-4" />
                {{ locale.t("cta.tryDashboard") }}
              </RouterLink>
            </div>
          </div>
        </section>

        <!-- Pricing Section -->
        <section id="pricing" class="mt-16 scroll-mt-20">
          <div class="text-center mb-12">
            <p
              class="text-sm font-semibold uppercase tracking-[0.3em] text-teal-400"
            >
              {{ locale.t("nav.pricing") }}
            </p>
            <h2
              class="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              {{ locale.t("pricing.title") }}
            </h2>
            <p class="mt-4 text-slate-400 max-w-2xl mx-auto">
              {{ locale.t("pricing.subtitle") }}
            </p>
          </div>
          <div class="grid gap-5 md:grid-cols-3">
            <article
              v-for="plan in pricing"
              :key="plan.nameKey"
              class="relative rounded-2xl border p-6 transition hover:shadow-lg"
              :class="
                plan.featured
                  ? 'border-teal-500/30 bg-linear-to-br from-teal-500/10 to-emerald-500/10 shadow-lg shadow-teal-500/20'
                  : 'border-white/6 bg-slate-900/80 hover:border-teal-500/20'
              "
            >
              <div
                v-if="plan.featured"
                class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-teal-500 to-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-md"
              >
                {{ locale.t("pricing.mostPopular") }}
              </div>
              <h3 class="text-xl font-bold text-white">
                {{ locale.t(plan.nameKey) }}
              </h3>
              <div class="mt-4 flex items-baseline gap-1">
                <span class="text-4xl font-bold text-white">{{
                  plan.price || locale.t("pricing.custom")
                }}</span>
                <span class="text-slate-400">{{
                  plan.periodKey ? locale.t(plan.periodKey) : ""
                }}</span>
              </div>
              <p class="mt-3 text-sm text-slate-400">
                {{ locale.t(plan.descriptionKey) }}
              </p>
              <RouterLink
                :to="primaryLink"
                class="mt-6 inline-flex w-full items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-all"
                :class="
                  plan.featured
                    ? 'border-teal-400/30 bg-teal-500 text-white hover:bg-teal-600'
                    : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                "
              >
                {{ locale.t("cta.getStarted") }}
              </RouterLink>
            </article>
          </div>
        </section>

        <!-- Footer -->
        <footer
          class="mt-16 rounded-3xl border border-white/6 bg-slate-900/50 px-8 py-8 backdrop-blur-sm"
        >
          <div
            class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div class="flex items-center gap-2">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-teal-500 to-emerald-500"
                >
                  <Sparkles class="h-4 w-4 text-white" />
                </div>
                <p class="text-sm font-semibold text-white">
                  {{ locale.t("brand.name") }}
                </p>
              </div>
              <p class="mt-2 text-xs text-slate-500">
                © {{ new Date().getFullYear() }} {{ locale.t("footer.rights") }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-6 text-sm">
              <a
                href="#features"
                class="text-slate-400 transition-all hover:text-teal-300"
                >{{ locale.t("nav.features") }}</a
              >
              <a
                href="#pricing"
                class="text-slate-400 transition-all hover:text-teal-300"
                >{{ locale.t("nav.pricing") }}</a
              >
              <RouterLink
                to="/login"
                class="text-slate-400 transition-all hover:text-teal-300"
                >{{ locale.t("cta.login") }}</RouterLink
              >
              <RouterLink
                :to="primaryLink"
                class="rounded-full bg-linear-to-r from-teal-500 to-emerald-500 px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110"
              >
                {{
                  auth.isAuthenticated
                    ? locale.t("cta.dashboard")
                    : locale.t("cta.start")
                }}
              </RouterLink>
            </div>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>
