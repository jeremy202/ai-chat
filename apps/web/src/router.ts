import { createRouter, createWebHistory } from "vue-router";
import HomePage from "./pages/HomePage.vue";
import LoginPage from "./pages/LoginPage.vue";
import SignupPage from "./pages/SignupPage.vue";
import WidgetEmbedPage from "./pages/WidgetEmbedPage.vue";
import DashboardOverviewPage from "./pages/dashboard/OverviewPage.vue";
import DashboardKnowledgePage from "./pages/dashboard/KnowledgePage.vue";
import DashboardInboxPage from "./pages/dashboard/InboxPage.vue";
import DashboardBookingsPage from "./pages/dashboard/BookingsPage.vue";
import DashboardWidgetPage from "./pages/dashboard/WidgetPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage,
    },
    {
      path: "/login",
      name: "login",
      component: LoginPage,
    },
    {
      path: "/signup",
      name: "signup",
      component: SignupPage,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardOverviewPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/knowledge",
      name: "dashboard-knowledge",
      component: DashboardKnowledgePage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/inbox",
      name: "dashboard-inbox",
      component: DashboardInboxPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/bookings",
      name: "dashboard-bookings",
      component: DashboardBookingsPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/widget",
      name: "dashboard-widget",
      component: DashboardWidgetPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/widget/:slug",
      name: "widget",
      component: WidgetEmbedPage,
    },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }

  const token = localStorage.getItem("ai-concierge-token");
  if (!token) {
    return { name: "login" };
  }

  return true;
});

export default router;
