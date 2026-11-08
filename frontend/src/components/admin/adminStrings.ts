// Every label, help line and empty-state sentence on the admin dashboard lives here, in
// plain words. No jargon: a test (adminStrings.test.ts) fails if a banned word appears.

export const ADMIN_STRINGS = {
  dates: {
    today: 'Today',
    yesterday: 'Yesterday',
    last7: 'Last 7 days',
    last30: 'Last 30 days',
    thisMonth: 'This month',
    custom: 'Pick dates',
    from: 'From',
    to: 'To',
    tooLong: 'Please pick 366 days or fewer.',
    startAfterEnd: 'The start date must be on or before the end date.',
    sgt: 'SGT',
  },

  happened: {
    title: 'What happened',
    orders: 'Orders',
    ordersHelp: 'Orders placed in the chosen dates.',
    sales: 'Sales',
    salesHelp: 'Money from completed and delivered orders, kept separate per currency.',
    signUps: 'New sign-ups',
    signUpsHelp: 'People who opened an account in the chosen dates.',
    signIns: 'People who signed in',
    signInsHelp: 'How many different people signed in during the chosen dates.',
    vsBefore: 'vs the period before',
    storesTitle: 'Stores',
    storesHelp: 'Stores that took orders in the chosen dates, most sales first. Click a store to open it.',
    colStore: 'Store',
    colOrders: 'Orders',
    colSales: 'Sales',
    colLastOrder: 'Last order',
    noStores: 'No store took an order in these dates.',
    latestTitle: 'Latest orders',
    latestHelp: 'The most recent orders in the chosen dates.',
    noOrders: 'No orders in these dates.',
  },

  needsAction: {
    title: 'Needs your action',
    help: 'Things worth a look right now. Each row says what is wrong and what to do.',
    none: 'Nothing needs your action.',
    // {name} is filled in with the store or person. problem says what is wrong; action says what to do.
    rules: {
      signed_up_no_store: {
        problem: '{name} signed up more than 2 days ago but has not opened a store.',
        action: 'Reach out and help them set up their store.',
      },
      store_no_products: {
        problem: '{name} opened more than 3 days ago but has no products.',
        action: 'Nudge the owner to add their first product.',
      },
      store_no_recent_orders: {
        problem: '{name} has products but no orders in the last 7 days.',
        action: 'Check in to see if they need help getting orders.',
      },
      order_waiting: {
        problem: '{name} has an order that has waited more than a day for the store to confirm.',
        action: 'Remind the store to confirm the order.',
      },
      store_suspended: {
        problem: '{name} is suspended.',
        action: 'Review the store and lift the suspension if it is fine.',
      },
    } as Record<string, { problem: string; action: string }>,
    // Not built yet because we do not record email delivery.
    emailsNeedData: 'Failed emails are not shown yet because we do not record email delivery.',
  },

  dropOff: {
    title: 'Where people drop off',
    help: 'How far new store owners get. Click a step to see who stopped there.',
    steps: {
      signed_up: 'Signed up',
      verified: 'Confirmed email',
      created_store: 'Created a store',
      added_product: 'Added a product',
      first_order: 'Got a first order',
    } as Record<string, string>,
    dropped: 'dropped here',
    stuckEmpty: 'No one stopped at this step.',
  },

  rightNow: {
    title: 'Right now (ignores the dates)',
    help: 'Live counts that do not depend on the dates above.',
    activeStores: 'Active stores',
    suspendedStores: 'Suspended stores',
    protectedStores: 'Protected stores',
    ownersActive7: 'Owners who signed in the last 7 days',
    ownersActive30: 'Owners who signed in the last 30 days',
  },

  moreDetails: {
    title: 'More details',
    help: 'The full breakdown for people who want the numbers.',
  },

  loadError: 'Could not load the dashboard.',
  loading: 'Loading…',
} as const;

/** Words we never want to see in a label or help line, because people do not talk that way. */
export const BANNED_JARGON = ['distinct', 'snapshot', 'cohort', 'funnel', 'range', 'flags'];
