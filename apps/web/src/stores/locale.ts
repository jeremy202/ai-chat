import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { translate, type Locale } from "../i18n";

const STORAGE_KEY = "ai-concierge-locale";

export const useLocaleStore = defineStore("locale", () => {
  const locale = ref<Locale>("en-CA");

  const isFrench = computed(() => locale.value === "fr-CA");

  function applyLocale(next: Locale) {
    locale.value = next;
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }

  function initialize() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en-CA" || saved === "fr-CA") {
      applyLocale(saved);
      return;
    }
    applyLocale("en-CA");
  }

  function t(key: string) {
    return translate(locale.value, key);
  }

  return {
    locale,
    isFrench,
    initialize,
    applyLocale,
    t,
  };
});
