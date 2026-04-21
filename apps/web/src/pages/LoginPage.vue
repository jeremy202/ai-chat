<script setup lang="ts">
import { ArrowLeft, Lock, Mail } from "lucide-vue-next";
import { signInWithEmailAndPassword } from "firebase/auth";
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { authApi } from "../services/api";
import { firebaseAuth } from "../services/firebase";
import { useAuthStore } from "../stores/auth";
import { useLocaleStore } from "../stores/locale";

const router = useRouter();
const auth = useAuthStore();
const locale = useLocaleStore();

const form = reactive({
  email: "",
  password: "",
});

const isSubmitting = ref(false);
const error = ref("");

async function handleSubmit() {
  isSubmitting.value = true;
  error.value = "";

  try {
    const credentials = await signInWithEmailAndPassword(firebaseAuth, form.email, form.password);
    const idToken = await credentials.user.getIdToken(true);
    const { data } = await authApi.firebaseLogin({ idToken });
    auth.setSession(data);
    await router.push("/dashboard");
  } catch (submissionError) {
    error.value = "Unable to log in with those credentials.";
    console.error(submissionError);
  } finally {
    isSubmitting.value = false;
  }
}

function onLocaleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  locale.applyLocale(target.value === "fr-CA" ? "fr-CA" : "en-CA");
}
</script>

<template>
  <div class="app-shell flex items-center justify-center px-4 py-10 sm:px-6">
    <div class="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section class="glass-card hidden p-8 lg:flex lg:flex-col lg:justify-between">
        <div>
          <RouterLink class="inline-flex items-center gap-2 text-sm font-medium text-slate-400" to="/">
            <ArrowLeft class="h-4 w-4" />
            Back to product overview
          </RouterLink>
          <h1 class="mt-8 text-4xl font-semibold tracking-tight text-white">
            Welcome back to your bookings inbox.
          </h1>
          <p class="mt-4 max-w-lg text-base leading-7 text-slate-300">
            Review AI conversations, qualify leads, and hand off important guests to your team from
            one hospitality-focused dashboard.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-400">Knowledge-driven answers</p>
            <p class="mt-2 text-lg font-semibold text-white">Built from your rooms, rates, and policies</p>
          </div>
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-400">Lead routing</p>
            <p class="mt-2 text-lg font-semibold text-white">Know when a guest is ready to book</p>
          </div>
        </div>
      </section>

      <section class="glass-card p-8 sm:p-10">
        <p class="text-sm font-semibold uppercase tracking-[0.25em] text-teal-300">Log in</p>
        <div class="mt-3">
          <select class="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200" :value="locale.locale" @change="onLocaleChange">
            <option value="en-CA">{{ locale.t("locale.english") }}</option>
            <option value="fr-CA">{{ locale.t("locale.french") }}</option>
          </select>
        </div>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-white">
          {{ locale.t("auth.welcomeBack") }}
        </h2>
        <p class="mt-3 text-slate-300">
          Sign in to update your widget, knowledge base, and guest conversations.
        </p>

        <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
              <Mail class="h-4 w-4" />
              Business email
            </span>
            <input v-model="form.email" class="input-field" type="email" placeholder="owner@maplestay.ca" />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
              <Lock class="h-4 w-4" />
              Password
            </span>
            <input
              v-model="form.password"
              class="input-field"
              type="password"
              placeholder="Enter your password"
            />
          </label>

          <p v-if="error" class="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {{ error }}
          </p>

          <button
            class="pill-button w-full bg-linear-to-r from-teal-500 to-emerald-500 py-3 text-white shadow-[0_16px_30px_-20px_rgba(45,212,191,0.9)] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSubmitting"
            type="submit"
          >
            {{ isSubmitting ? "Signing in..." : "Log in to dashboard" }}
          </button>
        </form>

        <p class="mt-6 text-sm text-slate-400">
          Need an account?
          <RouterLink class="font-medium text-teal-300 hover:text-teal-200" to="/signup">Create your workspace</RouterLink>
        </p>
      </section>
    </div>
  </div>
</template>
