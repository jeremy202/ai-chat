<script setup lang="ts">
import { ArrowLeft, Building2, Globe, Lock, Mail, UserRound } from "lucide-vue-next";
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { authApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();

const form = reactive({
  businessName: "",
  businessEmail: "",
  websiteUrl: "",
  name: "",
  email: "",
  password: "",
});

const isSubmitting = ref(false);
const error = ref("");

async function handleSubmit() {
  isSubmitting.value = true;
  error.value = "";

  try {
    const { data } = await authApi.signup(form);
    auth.setSession(data);
    await router.push("/dashboard");
  } catch (submissionError) {
    error.value = "Unable to create your workspace. Check the form details and try again.";
    console.error(submissionError);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="app-shell px-4 py-10 sm:px-6">
    <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section class="glass-card p-8">
        <RouterLink class="inline-flex items-center gap-2 text-sm font-medium text-slate-500" to="/">
          <ArrowLeft class="h-4 w-4" />
          Back to product overview
        </RouterLink>
        <h1 class="mt-8 text-4xl font-semibold tracking-tight text-slate-950">
          Launch your concierge in under five minutes.
        </h1>
        <p class="mt-4 text-base leading-7 text-slate-600">
          Create your hospitality workspace, upload your room and policy knowledge, then embed the
          widget on your website with one script.
        </p>

        <div class="mt-8 space-y-4">
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-500">Step 1</p>
            <p class="mt-1 text-lg font-semibold text-slate-950">Create your property workspace</p>
          </div>
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-500">Step 2</p>
            <p class="mt-1 text-lg font-semibold text-slate-950">Add FAQs, rates, and room details</p>
          </div>
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-500">Step 3</p>
            <p class="mt-1 text-lg font-semibold text-slate-950">Install the widget and capture leads</p>
          </div>
        </div>
      </section>

      <section class="glass-card p-8 sm:p-10">
        <p class="text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">Create workspace</p>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Build your AI booking assistant
        </h2>
        <form class="mt-8 grid gap-5 sm:grid-cols-2" @submit.prevent="handleSubmit">
          <label class="block sm:col-span-2">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Building2 class="h-4 w-4" />
              Business name
            </span>
            <input
              v-model="form.businessName"
              class="input-field"
              type="text"
              placeholder="Maple Harbour Hotel"
            />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail class="h-4 w-4" />
              Business email
            </span>
            <input
              v-model="form.businessEmail"
              class="input-field"
              type="email"
              placeholder="stay@mapleharbour.ca"
            />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Globe class="h-4 w-4" />
              Website URL
            </span>
            <input
              v-model="form.websiteUrl"
              class="input-field"
              type="url"
              placeholder="https://mapleharbour.ca"
            />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <UserRound class="h-4 w-4" />
              Your name
            </span>
            <input v-model="form.name" class="input-field" type="text" placeholder="Jordan Lee" />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail class="h-4 w-4" />
              Login email
            </span>
            <input
              v-model="form.email"
              class="input-field"
              type="email"
              placeholder="owner@mapleharbour.ca"
            />
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Lock class="h-4 w-4" />
              Password
            </span>
            <input
              v-model="form.password"
              class="input-field"
              type="password"
              placeholder="Minimum 8 characters"
            />
          </label>

          <p
            v-if="error"
            class="sm:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {{ error }}
          </p>

          <button
            class="pill-button sm:col-span-2 w-full bg-slate-950 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSubmitting"
            type="submit"
          >
            {{ isSubmitting ? "Creating workspace..." : "Create AI Concierge workspace" }}
          </button>
        </form>

        <p class="mt-6 text-sm text-slate-500">
          Already have an account?
          <RouterLink class="font-medium text-teal-700" to="/login">Log in</RouterLink>
        </p>
      </section>
    </div>
  </div>
</template>
