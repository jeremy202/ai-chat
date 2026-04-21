<script setup lang="ts">
import { ArrowLeft, Building2, Globe, Lock, Mail, UserRound } from "lucide-vue-next";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { AxiosError } from "axios";
import { authApi } from "../services/api";
import { firebaseAuth } from "../services/firebase";
import { useAuthStore } from "../stores/auth";
import { useLocaleStore } from "../stores/locale";

const router = useRouter();
const auth = useAuthStore();
const locale = useLocaleStore();

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

type FirebaseAuthError = Error & { code?: string };

async function handleSubmit() {
  isSubmitting.value = true;
  error.value = "";

  try {
    let credentials;
    try {
      credentials = await createUserWithEmailAndPassword(firebaseAuth, form.email, form.password);
      await updateProfile(credentials.user, { displayName: form.name });
    } catch (firebaseError) {
      const authError = firebaseError as FirebaseAuthError;
      if (authError.code === "auth/email-already-in-use") {
        // Recovery path: existing Firebase user but no app workspace yet.
        credentials = await signInWithEmailAndPassword(firebaseAuth, form.email, form.password);
      } else {
        throw firebaseError;
      }
    }

    if (!credentials) {
      throw new Error("Unable to establish a Firebase session.");
    }

    await updateProfile(credentials.user, { displayName: form.name });
    let data;
    try {
      const idToken = await credentials.user.getIdToken(true);
      const signupResponse = await authApi.firebaseSignup({
        idToken,
        businessName: form.businessName,
        businessEmail: form.businessEmail,
        websiteUrl: form.websiteUrl,
        name: form.name,
      });
      data = signupResponse.data;
    } catch (apiError) {
      const axiosError = apiError as AxiosError<{ error?: string }>;
      if (axiosError.response?.status === 409) {
        const idToken = await credentials.user.getIdToken(true);
        const loginResponse = await authApi.firebaseLogin({ idToken });
        data = loginResponse.data;
      } else {
        throw apiError;
      }
    }

    auth.setSession(data);
    await router.push("/dashboard");
  } catch (submissionError) {
    error.value = "Unable to create your workspace. Check the form details and try again.";
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
  <div class="app-shell px-4 py-10 sm:px-6">
    <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section class="glass-card p-8">
        <RouterLink class="inline-flex items-center gap-2 text-sm font-medium text-slate-400" to="/">
          <ArrowLeft class="h-4 w-4" />
          Back to product overview
        </RouterLink>
        <h1 class="mt-8 text-4xl font-semibold tracking-tight text-white">
          Launch your concierge in under five minutes.
        </h1>
        <p class="mt-4 text-base leading-7 text-slate-300">
          Create your hospitality workspace, upload your room and policy knowledge, then embed the
          widget on your website with one script.
        </p>

        <div class="mt-8 space-y-4">
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-400">Step 1</p>
            <p class="mt-1 text-lg font-semibold text-white">Create your property workspace</p>
          </div>
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-400">Step 2</p>
            <p class="mt-1 text-lg font-semibold text-white">Add FAQs, rates, and room details</p>
          </div>
          <div class="soft-panel p-5">
            <p class="text-sm text-slate-400">Step 3</p>
            <p class="mt-1 text-lg font-semibold text-white">Install the widget and capture leads</p>
          </div>
        </div>
      </section>

      <section class="glass-card p-8 sm:p-10">
        <p class="text-sm font-semibold uppercase tracking-[0.25em] text-teal-300">Create workspace</p>
        <div class="mt-3">
          <select class="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200" :value="locale.locale" @change="onLocaleChange">
            <option value="en-CA">{{ locale.t("locale.english") }}</option>
            <option value="fr-CA">{{ locale.t("locale.french") }}</option>
          </select>
        </div>
        <h2 class="mt-4 text-3xl font-semibold tracking-tight text-white">
          {{ locale.t("auth.createAccount") }}
        </h2>
        <form class="mt-8 grid gap-5 sm:grid-cols-2" @submit.prevent="handleSubmit">
          <label class="block sm:col-span-2">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
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
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
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
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
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
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
              <UserRound class="h-4 w-4" />
              Your name
            </span>
            <input v-model="form.name" class="input-field" type="text" placeholder="Jordan Lee" />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
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
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
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
            class="sm:col-span-2 rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200"
          >
            {{ error }}
          </p>

          <button
            class="pill-button sm:col-span-2 w-full bg-linear-to-r from-teal-500 to-emerald-500 py-3 text-white shadow-[0_16px_30px_-20px_rgba(45,212,191,0.9)] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSubmitting"
            type="submit"
          >
            {{ isSubmitting ? "Creating workspace..." : "Create AI Concierge workspace" }}
          </button>
        </form>

        <p class="mt-6 text-sm text-slate-400">
          Already have an account?
          <RouterLink class="font-medium text-teal-300 hover:text-teal-200" to="/login">Log in</RouterLink>
        </p>
      </section>
    </div>
  </div>
</template>
