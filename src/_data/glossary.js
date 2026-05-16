export default [
  {
    term: "Ready to Assign",
    key: "ready-to-assign",
    body: "Money you have received but not yet given a job. It comes from inflow transactions you marked as ready-to-assign and any unassigned balance carrying over from prior months.",
  },
  {
    term: "Assigned",
    key: "assigned",
    body: "The dollar amount you have committed to a category for the current month. Assigning does not move money between accounts — it just labels intent.",
  },
  {
    term: "Activity",
    key: "activity",
    body: "The sum of spending in a category during the current month. Inflow transactions to a category show as positive activity.",
  },
  {
    term: "Available",
    key: "available",
    body: "What is left in a category after subtracting activity from assigned and adding any carry-in from the previous month.",
  },
  {
    term: "Carry-over",
    key: "carry-over",
    body: "The available balance in a category at month-end rolls into the same category's starting balance next month. Negative available in an on-budget category does not roll; it reduces next month's Ready to Assign.",
  },
  {
    term: "On-budget account",
    key: "on-budget-account",
    body: "An account whose balance contributes to Ready to Assign. Checking, savings, cash, and credit cards are typically on-budget.",
  },
  {
    term: "Tracking account",
    key: "tracking-account",
    body: "An account whose balance counts toward net worth but not toward Ready to Assign. Investments, home value, vehicles, mortgages, and loans are tracking accounts.",
  },
  {
    term: "Reconciliation",
    key: "reconciliation",
    body: "The process of matching your Project Budget account balance to the balance shown by the bank or card issuer. Reconciled transactions are locked to prevent edits.",
  },
  {
    term: "Split transaction",
    key: "split",
    body: "A single transaction whose amount is divided across two or more categories — for example, a grocery store run that included household supplies.",
  },
  {
    term: "Transfer",
    key: "transfer",
    body: "A movement of money between two of your own accounts. Transfers are entered once and Project Budget creates the matching entry in the other account.",
  },
  {
    term: "Goal",
    key: "goal",
    body: "A target you set on a category — either a fixed monthly amount, a balance to reach by a date, a refill amount each month, or a top-up that adds on top of last month's rollover.",
  },
  {
    term: "Credit card payment category",
    key: "credit-card-payment-category",
    body: "Created automatically with every credit card account. As you spend against the card, an equal amount moves from the spent category into this one — so the cash is set aside to pay the bill.",
  },
];
