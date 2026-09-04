/**
 * The help content itself, one entry per module.
 *
 * Every step, article and FAQ answer below describes a control that exists in
 * this build — the audit that produced them walked the actual views, not a
 * feature list. Adding a module means adding one object here; nothing else in
 * the help system needs to change.
 *
 * `target` selectors prefer hooks that already existed (the sidebar's `#nav-*`
 * ids, `aria-label`s, input placeholders) and otherwise use the `data-help-target`
 * attribute added to the primary action of each module.
 */
import { adminPaths } from "@/lib/admin-routes";
import type { HelpGuide } from "./types";

/** Selector for an element tagged with `data-help-target`. */
const t = (name: string) => `[data-help-target="${name}"]`;

export const helpGuides: HelpGuide[] = [
  // ---------------------------------------------------------------- Dashboard
  {
    id: "dashboard",
    module: "Dashboard",
    title: "Dashboard Guide",
    path: adminPaths.dashboard,
    icon: "fa-chart-pie",
    summary:
      "Read the day's key numbers for members, attendance, classes and revenue, and jump to the module behind each one.",
    steps: [
      {
        title: "Read the headline metrics",
        body: "The top row shows active members, revenue, staff attendance and today's classes. Each card links to the module the number comes from.",
        target: t("dashboard-kpis"),
      },
      {
        title: "Check the expiry alert",
        body: "When memberships are due to expire in the next 5 days, a yellow banner appears above the metrics. Click View Data to open Memberships filtered to those members.",
        target: t("dashboard-expiry-alert"),
      },
      {
        title: "Open the detailed breakdown",
        body: "Use the breakdown toggle to expand member status, staff attendance and class statistics side by side.",
        target: t("dashboard-breakdown-toggle"),
      },
      {
        title: "Review recent activity",
        body: "The lower panels list the latest payments and today's class schedule so you can spot problems without leaving the page.",
      },
      {
        title: "Navigate to a module",
        body: "Every card and panel header links through to the full module. Use the sidebar for anything not shown on the dashboard.",
        target: "#nav-dashboard",
      },
    ],
    articles: [
      {
        slug: "read-the-dashboard",
        title: "Understand the dashboard metrics",
        summary: "What each dashboard card counts and where the number comes from.",
        steps: [
          "Open Dashboard from the sidebar.",
          "Read the top row for active members, revenue, staff attendance and today's classes.",
          "Expand the breakdown section for member status, staff attendance and class statistics.",
          "Click any card to open the module the figure is drawn from.",
        ],
        keywords: ["metrics", "kpi", "overview", "statistics", "revenue", "home"],
      },
      {
        slug: "act-on-expiring-memberships",
        title: "Act on expiring memberships",
        summary: "Find members whose membership ends within five days and follow up.",
        steps: [
          "Open Dashboard.",
          "Look for the Upcoming Expiry Alert banner near the top of the page.",
          "Click View Data to open Memberships.",
          "Contact or renew each member from the member detail view.",
        ],
        keywords: ["expiry", "expiring", "renewal", "alert", "churn"],
      },
    ],
    faq: [
      {
        question: "Why does the revenue card show a dash?",
        answer:
          "Revenue is only visible to Superadmin accounts. Other roles see a dash in place of the figure.",
      },
    ],
  },

  // -------------------------------------------------------------------- Members
  {
    id: "members",
    module: "Memberships",
    title: "Memberships Guide",
    path: adminPaths.members,
    icon: "fa-users",
    summary:
      "Search member records, register new members, and review or edit membership status, credits and home club.",
    steps: [
      {
        title: "Choose which members to list",
        body: "The All Data Member and Active Member tabs switch the table between every record and members with a live membership.",
        target: t("members-tabs"),
      },
      {
        title: "Find a member",
        body: "Type a name, member code, email or phone into Magic search. Matching members appear in a dropdown as you type.",
        target: 'input[placeholder="Magic search member..."]',
      },
      {
        title: "Read the member row",
        body: "Each row shows the plan, remaining credits, drop-in visits, membership status and payment status. Click a column header to sort by it.",
      },
      {
        title: "Edit a member",
        body: "Click Edit on the row to correct personal details, change the home club, or change the assigned membership plan, then save.",
      },
      {
        title: "Register a new member",
        body: "New members are registered at the counter. Open Front Desk POS and use Quick Register in the customer panel.",
      },
      {
        title: "Export the list",
        body: "Export downloads the members currently shown as an .xlsx file, using the filters and search you have applied.",
        target: t("members-export"),
      },
    ],
    articles: [
      {
        slug: "add-a-member",
        title: "Register a new member",
        summary: "Create a member account from the front desk POS.",
        steps: [
          "Open Front Desk POS from the sidebar.",
          "Select the branch you are working from.",
          "Click Quick Register in the customer panel.",
          "Enter the phone number, email and full name.",
          "Click Register & Select.",
          "Sell the member a membership plan from the catalog to activate their membership.",
        ],
        keywords: ["new member", "register", "sign up", "create member", "customer", "quick register"],
      },
      {
        slug: "search-for-a-member",
        title: "Search for a member",
        summary: "Use Magic search to find a member by name, code, email or phone.",
        steps: [
          "Open Memberships.",
          "Click the Magic search box.",
          "Type any part of the member's name, member code, email or phone number.",
          "Select the member from the results dropdown.",
        ],
        keywords: ["find member", "lookup", "magic search", "member code"],
      },
      {
        slug: "edit-member-details",
        title: "Edit a member's details",
        summary: "Update personal information or change the assigned membership plan.",
        steps: [
          "Open Memberships and find the member.",
          "Click Edit on the member's row.",
          "Update the personal details, home club or membership plan.",
          "Click Save changes.",
        ],
        keywords: ["update member", "change plan", "correct details"],
      },
      {
        slug: "review-membership-status",
        title: "Review membership status and credits",
        summary: "Check whether a membership is active and how many credits remain.",
        steps: [
          "Open Memberships.",
          "Read the Status column for the membership state.",
          "Read the Credits and Drop In Credit columns for the remaining balance.",
          "Switch to the Active Member tab to hide expired records.",
        ],
        keywords: ["status", "credits", "expired", "active", "balance", "drop in credit"],
      },
      {
        slug: "export-members",
        title: "Export the member list",
        summary: "Download the current member list as a spreadsheet.",
        steps: [
          "Open Memberships.",
          "Apply any search or tab filter you want reflected in the file.",
          "Click Export.",
          "The .xlsx file downloads to your browser.",
        ],
        keywords: ["export", "download", "xlsx", "excel", "spreadsheet", "report"],
      },
    ],
    faq: [
      {
        question: "How do I create a new member?",
        answer:
          "Members are registered at the till. Open Front Desk POS, use Quick Register in the customer panel, then sell them a membership plan.",
        articleRef: "members/add-a-member",
      },
    ],
  },

  // ------------------------------------------------------------ Membership plans
  {
    id: "membership-plans",
    module: "Membership Plans",
    title: "Membership Plans Guide",
    path: adminPaths.membershipPlans,
    icon: "fa-ticket-alt",
    summary:
      "Define the plans members can buy: price, validity, class credits, PT sessions and whether the plan sells as a drop in.",
    steps: [
      {
        title: "Browse existing plans",
        body: "The table lists every plan with its price, validity in days and credit allowance. Use the status filter to show only active or inactive plans.",
        target: t("plans-filter"),
      },
      {
        title: "Search for a plan",
        body: "Type into the search box to narrow the list by plan name.",
        target: 'input[placeholder="Search membership plans..."]',
      },
      {
        title: "Create a new plan",
        body: "Click Create New Plan and fill in the plan name, price, validity in days and credits.",
        target: t("plans-create"),
      },
      {
        title: "Set the plan category",
        body: "Plan Category controls how the POS sells the plan. Enter \"Drop In\", \"Drop In Single\" or \"Drop In Pass\" to make it appear as a drop in product.",
      },
      {
        title: "Configure classes and PT",
        body: "Set the class credits, or mark the plan unlimited. Include PT sessions when the plan bundles personal training.",
      },
      {
        title: "Save and verify",
        body: "Save the plan, then confirm it appears in the list as Active so the POS and member registration can use it.",
      },
    ],
    articles: [
      {
        slug: "create-a-membership-plan",
        title: "Create a membership plan",
        summary: "Add a new plan that members and the POS can buy.",
        steps: [
          "Open Membership Plans from the sidebar.",
          "Click Create New Plan.",
          "Enter the plan name and price.",
          "Set Validity (Days).",
          "Set the class credits, or mark the plan as unlimited classes.",
          "Enter a Plan Category, and include PT sessions if the plan bundles them.",
          "Click Save.",
        ],
        keywords: ["new plan", "create plan", "pricing", "package", "membership"],
      },
      {
        slug: "sell-a-plan-as-drop-in",
        title: "Make a plan sell as a drop in",
        summary: "Set the plan category so the POS lists the plan as a drop in product.",
        steps: [
          "Open Membership Plans and edit the plan.",
          "Set Plan Category to \"Drop In\", \"Drop In Single\" or \"Drop In Pass\".",
          "Set Credits to the number of visits the pass grants.",
          "Save the plan.",
          "Open the POS catalog and confirm the plan appears under drop in products.",
        ],
        keywords: ["drop in", "dropin", "visit pass", "single visit", "category"],
      },
      {
        slug: "edit-or-deactivate-a-plan",
        title: "Edit or deactivate a plan",
        summary: "Change a plan's pricing, or take it off sale without deleting it.",
        steps: [
          "Open Membership Plans.",
          "Find the plan and click Edit.",
          "Change the price, validity or credits as needed.",
          "Clear the active flag to take the plan off sale.",
          "Click Save.",
        ],
        keywords: ["edit plan", "deactivate", "retire plan", "price change", "inactive"],
      },
    ],
    faq: [
      {
        question: "Why does a plan not appear in the POS?",
        answer:
          "The POS only lists active plans. Check the plan is marked Active, and that a branch is selected in the POS — the catalog is filtered per branch.",
      },
    ],
  },

  // -------------------------------------------------------------- Class schedule
  {
    id: "class-schedule",
    module: "Class Schedule",
    title: "Class Schedule Guide",
    path: adminPaths.classes,
    icon: "fa-calendar-alt",
    summary:
      "Create and manage class schedules, assign coaches, control capacity, and record attendance for each session.",
    steps: [
      {
        title: "Switch between calendar and table",
        body: "The calendar shows the week or month at a glance; the table lists every schedule with its capacity and booking count.",
        target: t("classes-view-toggle"),
      },
      {
        title: "Add a new class",
        body: "Click Create New Class to open the schedule form.",
        target: t("classes-create"),
      },
      {
        title: "Choose the class and branch",
        body: "Enter the class name and pick a branch. Only active branches can be selected.",
      },
      {
        title: "Assign a coach and time",
        body: "Select the coach, then set the class date, start time and end time.",
      },
      {
        title: "Set capacity and workout",
        body: "Set the capacity, and use the workout field to describe the session — warm up, strength, conditioning and cool down.",
      },
      {
        title: "Repeat the class if needed",
        body: "Use the recurrence fields to repeat the class weekly or daily until a chosen date. Each occurrence is created as its own schedule.",
      },
      {
        title: "Search and filter the list",
        body: "Filter by date or location, or search by class name, to find a schedule quickly.",
        target: 'input[placeholder="Search class schedules..."]',
      },
      {
        title: "Manage a class",
        body: "Row actions open the class detail, edit it, cancel it, or delete it. Class detail is also where you activate the session and mark members present.",
      },
    ],
    articles: [
      {
        slug: "create-a-class",
        title: "Create a new class",
        summary: "Schedule a single class with a coach, time and capacity.",
        steps: [
          "Open Class Schedule from the sidebar.",
          "Click Create New Class.",
          "Enter the class name and select a branch.",
          "Select the coach.",
          "Set the class date, start time and end time.",
          "Set the capacity.",
          "Add the workout details if you want them shown on the class.",
          "Click Save.",
        ],
        keywords: ["new class", "schedule class", "add class", "create class", "session"],
      },
      {
        slug: "create-a-recurring-class",
        title: "Schedule a recurring class",
        summary: "Repeat a class on a weekly or daily pattern in one action.",
        steps: [
          "Open Class Schedule and click Create New Class.",
          "Fill in the class details as usual.",
          "In the recurrence section, choose the repeat pattern.",
          "For a weekly pattern, select the days of the week.",
          "Set the Repeat until date.",
          "Review the preview of generated dates, then click Save.",
        ],
        keywords: ["recurring", "repeat", "weekly", "series", "every week"],
      },
      {
        slug: "edit-a-class",
        title: "Edit a class",
        summary: "Change the time, coach or capacity of an existing schedule.",
        steps: [
          "Open Class Schedule.",
          "Find the class in the table or calendar.",
          "Click the Edit action on the row.",
          "Update the fields you need to change.",
          "Click Save.",
        ],
        keywords: ["change class", "reschedule", "update class", "move class"],
      },
      {
        slug: "cancel-a-class",
        title: "Cancel a class",
        summary: "Mark a scheduled class as cancelled.",
        steps: [
          "Open Class Schedule.",
          "Find the class you want to cancel.",
          "Click the Cancel Class action on the row.",
          "Confirm the cancellation.",
          "The class shows as cancelled and attendance is closed for it.",
        ],
        keywords: ["cancel", "call off", "cancelled class"],
      },
      {
        slug: "manage-class-capacity",
        title: "Manage class capacity",
        summary: "Check how full a class is and change the number of available slots.",
        steps: [
          "Open Class Schedule.",
          "Read the booked count against capacity on each row.",
          "Click Edit on the class.",
          "Change the capacity value.",
          "Click Save.",
        ],
        keywords: ["capacity", "slots", "full", "booked", "spaces", "limit"],
      },
      {
        slug: "activate-a-class-session",
        title: "Activate a class session without the coach QR",
        summary: "Turn a session on from the admin portal when the coach cannot scan.",
        steps: [
          "Open Class Schedule and open the class detail.",
          "Find the Session section.",
          "Click Activate session.",
          "Confirm the coach and class shown in the confirmation.",
          "The session becomes active and members can check in.",
        ],
        keywords: ["activate", "session", "coach scan", "qr", "check in"],
      },
      {
        slug: "record-class-attendance",
        title: "Record class attendance",
        summary: "Mark booked members present, or add a walk-in, from the class detail.",
        steps: [
          "Open Class Schedule and open the class detail.",
          "Scroll to the Members section.",
          "Click Mark present next to a member, or Mark all present for everyone booked.",
          "For someone without a booking, click Walk-in and search for the member.",
          "Click Mark present on the walk-in result — the booking is created automatically.",
        ],
        keywords: ["attendance", "present", "walk-in", "check in", "mark attendance"],
      },
    ],
    faq: [
      {
        question: "How do I schedule a class?",
        answer:
          "Open Class Schedule, click Create New Class, then set the class name, branch, coach, date, time and capacity before saving.",
        articleRef: "class-schedule/create-a-class",
      },
      {
        question: "Why can't I activate a session?",
        answer:
          "A session cannot be activated when the class is cancelled, already completed, inactive, or has no coach assigned. The class detail shows which of these applies.",
      },
    ],
  },

  // ------------------------------------------------------------------ Front desk POS
  {
    id: "pos",
    module: "Front Desk POS",
    title: "POS Guide",
    path: adminPaths.pos,
    icon: "fa-cash-register",
    summary:
      "Sell memberships, drop ins and PT packages at the counter, book classes for a member, and take payment by cash, EDC or QRIS.",
    steps: [
      {
        title: "Select a branch",
        body: "The POS waits for a branch before showing anything. The catalog, prices and payment merchant all differ per branch.",
        target: t("pos-branch-select"),
      },
      {
        title: "Select the customer",
        body: "Search by phone, email, name or member code. The customer panel then shows their membership, credits, drop-in visits and upcoming classes.",
        target: 'input[placeholder="Search by phone, email, name, or member code"]',
      },
      {
        title: "Register a new customer if needed",
        body: "If the person is not in the system, use Quick Register. Only a phone number, email and name are needed; the customer sets their own password from the mobile app.",
        target: t("pos-quick-register"),
      },
      {
        title: "Find a product",
        body: "Search the catalog, or browse the membership, drop in, PT package and class sections.",
        target: 'input[placeholder="Search memberships, PT packages, or classes"]',
      },
      {
        title: "Add items to the transaction",
        body: "Click a product card to add it. PT packages open a confirmation with the session count and price before they are added.",
        target: t("pos-catalog"),
      },
      {
        title: "Review the transaction",
        body: "The right-hand panel lists every line with its details, the subtotal and the total. Remove a line with its × button, or use Clear to empty the transaction.",
        target: t("pos-cart"),
      },
      {
        title: "Book a class",
        body: "Classes are booked directly and are not added to the cart. If the member has no valid entitlement, the POS offers a drop in you can sell on the spot.",
      },
      {
        title: "Start checkout",
        body: "Click Pay to open the payment screen with the amount due.",
        target: t("pos-checkout"),
      },
      {
        title: "Choose a payment method",
        body: "Pick cash, EDC or QRIS. A method that is switched off in Payment Method settings is shown as unavailable.",
      },
      {
        title: "Complete the payment",
        body: "For EDC, enter the reference number from the terminal slip — never card numbers, CVV or PIN. For QRIS, the POS waits for the backend to confirm the payment.",
      },
      {
        title: "Print or email the receipt",
        body: "Once every line is confirmed Paid, open the receipt to print an 80 mm slip or email it to the member.",
      },
    ],
    articles: [
      {
        slug: "start-a-transaction",
        title: "Start a POS transaction",
        summary: "Open the till, pick a branch and select the customer.",
        steps: [
          "Open Front Desk POS from the sidebar.",
          "Select the branch you are selling from.",
          "Search for the customer by phone, email, name or member code.",
          "Select the customer from the results.",
          "Review their membership and credits in the customer panel.",
        ],
        keywords: ["pos", "till", "counter", "sale", "front desk", "transaction"],
      },
      {
        slug: "add-products-to-the-cart",
        title: "Add products to the transaction",
        summary: "Put memberships, drop ins and PT packages into the cart.",
        steps: [
          "Select a customer first — the catalog will not add items without one.",
          "Search the catalog or browse the membership, drop in and PT package sections.",
          "Click a product card to add it to the transaction.",
          "For a PT package, confirm the session count and price in the dialog, then click Add to transaction.",
          "Check the lines and total in the transaction panel.",
        ],
        keywords: ["add product", "cart", "basket", "catalog", "item", "quantity"],
      },
      {
        slug: "register-a-customer-at-the-till",
        title: "Register a customer at the till",
        summary: "Create an account for a walk-in without leaving the POS.",
        steps: [
          "Open Front Desk POS and select a branch.",
          "Click Quick Register in the customer panel.",
          "Enter the phone number, email and full name.",
          "Click Register & Select.",
          "Ask the customer to set their password from the mobile app using Forgot Password.",
        ],
        keywords: ["quick register", "walk in", "new customer", "sign up at till"],
      },
      {
        slug: "process-a-payment",
        title: "Process a payment",
        summary: "Take payment by cash, EDC or QRIS and confirm it with the backend.",
        steps: [
          "Click Pay in the transaction panel.",
          "Check the amount due at the top of the payment screen.",
          "Select cash, EDC or QRIS.",
          "For EDC, enter the reference number printed on the terminal slip.",
          "For QRIS, open the QRIS page and wait for the backend to confirm the payment.",
          "Wait for every line to show as Paid before closing.",
        ],
        keywords: ["payment", "pay", "checkout", "cash", "edc", "qris", "card"],
      },
      {
        slug: "book-a-class-from-the-pos",
        title: "Book a class from the POS",
        summary: "Book a member into a class, and sell a drop in when they have no entitlement.",
        steps: [
          "Select the customer in the POS.",
          "Find the class in the Classes section of the catalog.",
          "Click the class to open the booking dialog.",
          "Click Book Class.",
          "If the member has no valid entitlement, choose a drop in option and take payment — the class is booked automatically once the payment is confirmed.",
        ],
        keywords: ["book class", "class booking", "drop in", "entitlement", "reserve"],
      },
      {
        slug: "print-or-email-a-receipt",
        title: "Print or email a receipt",
        summary: "Produce the 80 mm slip or send the receipt to the member's email.",
        steps: [
          "Complete the payment so every line shows as Paid.",
          "Click Receipt · print / email.",
          "Use your browser's print dialog for the 80 mm thermal slip.",
          "To email it, check the address shown and click Send.",
        ],
        keywords: ["receipt", "print", "email receipt", "slip", "invoice", "thermal"],
      },
      {
        slug: "handle-a-failed-pos-payment",
        title: "Handle a failed or stuck payment",
        summary: "What to do when a payment fails, times out, or a drop-in pass does not appear.",
        steps: [
          "Read the message on the failed line — it says whether a payment was created.",
          "If a payment exists, click Re-check status rather than starting again.",
          "Never repeat a payment that already shows as Paid.",
          "Open the Payments module to find the record and delete a stuck Pending invoice.",
          "For a missing drop-in pass, check the Drop In module before charging again.",
        ],
        keywords: ["failed payment", "stuck", "timeout", "pending", "retry", "duplicate charge"],
      },
    ],
    faq: [
      {
        question: "How do I process a POS transaction?",
        answer:
          "Select a branch and a customer, add products from the catalog, click Pay, choose a payment method, and wait for every line to be confirmed Paid.",
        articleRef: "pos/process-a-payment",
      },
      {
        question: "Why can't I add an item to the cart?",
        answer:
          "The POS requires a customer before any item can be added. Select or register a customer first.",
      },
      {
        question: "Why is QRIS unavailable?",
        answer:
          "QRIS is disabled when it is switched off in Payment Method settings, or when the branch has no AsteriPay merchant configuration.",
      },
    ],
  },

  // ------------------------------------------------------------- Personal training
  {
    id: "personal-training",
    module: "Personal Training",
    title: "Personal Training Guide",
    path: adminPaths.pt,
    icon: "fa-id-badge",
    summary:
      "Create PT packages, assign them to members, and schedule PT sessions with a coach and participants.",
    steps: [
      {
        title: "Switch between packages and sessions",
        body: "The PT Package tab holds the products you sell; the PT Session tab holds the scheduled sessions.",
        target: t("pt-tabs"),
      },
      {
        title: "Create a PT package",
        body: "On the PT Package tab, click Create Package and set its name, session count, price, coach and branch. Assign it to a member if it is being sold to one person.",
      },
      {
        title: "Search packages",
        body: "Use the search box to find a package by name.",
        target: 'input[placeholder="Search packages..."]',
      },
      {
        title: "Create a PT session",
        body: "On the PT Session tab, click Create Session, then choose the package, coach, branch, date and time.",
      },
      {
        title: "Add participants",
        body: "Add the members attending the session. You can also add a member to an existing session from its row.",
      },
      {
        title: "Review or cancel a session",
        body: "Expand a session row to see its participants, or cancel the session with a reason.",
      },
    ],
    articles: [
      {
        slug: "create-a-pt-package",
        title: "Create a PT package",
        summary: "Define a personal training package with its session count and price.",
        steps: [
          "Open Personal Training from the sidebar.",
          "Stay on the PT Package tab.",
          "Click Create Package.",
          "Enter the package name, session count and price.",
          "Select the coach and branch.",
          "Assign the package to a member if it is sold to one person.",
          "Click Save.",
        ],
        keywords: ["pt package", "personal training", "sessions", "trainer package"],
      },
      {
        slug: "schedule-a-pt-session",
        title: "Schedule a PT session",
        summary: "Book a coach, time and participants for a personal training session.",
        steps: [
          "Open Personal Training and switch to the PT Session tab.",
          "Click Create Session.",
          "Select the PT package.",
          "Select the coach and branch.",
          "Set the date and time.",
          "Add the members attending.",
          "Click Save.",
        ],
        keywords: ["pt session", "book trainer", "schedule pt", "one to one"],
      },
      {
        slug: "add-a-participant-to-a-pt-session",
        title: "Add a participant to a PT session",
        summary: "Put another member into a session that already exists.",
        steps: [
          "Open Personal Training and go to the PT Session tab.",
          "Find the session and expand its row.",
          "Click the add participant action.",
          "Search for and select the member.",
          "Confirm to add them to the session.",
        ],
        keywords: ["participant", "add member", "attendee", "pt session"],
      },
      {
        slug: "cancel-a-pt-session",
        title: "Cancel a PT session",
        summary: "Cancel a scheduled session and record the reason.",
        steps: [
          "Open Personal Training and go to the PT Session tab.",
          "Find the session you want to cancel.",
          "Click the cancel action.",
          "Enter the cancellation reason — it is required.",
          "Confirm the cancellation.",
        ],
        keywords: ["cancel pt", "cancel session", "reason"],
      },
      {
        slug: "sell-a-pt-package-at-the-till",
        title: "Sell a PT package at the till",
        summary: "Charge a member for a PT package through the POS.",
        steps: [
          "Open Front Desk POS and select the branch and customer.",
          "Find the package in the PT Package section of the catalog.",
          "Packages already assigned to the customer appear at the top.",
          "Click the package and confirm the session count and price.",
          "Click Add to transaction, then take payment as usual.",
        ],
        keywords: ["sell pt", "pt payment", "charge package", "pos pt"],
      },
    ],
  },

  // ---------------------------------------------------------------------- Payments
  {
    id: "payments",
    module: "Payments",
    title: "Payments Guide",
    path: adminPaths.payments,
    icon: "fa-credit-card",
    summary:
      "Review every payment recorded by the system, inspect invoices, and record a payment manually.",
    steps: [
      {
        title: "Browse payments",
        body: "The table lists payments newest first with the member, item, amount, method and status.",
      },
      {
        title: "Search for a payment",
        body: "Search by invoice number or plan name to find a specific record.",
        target: 'input[placeholder="Search invoice / plan..."]',
      },
      {
        title: "Open grouped invoices",
        body: "A single POS transaction can create several invoices. Click View invoices on a group to see each one.",
      },
      {
        title: "Inspect a payment",
        body: "The detail action shows the full record, including the transaction reference and the payment status reported by the backend.",
      },
      {
        title: "Filter by status",
        body: "The tabs across the top filter the list by payment status, so you can isolate pending or failed records.",
        target: t("payments-tabs"),
      },
      {
        title: "Export the list",
        body: "Export downloads the payments currently listed as an .xlsx file.",
      },
    ],
    articles: [
      {
        slug: "find-a-payment",
        title: "Find a payment or invoice",
        summary: "Locate a payment record by invoice number or plan.",
        steps: [
          "Open Payments from the sidebar.",
          "Type the invoice number or plan name into the search box.",
          "Click View invoices to expand a grouped transaction.",
          "Click the detail action to open the full record.",
        ],
        keywords: ["invoice", "find payment", "search payment", "receipt", "transaction"],
      },
      {
        slug: "export-payments",
        title: "Export the payment list",
        summary: "Download the payments currently listed as a spreadsheet.",
        steps: [
          "Open Payments from the sidebar.",
          "Select the status tab you want to export.",
          "Apply a search term if you need to narrow the list further.",
          "Click Export.",
          "The .xlsx file downloads to your browser.",
        ],
        keywords: ["export payments", "download", "xlsx", "finance", "reconcile"],
      },
      {
        slug: "clear-a-stuck-pending-payment",
        title: "Clear a stuck pending payment",
        summary: "Remove a Pending invoice left behind by a failed POS attempt.",
        steps: [
          "Open Payments.",
          "Search for the invoice number shown in the POS error.",
          "Open the record and confirm it is still Pending and not Paid.",
          "Delete the pending record.",
          "Return to the POS and take the payment again.",
        ],
        keywords: ["pending", "stuck", "failed", "delete payment", "duplicate"],
      },
    ],
    faq: [
      {
        question: "Why does one sale show several invoices?",
        answer:
          "The backend records one payment per purchased item, so a membership sold with a PT package produces two invoices under one transaction. Use View invoices to see them.",
      },
    ],
  },

  // ---------------------------------------------------------------- Payment methods
  {
    id: "payment-methods",
    module: "Payment Method",
    title: "Payment Methods Guide",
    path: adminPaths.paymentMethods,
    icon: "fa-wallet",
    summary:
      "Control which payment methods the POS offers at the counter.",
    steps: [
      {
        title: "Review the methods",
        body: "The table lists every payment method the backend knows about, with its current active state.",
      },
      {
        title: "Enable or disable a method",
        body: "Toggle a method to change whether it can be selected during POS checkout.",
      },
      {
        title: "Verify in the POS",
        body: "A disabled method still appears in the POS payment screen but is greyed out and cannot be chosen.",
      },
    ],
    articles: [
      {
        slug: "enable-a-payment-method",
        title: "Enable or disable a payment method",
        summary: "Choose which methods staff can take at the till.",
        steps: [
          "Open Payment Method from the sidebar.",
          "Find the method in the table.",
          "Toggle its status.",
          "Open the POS payment screen to confirm the change.",
        ],
        keywords: ["payment method", "enable", "disable", "qris", "edc", "cash", "toggle"],
      },
    ],
  },

  // ----------------------------------------------------------------------- Drop In
  {
    id: "drop-in",
    module: "Drop In",
    title: "Drop In Guide",
    path: adminPaths.dropIn,
    icon: "fa-door-open",
    summary:
      "Review the drop-in passes members have bought, including remaining visits and expiry.",
    steps: [
      {
        title: "Browse drop-in passes",
        body: "The table lists each pass with its member, purchase date, expiry and status.",
      },
      {
        title: "Search for a pass",
        body: "Search by member name, member code or branch to find a specific pass.",
        target: 'input[placeholder="Search member / code / branch..."]',
      },
      {
        title: "Open pass details",
        body: "Use Detail to see the full pass record, including how many visits remain.",
      },
      {
        title: "Export the list",
        body: "Export downloads the passes currently listed as an .xlsx file.",
        target: t("dropin-export"),
      },
    ],
    articles: [
      {
        slug: "check-a-drop-in-pass",
        title: "Check a member's drop-in pass",
        summary: "Confirm a pass was issued and see how many visits are left.",
        steps: [
          "Open Drop In from the sidebar.",
          "Search for the member by name, code or branch.",
          "Open the pass with the Detail action.",
          "Check the remaining visits, the expiry date and the pass status.",
        ],
        keywords: ["drop in", "pass", "visits", "expiry", "verify pass"],
      },
      {
        slug: "sell-a-drop-in",
        title: "Sell a drop in",
        summary: "Take payment for a single visit or a multi-visit pass at the till.",
        steps: [
          "Open Front Desk POS and select the branch and customer.",
          "Find the drop in product in the catalog, or book a class and accept the drop-in offer.",
          "Add it to the transaction and take payment.",
          "Check the Drop In module to confirm the pass was issued.",
        ],
        keywords: ["sell drop in", "single visit", "day pass", "casual"],
      },
    ],
    faq: [
      {
        question: "A payment is Paid but no drop-in pass appears. What now?",
        answer:
          "Do not charge again. Check the Drop In module first — the pass can take a moment to appear. If it still does not show, report the invoice number rather than repeating the payment.",
      },
    ],
  },

  // --------------------------------------------------------------- Attendance reports
  {
    id: "reports",
    module: "Attendance Reports",
    title: "Attendance Reports Guide",
    path: adminPaths.reports,
    icon: "fa-clipboard-check",
    summary:
      "Review staff clock-in and clock-out records, filter by staff member, and export the results.",
    steps: [
      {
        title: "Choose the staff filter",
        body: "Use the staff selector to narrow the report to one person, or leave it on All Staff.",
        target: t("reports-staff-filter"),
      },
      {
        title: "Refresh the data",
        body: "Refresh re-reads the attendance records from the backend.",
        target: t("reports-refresh"),
      },
      {
        title: "Read the records",
        body: "Each row shows the staff member, the clock-in and clock-out times and the recorded status.",
      },
      {
        title: "View the attendance photo",
        body: "Where a photo was captured at clock-in, View Photo opens it.",
      },
      {
        title: "Export the report",
        body: "Export report (all) downloads every record; Export per staff downloads just the selected staff member and needs one selected first.",
        target: t("reports-export"),
      },
    ],
    articles: [
      {
        slug: "review-staff-attendance",
        title: "Review staff attendance",
        summary: "Check who clocked in, when, and whether they were on time.",
        steps: [
          "Open Attendance Reports from the sidebar.",
          "Select a staff member, or leave the filter on All Staff.",
          "Click Refresh to load the latest records.",
          "Read the clock-in and clock-out times and the status on each row.",
        ],
        keywords: ["attendance", "clock in", "clock out", "staff", "late", "report"],
      },
      {
        slug: "export-an-attendance-report",
        title: "Export an attendance report",
        summary: "Download staff attendance as a spreadsheet.",
        steps: [
          "Open Attendance Reports.",
          "Click Export report (all) to download every attendance record.",
          "To export one person, select them in the staff filter first.",
          "Click Export per staff.",
          "The file downloads to your browser.",
        ],
        keywords: ["export", "download", "payroll", "timesheet", "xlsx"],
      },
    ],
  },

  // ----------------------------------------------------------------------- History
  {
    id: "history",
    module: "History",
    title: "History Guide",
    path: adminPaths.history,
    icon: "fa-history",
    summary:
      "Look up a coach's attendance record or a member's booking history, and export either.",
    steps: [
      {
        title: "Choose what to look up",
        body: "Switch between the Coach Attendance and Member Booking tabs.",
        target: t("history-tabs"),
      },
      {
        title: "Select a coach",
        body: "On Coach Attendance, search for and select a coach to load their records.",
        target: 'input[placeholder="Search and select a coach..."]',
      },
      {
        title: "Select a member",
        body: "On Member Booking, search for and select a member to see every class they booked.",
        target: 'input[placeholder="Search and select a member..."]',
      },
      {
        title: "Read the records",
        body: "Bookings show the class, date and whether the booking was attended or cancelled.",
      },
      {
        title: "Export the history",
        body: "Export downloads the records currently shown as a spreadsheet.",
      },
    ],
    articles: [
      {
        slug: "view-member-booking-history",
        title: "View a member's booking history",
        summary: "See every class a member booked and whether they attended.",
        steps: [
          "Open History from the sidebar.",
          "Switch to the Member Booking tab.",
          "Search for and select the member.",
          "Review the class, date and booking status on each row.",
          "Click Export to download the list.",
        ],
        keywords: ["booking history", "member history", "attended", "past classes"],
      },
      {
        slug: "view-coach-attendance-history",
        title: "View a coach's attendance history",
        summary: "Check the sessions a coach has recorded.",
        steps: [
          "Open History.",
          "Stay on the Coach Attendance tab.",
          "Search for and select the coach.",
          "Review the attendance records listed.",
          "Click Export to download the list.",
        ],
        keywords: ["coach history", "coach attendance", "trainer record"],
      },
    ],
  },

  // --------------------------------------------------------------- User management
  {
    id: "users",
    module: "User Management",
    title: "User Management Guide",
    path: adminPaths.users,
    icon: "fa-user-shield",
    summary:
      "Create and manage staff and coach accounts, set their role and branch, and control account status.",
    steps: [
      {
        title: "Choose staff or coach",
        body: "The Staff and Coach tabs switch between the two account types. Each tab has its own list and its own create form.",
        target: t("users-tabs"),
      },
      {
        title: "Add an account",
        body: "Click Add Staff or Add Coach to open the create form for the tab you are on.",
        target: t("users-add"),
      },
      {
        title: "Set the role and branch",
        body: "Select a role and a home branch. The role list is filtered to roles valid for the tab.",
      },
      {
        title: "Search the list",
        body: "Search by name or email to find an existing account.",
        target: 'input[placeholder="Search by name / email..."]',
      },
      {
        title: "Edit or deactivate",
        body: "Open an account to edit its details, or use the power control on the row to switch it active or inactive.",
      },
    ],
    articles: [
      {
        slug: "add-a-staff-account",
        title: "Add a staff account",
        summary: "Create a login for a front desk or admin user.",
        steps: [
          "Open User Management from the sidebar.",
          "Stay on the Staff tab.",
          "Click Add Staff.",
          "Enter the name, email and phone number.",
          "Select the role and branch.",
          "Click Create user.",
        ],
        keywords: ["add user", "staff account", "new login", "role", "admin account"],
      },
      {
        slug: "add-a-coach-account",
        title: "Add a coach account",
        summary: "Create a coach who can be assigned to classes and PT sessions.",
        steps: [
          "Open User Management and switch to the Coach tab.",
          "Click Add Coach.",
          "Enter the coach's details and select their branch.",
          "Click Create user.",
          "The coach becomes selectable in Class Schedule and Personal Training.",
        ],
        keywords: ["coach", "trainer", "instructor", "add coach"],
      },
      {
        slug: "deactivate-an-account",
        title: "Activate or deactivate an account",
        summary: "Switch an account off without deleting it.",
        steps: [
          "Open User Management.",
          "Find the account in the Staff or Coach list.",
          "Use the power control on the row to toggle the status.",
          "An inactive coach no longer appears in coach selectors.",
        ],
        keywords: ["deactivate", "disable user", "suspend", "activate", "power"],
      },
      {
        slug: "edit-a-staff-record",
        title: "Edit a staff or coach record",
        summary: "Correct the details on an existing account.",
        steps: [
          "Open User Management.",
          "Search for the account by name or email.",
          "Click Edit on the row.",
          "Update the details, role or branch.",
          "Click Save changes.",
        ],
        keywords: ["edit user", "change role", "update staff", "correct details"],
      },
    ],
  },

  // ---------------------------------------------------------------- Barcode scanner
  {
    id: "scan",
    module: "Barcode Scanner",
    title: "Barcode Scanner Guide",
    path: adminPaths.scan,
    icon: "fa-qrcode",
    summary:
      "Check members in with a hardware QR scanner, or enter a scan value by hand.",
    steps: [
      {
        title: "Watch the scanner status",
        body: "The banner at the top shows whether the page is ready to receive a scan, processing one, or reporting a failure.",
        target: t("scan-status"),
      },
      {
        title: "Scan a code",
        body: "Point the QR scanner at a member, coach or PT session code. The fields below fill in automatically.",
      },
      {
        title: "Enter a value manually",
        body: "If there is no scanner, type the value straight into the field and click Send scan.",
        target: 'input[aria-label="Scan value"]',
      },
      {
        title: "Read the result",
        body: "The result panel shows what the backend made of the scan, including the member and the class it was applied to.",
      },
    ],
    articles: [
      {
        slug: "check-in-a-member-by-qr",
        title: "Check a member in by QR code",
        summary: "Use the hardware scanner to record attendance at the door.",
        steps: [
          "Open Barcode Scanner from the sidebar.",
          "Wait for the status banner to read Ready to receive a scan.",
          "Point the scanner at the member's QR code.",
          "Read the result panel to confirm the check-in was accepted.",
        ],
        keywords: ["scan", "qr", "check in", "door", "barcode", "attendance"],
      },
      {
        slug: "enter-a-scan-manually",
        title: "Enter a scan value manually",
        summary: "Record a check-in when the scanner is unavailable.",
        steps: [
          "Open Barcode Scanner.",
          "Type the scan value into the field.",
          "For a class check-in, enter the class schedule id as well.",
          "Click Send scan.",
          "Read the result panel to confirm the outcome.",
        ],
        keywords: ["manual scan", "type code", "no scanner", "member code"],
      },
    ],
  },

  // ----------------------------------------------------------------- Webcam scanner
  {
    id: "scan-camera",
    module: "Webcam Scanner",
    title: "Webcam Scanner Guide",
    path: adminPaths.scanCamera,
    icon: "fa-camera",
    summary:
      "Use the device camera to read member, coach and PT session QR codes when no hardware scanner is available.",
    steps: [
      {
        title: "Start the camera",
        body: "Click Start camera and allow the browser's camera permission prompt.",
        target: t("scan-camera-start"),
      },
      {
        title: "Hold the code in view",
        body: "Point the camera at the QR code. A code held in front of the camera is only sent once, so it will not check the same person in repeatedly.",
      },
      {
        title: "Read the last scan",
        body: "The Last scan panel shows the decoded value and what the backend did with it.",
      },
      {
        title: "Stop the camera",
        body: "Click Stop camera when you are done to release the device.",
      },
    ],
    articles: [
      {
        slug: "use-the-webcam-scanner",
        title: "Use the webcam scanner",
        summary: "Scan QR codes with the device camera instead of a hardware scanner.",
        steps: [
          "Open Webcam Scanner from the sidebar.",
          "Click Start camera and allow camera access.",
          "Hold the member's QR code in front of the camera.",
          "Read the Last scan panel to confirm the result.",
          "Click Stop camera when finished.",
        ],
        keywords: ["webcam", "camera", "qr", "scan", "check in"],
      },
    ],
    faq: [
      {
        question: "The camera will not start. Why?",
        answer:
          "Browsers only allow camera access on a secure origin. Open the portal over https, or from http://localhost, and allow the camera permission when prompted.",
      },
    ],
  },

  // ------------------------------------------------------------------ Promo banners
  {
    id: "promo-banners",
    module: "Promo Banners",
    title: "Promo Banners Guide",
    path: adminPaths.promoBanners,
    icon: "fa-bullhorn",
    summary:
      "Publish the promotional banners shown in the member mobile app.",
    steps: [
      {
        title: "Review existing banners",
        body: "The list shows each banner with its image and status. Use the status filter to show only active or inactive banners.",
        target: t("banners-filter"),
      },
      {
        title: "Create a banner",
        body: "Click Create New Banner and upload the artwork.",
        target: t("banners-create"),
      },
      {
        title: "Use the recommended size",
        body: "A 3:1 image at the recommended dimensions displays best in the app. Other sizes are accepted.",
      },
      {
        title: "Set the status",
        body: "Only active banners are shown to members. Set the status before saving.",
      },
      {
        title: "Manage a banner",
        body: "Use Detail, Edit and Delete on a row to inspect, change or remove a banner.",
      },
    ],
    articles: [
      {
        slug: "create-a-promo-banner",
        title: "Create a promo banner",
        summary: "Publish a new promotional banner to the member app.",
        steps: [
          "Open Promo Banners from the sidebar.",
          "Click Create New Banner.",
          "Enter the banner title.",
          "Upload the image, ideally at a 3:1 ratio.",
          "Set the banner active.",
          "Click Save.",
        ],
        keywords: ["banner", "promo", "promotion", "marketing", "app banner", "image"],
      },
      {
        slug: "edit-or-remove-a-banner",
        title: "Edit or remove a banner",
        summary: "Change a banner's artwork, or take it down.",
        steps: [
          "Open Promo Banners.",
          "Click Edit on the banner to change its title, image or status.",
          "Leave the image field empty to keep the existing artwork.",
          "Click Save, or use Delete to remove the banner entirely.",
        ],
        keywords: ["edit banner", "delete banner", "take down", "replace image"],
      },
    ],
  },

  // ---------------------------------------------------------------- System settings
  {
    id: "system-settings",
    module: "System Settings",
    title: "System Settings Guide",
    path: adminPaths.systemSettings,
    icon: "fa-cog",
    summary:
      "Edit the backend configuration values that drive drop-in pricing and other system behaviour.",
    steps: [
      {
        title: "Review the settings",
        body: "Each row shows a setting key, its current value and a description of what it controls.",
      },
      {
        title: "Find the setting you need",
        body: "Drop-in pricing uses keys such as DROP_IN_SINGLE_<BRANCH>, with matching visit-count and validity keys.",
      },
      {
        title: "Edit a value",
        body: "Click Edit on the row, change the value, and save. The POS reads these values directly.",
        target: t("settings-table"),
      },
      {
        title: "Verify the change",
        body: "Open the POS and check the drop-in price shown for the branch matches what you set.",
      },
    ],
    articles: [
      {
        slug: "change-a-system-setting",
        title: "Change a system setting",
        summary: "Edit a configuration value used by the portal and POS.",
        steps: [
          "Open System Settings from the sidebar.",
          "Find the setting by its key.",
          "Click Edit on the row.",
          "Enter the new value.",
          "Click Save.",
        ],
        keywords: ["settings", "configuration", "config", "system", "value", "key"],
      },
      {
        slug: "configure-drop-in-pricing",
        title: "Configure drop-in pricing",
        summary: "Set the price, visit count and validity for drop ins at a branch.",
        steps: [
          "Open System Settings.",
          "Find the price key for the branch, for example DROP_IN_SINGLE_KEDOYA.",
          "Edit the price value.",
          "For a multi-visit pass, set the matching visits key to the number of visits.",
          "Set the validity key to the number of days the pass stays valid.",
          "Open the POS for that branch and confirm the drop-in option appears with the right price.",
        ],
        keywords: ["drop in price", "pricing", "branch price", "visits", "validity", "tariff"],
      },
    ],
    faq: [
      {
        question: "Why does the POS say drop in is not configured for a branch?",
        answer:
          "The branch has no matching price key in System Settings. Add a key that names the branch, for example DROP_IN_SINGLE_<BRANCH>, with a valid price.",
        articleRef: "system-settings/configure-drop-in-pricing",
      },
    ],
  },

  // ---------------------------------------------------------------- Coaches payroll
  {
    id: "payroll",
    module: "Coaches Payroll",
    title: "Coaches Payroll Guide",
    path: adminPaths.payroll,
    icon: "fa-file-invoice-dollar",
    summary:
      "Review what each coach has earned from the classes and sessions they have taught.",
    steps: [
      {
        title: "Check your access",
        body: "Payroll is restricted to Superadmin accounts. Other roles see an access notice instead of the table.",
      },
      {
        title: "Read the payroll table",
        body: "Each row shows a coach with their session count and calculated payroll figure.",
      },
      {
        title: "Sort the results",
        body: "Click a column header to sort the table by that column.",
      },
    ],
    articles: [
      {
        slug: "review-coach-payroll",
        title: "Review coach payroll",
        summary: "See what each coach has earned over the period.",
        steps: [
          "Sign in with a Superadmin account.",
          "Open Coaches Payroll.",
          "Read the session count and payroll figure for each coach.",
          "Click a column header to sort the list.",
        ],
        keywords: ["payroll", "coach pay", "earnings", "salary", "commission", "finance"],
      },
    ],
    faq: [
      {
        question: "Why can't I see the payroll page?",
        answer:
          "Payroll is limited to Superadmin accounts. Ask a Superadmin to review the figures, or to change your role.",
      },
    ],
  },
];
