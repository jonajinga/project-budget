export default {
  main: [
    { label: "Open the app", url: "/app/", cta: true },
    { label: "Features", url: "/#features" },
    { label: "Docs", url: "/docs/" },
    { label: "Blog", url: "/blog/" },
    { label: "Glossary", url: "/glossary/" },
    { label: "Open source", url: "/open-source/" },
  ],
  /* App nav is a list of sections; each section has a label + items.
     The sidebar renders each section as a collapsible group whose
     state persists per-section in localStorage. Each item carries a
     Lucide-style inline SVG path; the template wraps it in a 16x16
     stroke-2 SVG so every icon shares geometry. */
  app: [
    {
      section: "Daily",
      key: "daily",
      items: [
        { label: "Dashboard", url: "/app/",
          icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a1 1 0 0 1-1-1v-6a2 2 0 0 0-4 0v6a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2z"/>' },
        { label: "Budget", url: "/app/budget/",
          icon: '<path d="M6 3v18M18 3v18"/><path d="M6 8h10a2 2 0 0 1 0 4H8a2 2 0 0 0 0 4h10"/>' },
        { label: "Register", url: "/app/register/",
          icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="17" x2="15" y2="17"/>' },
        { label: "Calendar", url: "/app/calendar/",
          icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
        { label: "Quick reconcile", url: "/app/quick-reconcile/",
          icon: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
      ],
    },
    {
      section: "Data",
      key: "data",
      items: [
        { label: "Accounts", url: "/app/accounts/",
          icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none"/>' },
        { label: "Categories", url: "/app/categories/",
          icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>' },
        { label: "Payees", url: "/app/payees/",
          icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
        { label: "Recurring", url: "/app/scheduled/",
          icon: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' },
      ],
    },
    {
      section: "Insights",
      key: "insights",
      items: [
        { label: "Reports", url: "/app/reports/",
          icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/>' },
        { label: "Saved views", url: "/app/templates/",
          icon: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' },
        { label: "Audit log", url: "/app/audit-log/",
          icon: '<polyline points="12 6 12 12 16 14"/><circle cx="12" cy="12" r="9"/>' },
        { label: "Share snapshot", url: "/app/share/",
          icon: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' },
      ],
    },
    {
      section: "Profile",
      key: "profile",
      items: [
        { label: "Profiles", url: "/app/profiles/",
          icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>' },
        { label: "About this profile", url: "/app/about-this-profile/",
          icon: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' },
        { label: "Import", url: "/app/import/",
          icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
        { label: "Backup", url: "/app/backup/",
          icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l3 3 5-6"/>' },
        { label: "Trash", url: "/app/trash/",
          icon: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>' },
      ],
    },
    {
      section: "Setup",
      key: "setup",
      defaultCollapsed: true,
      items: [
        { label: "Welcome wizard", url: "/app/welcome/",
          icon: '<polyline points="20 6 9 17 4 12"/>' },
        { label: "Onboarding checklist", url: "/app/onboarding-checklist/",
          icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><polyline points="8 11 11 14 16 9"/>' },
        { label: "Health check", url: "/app/health-check/",
          icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>' },
      ],
    },
    {
      section: "Help",
      key: "help",
      defaultCollapsed: true,
      items: [
        { label: "Tools index", url: "/app/tools/",
          icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
        { label: "Keyboard shortcuts", url: "/app/shortcuts/",
          icon: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>' },
        { label: "Diagnostics", url: "/app/diagnostics/",
          icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
        { label: "Integrations", url: "/app/integrations/",
          icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
        { label: "Settings", url: "/app/settings/",
          icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
        { label: "Feedback", url: "/app/feedback/",
          icon: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
        { label: "Review", url: "/app/review/",
          icon: '<polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5 12 2"/>' },
        { label: "Contact", url: "/app/contact/",
          icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' },
      ],
    },
  ],
  /* Footer-only utility links — kept separate from nav.main so the
     header hamburger menu can render every link in a single "Project
     Budget" section without duplicates. The footer renders nav.main +
     nav.footer (the union) in one row. */
  footer: [
    { label: "About", url: "/about/" },
    { label: "Accessibility", url: "/accessibility/" },
    { label: "Style guide", url: "/style-guide/" },
    { label: "Contact", url: "/contact/" },
    { label: "Sitemap", url: "/sitemap/" },
    { label: "Privacy", url: "/privacy/" },
    { label: "Terms", url: "/terms/" },
  ],
};
