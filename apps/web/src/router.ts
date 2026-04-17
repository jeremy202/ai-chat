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
import DashboardSupportAgentPage from "./pages/dashboard/SupportAgentPage.vue";
import DashboardShiftsPage from "./pages/dashboard/ShiftsPage.vue";
import DashboardInternalAssistantPage from "./pages/dashboard/InternalAssistantPage.vue";
import DashboardAutomationsPage from "./pages/dashboard/AutomationsPage.vue";
import DashboardReportsPage from "./pages/dashboard/ReportsPage.vue";
import DashboardRegionalPage from "./pages/dashboard/RegionalPage.vue";

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
      path: "/dashboard/support-agent",
      name: "dashboard-support-agent",
      component: DashboardSupportAgentPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/shifts",
      name: "dashboard-shifts",
      component: DashboardShiftsPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/internal-assistant",
      name: "dashboard-internal-assistant",
      component: DashboardInternalAssistantPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/automations",
      name: "dashboard-automations",
      component: DashboardAutomationsPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/reports",
      name: "dashboard-reports",
      component: DashboardReportsPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/dashboard/regional",
      name: "dashboard-regional",
      component: DashboardRegionalPage,
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
