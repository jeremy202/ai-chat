<script setup lang="ts">
import { ArrowLeft, Lock, Mail } from "lucide-vue-next";
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { authApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();

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
    const { data } = await authApi.login(form);
    auth.setSession(data);
    await router.push("/dashboard");
  } catch (submissionError) {
    error.value = "Unable to log in with those credentials.";
    console.error(submissionError);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="app-shell flex items-center justify-center px-4 py-10 sm:px-6">
    <div class="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section class="glass-card hidden p-8 lg:flex lg:flex-col lg:justify-between">
        <div>
          <RouterLink class="inline-flex items-center gap-2 text-sm font-medium text-slate-500" to="/">
            <ArrowLeft class="h-4 w-4" />
            Back to product overview
          </RouterLink>
          <h1 class="mt-8 text-4xl font-semibold tracking-tight text-slate-950">
            Welcome back to your bookings inbox.
          </h1>
          <p class="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Review AI conversations, qualify leads, and hand off important guests to your team from
            one hospitality-focused dashboard.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-500">Knowledge-driven answers</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">Built from your rooms, rates, and policies</p>
          </div>
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-500">Lead routing</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">Know when a guest is ready to book</p>
          </div>
        </div>
      </section>

      <section class="glass-card p-8 sm:p-10">
        <p class="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">Log in</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Manage your AI Concierge Assistant
        </h2>
        <p class="mt-3 text-slate-600">
          Sign in to update your widget, knowledge base, and guest conversations.
        </p>

        <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail class="h-4 w-4" />
              Business email
            </span>
            <input v-model="form.email" class="input-field" type="email" placeholder="owner@maplestay.ca" />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
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

          <p v-if="error" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ error }}
          </p>

          <button
            class="pill-button w-full bg-slate-950 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSubmitting"
            type="submit"
          >
            {{ isSubmitting ? "Signing in..." : "Log in to dashboard" }}
          </button>
        </form>

        <p class="mt-6 text-sm text-slate-500">
          Need an account?
          <RouterLink class="font-medium text-teal-700" to="/signup">Create your workspace</RouterLink>
        </p>
      </section>
    </div>
  </div>
</template>
