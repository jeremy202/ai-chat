<script setup lang="ts">
import { Copy, ShieldCheck, Sparkles } from "lucide-vue-next";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import DashboardFrame from "../../components/dashboard/DashboardFrame.vue";
import { useDashboardOps } from "../../composables/useDashboardOps";
import { useLocaleStore } from "../../stores/locale";

const router = useRouter();
const dashboard = useDashboardOps();
const locale = useLocaleStore();

onMounted(async () => {
  await dashboard.initialize(router, { sections: ["widget"] });
});
</script>

<template>
  <DashboardFrame
    :title="locale.t('dashboard.widget.title')"
    :subtitle="locale.t('dashboard.widget.subtitle')"
    :business-name="dashboard.business?.name ?? 'Dashboard'"
    :loading="dashboard.loading"
    :error="dashboard.error"
    :success="dashboard.success"
    @refresh="dashboard.loadData({ sections: ['widget'] })"
    @logout="dashboard.logout(router)"
  >
    <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-slate-400">{{ locale.t("dashboard.widget.kicker") }}</p>
          <h2 class="mt-1 text-xl font-semibold text-white">{{ locale.t("dashboard.widget.heading") }}</h2>
        </div>
        <Sparkles class="h-5 w-5 text-teal-300" />
      </div>
      <p class="mt-3 text-sm text-slate-300">
        {{ locale.t("dashboard.widget.description") }}
      </p>
      <div class="mt-4 rounded-xl border border-white/10 bg-slate-950 p-3">
        <pre class="overflow-x-auto whitespace-pre-wrap text-xs text-cyan-100">{{ dashboard.widgetSnippet }}</pre>
      </div>
      <button
        type="button"
        class="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        @click="dashboard.copySnippet"
      >
        <Copy class="h-4 w-4" />
        {{ locale.t("dashboard.widget.copy") }}
      </button>
    </article>

    <article class="mt-4 rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/10 via-slate-900 to-indigo-500/10 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-teal-300/80">{{ locale.t("dashboard.widget.architecture") }}</p>
          <h2 class="mt-1 text-xl font-semibold text-white">{{ locale.t("dashboard.widget.production") }}</h2>
        </div>
        <ShieldCheck class="h-5 w-5 text-teal-300" />
      </div>
      <ul class="mt-4 space-y-2 text-sm text-slate-300">
        <li>{{ locale.t("dashboard.widget.arch1") }}</li>
        <li>{{ locale.t("dashboard.widget.arch2") }}</li>
        <li>{{ locale.t("dashboard.widget.arch3") }}</li>
        <li>{{ locale.t("dashboard.widget.arch4") }}</li>
        <li>{{ locale.t("dashboard.widget.arch5") }}</li>
      </ul>
    </article>

    <article class="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-slate-400">WhatsApp for your business users</p>
          <h2 class="mt-1 text-xl font-semibold text-white">Per-business WhatsApp setup</h2>
        </div>
        <span
          class="rounded-full px-3 py-1 text-xs font-semibold"
          :class="
            dashboard.whatsappConfigured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
          "
        >
          {{ dashboard.whatsappConfigured ? "Configured" : "Not configured" }}
        </span>
      </div>

      <p class="mt-3 text-sm text-slate-300">
        Each business can connect their own WhatsApp Cloud account. Use this webhook URL in Meta:
      </p>
      <div class="mt-3 rounded-xl border border-white/10 bg-slate-950 p-3">
        <code class="break-all text-xs text-cyan-100">{{ dashboard.whatsappWebhookUrl }}</code>
      </div>

      <form class="mt-4 grid gap-3 md:grid-cols-2" @submit.prevent="dashboard.saveWhatsAppConfig">
        <label class="block text-xs text-slate-400 md:col-span-2">
          Verify token
          <input
            v-model="dashboard.whatsappForm.verifyToken"
            type="text"
            class="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
            placeholder="your verify token"
          />
        </label>
        <label class="block text-xs text-slate-400">
          Phone number ID
          <input
            v-model="dashboard.whatsappForm.phoneNumberId"
            type="text"
            class="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
            placeholder="Meta phone number ID"
          />
        </label>
        <label class="block text-xs text-slate-400">
          Access token
          <input
            v-model="dashboard.whatsappForm.accessToken"
            type="password"
            class="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-400"
            placeholder="WhatsApp Cloud API access token"
          />
        </label>
        <div class="md:col-span-2">
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="dashboard.savingWhatsAppConfig"
          >
            {{ dashboard.savingWhatsAppConfig ? "Saving..." : "Save WhatsApp settings" }}
          </button>
        </div>
      </form>
    </article>
  </DashboardFrame>
</template>
