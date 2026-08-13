export type Language = 'en' | 'el'

type Translation = {
  en: string
  el: string
}

export const translations: Record<string, Translation> = {
  // Navigation
  'nav.home': { en: 'Home', el: 'Αρχική' },
  'nav.login': { en: 'Login', el: 'Σύνδεση' },
  'nav.orders': { en: 'Orders', el: 'Παραγγελίες' },
  'nav.analytics': { en: 'Analytics', el: 'Αναλύσεις' },
  'nav.setup': { en: 'Setup', el: 'Ρυθμίσεις' },
  'nav.admin': { en: 'Admin', el: 'Διαχείριση' },

  // Common
  'common.loading': { en: 'Loading...', el: 'Φόρτωση...' },
  'common.cancel': { en: 'Cancel', el: 'Ακύρωση' },
  'common.save': { en: 'Save', el: 'Αποθήκευση' },
  'common.saving': { en: 'Saving...', el: 'Αποθήκευση...' },
  'common.delete': { en: 'Delete', el: 'Διαγραφή' },
  'common.edit': { en: 'Edit', el: 'Επεξεργασία' },
  'common.dismiss': { en: 'Dismiss', el: 'Απόρριψη' },
  'common.status': { en: 'Status', el: 'Κατάσταση' },
  'common.total': { en: 'Total', el: 'Σύνολο' },
  'common.role': { en: 'Role', el: 'Ρόλος' },
  'common.added': { en: 'Added', el: 'Προστέθηκε' },

  // Order statuses
  'status.NEW': { en: 'NEW', el: 'ΝΕΑ' },
  'status.ACCEPTED': { en: 'ACCEPTED', el: 'ΑΠΟΔΕΚΤΗ' },
  'status.PREPARING': { en: 'PREPARING', el: 'ΕΤΟΙΜΑΖΕΤΑΙ' },
  'status.READY': { en: 'READY', el: 'ΕΤΟΙΜΗ' },
  'status.SERVED': { en: 'SERVED', el: 'ΕΞΥΠΗΡΕΤΗΘΗΚΕ' },
  'status.REJECTED': { en: 'REJECTED', el: 'ΑΠΟΡΡΙΦΘΗΚΕ' },
  'status.CANCELLED': { en: 'CANCELLED', el: 'ΑΚΥΡΩΘΗΚΕ' },
  'statusLabel.NEW': { en: 'Order received', el: 'Η παραγγελία λήφθηκε' },
  'statusLabel.ACCEPTED': { en: 'Restaurant accepted', el: 'Έγινε αποδεκτή' },
  'statusLabel.PREPARING': { en: 'Preparing', el: 'Ετοιμάζεται' },
  'statusLabel.READY': { en: 'Ready', el: 'Έτοιμη' },
  'statusLabel.SERVED': { en: 'Served', el: 'Εξυπηρετήθηκε' },
  'statusLabel.CANCELLED': { en: 'Cancelled', el: 'Ακυρώθηκε' },
  'statusLabel.REJECTED': { en: 'Rejected', el: 'Απορρίφθηκε' },

  // Home dashboard
  'home.eyebrow': { en: 'Home', el: 'Αρχική' },
  'home.lead': {
    en: 'Live overview of your tables, orders, and team. Head to Orders to manage order flow.',
    el: 'Ζωντανή επισκόπηση των τραπεζιών, των παραγγελιών και της ομάδας σας. Μεταβείτε στις Παραγγελίες για να διαχειριστείτε τη ροή.',
  },
  'home.liveTables': { en: 'Live tables', el: 'Ζωντανά τραπέζια' },
  'home.liveOrders': { en: 'Live orders', el: 'Ζωντανές παραγγελίες' },
  'home.team': { en: 'Team', el: 'Ομάδα' },
  'home.free': { en: 'Free', el: 'Ελεύθερο' },
  'home.occupied': { en: 'Occupied', el: 'Κατειλημμένο' },
  'home.unassigned': { en: 'Unassigned', el: 'Χωρίς ανάθεση' },
  'home.claimed': { en: 'Claimed', el: 'Δικό σας' },
  'home.claimTable': { en: 'Claim table', el: 'Ανάληψη τραπεζιού' },
  'home.handledByYou': { en: 'Handled by you', el: 'Το χειρίζεστε εσείς' },
  'home.handledBy': { en: 'Handled by', el: 'Χειρίζεται' },
  'home.staffMember': { en: 'Staff member', el: 'Μέλος προσωπικού' },
  'home.openOrders': { en: 'Open orders', el: 'Παραγγελίες' },
  'home.restaurantSetup': { en: 'Restaurant setup', el: 'Ρυθμίσεις εστιατορίου' },
  'home.noActiveTables': {
    en: 'No active tables for this restaurant.',
    el: 'Δεν υπάρχουν ενεργά τραπέζια για αυτό το εστιατόριο.',
  },
  'home.noLiveOrders': {
    en: 'No live orders right now.',
    el: 'Δεν υπάρχουν ενεργές παραγγελίες αυτή τη στιγμή.',
  },
  'home.teamRosterHidden': {
    en: 'Team roster is only visible to owners and platform admins.',
    el: 'Η ομάδα είναι ορατή μόνο στους ιδιοκτήτες και στους διαχειριστές πλατφόρμας.',
  },
  'home.manageTeam': { en: 'Manage team', el: 'Διαχείριση ομάδας' },
  'home.tableAssignmentHelper': {
    en: 'Assigning staff to a table is optional. Claim a table to show you are handling it — owners can assign any staff member from Setup.',
    el: 'Η ανάθεση προσωπικού σε τραπέζι είναι προαιρετική. Αναλάβετε ένα τραπέζι για να δείξετε ότι το χειρίζεστε — οι ιδιοκτήτες μπορούν να αναθέσουν οποιοδήποτε μέλος από τις Ρυθμίσεις.',
  },
  'home.restaurantContext': { en: 'Restaurant context', el: 'Εστιατόριο' },
  'home.table': { en: 'Table', el: 'Τραπέζι' },
  'home.loadingWorkspace': { en: 'Loading your workspace...', el: 'Φόρτωση του χώρου εργασίας...' },
  'home.claimNotice': { en: 'Table assignment updated.', el: 'Η ανάθεση τραπεζιού ενημερώθηκε.' },

  // Customer ordering
  'customer.eyebrow': { en: 'Table Ordering', el: 'Παραγγελία Τραπεζιού' },
  'customer.orderingFor': {
    en: 'You are ordering for {table}. Browse the menu, pick your options, and send your order directly to the team.',
    el: 'Παραγγέλνετε για το {table}. Περιηγηθείτε στο μενού, επιλέξτε τις επιλογές σας και στείλτε την παραγγελία σας απευθείας στην ομάδα.',
  },
  'customer.noSignIn': { en: 'No sign-in required', el: 'Χωρίς σύνδεση' },
  'customer.menu': { en: 'Menu', el: 'Μενού' },
  'customer.cart': { en: 'Cart', el: 'Καλάθι' },
  'customer.yourOrder': { en: 'Your order', el: 'Η παραγγελία σας' },
  'customer.emptyCart': { en: 'Your cart is empty.', el: 'Το καλάθι σας είναι άδειο.' },
  'customer.submitOrder': { en: 'Submit order', el: 'Υποβολή παραγγελίας' },
  'customer.submitting': { en: 'Submitting order...', el: 'Υποβολή...' },
  'customer.orderNote': { en: 'Order note', el: 'Σημείωση παραγγελίας' },
  'customer.itemNote': { en: 'Item note', el: 'Σημείωση προϊόντος' },
  'customer.allergens': { en: 'Allergens', el: 'Αλλεργιογόνα' },
  'customer.options': { en: 'Options', el: 'Επιλογές' },
  'customer.addToCart': { en: 'Add to cart', el: 'Προσθήκη στο καλάθι' },
  'customer.total': { en: 'Total', el: 'Σύνολο' },
  'customer.trackOrder': { en: 'Track order status', el: 'Παρακολούθηση παραγγελίας' },
  'customer.orderSubmitted': {
    en: 'Order {id} submitted with status {status}. Total: {total}.',
    el: 'Η παραγγελία {id} υποβλήθηκε με κατάσταση {status}. Σύνολο: {total}.',
  },
  'customer.noAvailableItems': { en: 'No available items', el: 'Δεν υπάρχουν διαθέσιμα προϊόντα' },
  'customer.categoryUnavailable': {
    en: 'This category is temporarily unavailable.',
    el: 'Αυτή η κατηγορία είναι προσωρινά μη διαθέσιμη.',
  },

  // Tracking page
  'track.eyebrow': { en: 'Order Status', el: 'Κατάσταση Παραγγελίας' },
  'track.currently': {
    en: 'Order {id} for {table} is currently {status}.',
    el: 'Η παραγγελία {id} για το {table} είναι τώρα {status}.',
  },
  'track.lastUpdated': { en: 'Last updated', el: 'Τελευταία ενημέρωση' },
  'track.refreshNow': { en: 'Refresh Now', el: 'Ανανέωση' },
  'track.refreshing': { en: 'Refreshing...', el: 'Ανανέωση...' },
  'track.servedMessage': { en: 'This order has been served.', el: 'Η παραγγελία έχει εξυπηρετηθεί.' },
  'track.terminalMessage': { en: 'This order has been {status}.', el: 'Η παραγγελία έχει {status}.' },
  'track.statusTimeline': { en: 'Status Timeline', el: 'Χρονοδιάγραμμα Κατάστασης' },
  'track.current': { en: 'current', el: 'τρέχουσα' },
  'track.history': { en: 'History', el: 'Ιστορικό' },
  'track.summary': { en: 'Summary', el: 'Περίληψη' },
  'track.quantity': { en: 'Quantity', el: 'Ποσότητα' },
  'track.note': { en: 'Note', el: 'Σημείωση' },
  'track.orderNote': { en: 'Order note', el: 'Σημείωση παραγγελίας' },
  'track.total': { en: 'Total', el: 'Σύνολο' },
  'track.splitBill': { en: 'Split the bill', el: 'Μοιρασιά λογαριασμού' },
  'track.splitHelper': {
    en: 'Divide the total equally between everyone, or assign each item to a guest. Splits are calculated on your device — no account needed.',
    el: 'Χωρίστε το σύνολο ισόποσα μεταξύ όλων ή αναθέστε κάθε προϊόν σε έναν επισκέπτη. Η μοιρασιά υπολογίζεται στη συσκευή σας — χωρίς λογαριασμό.',
  },
  'track.equal': { en: 'Equally', el: 'Ισόποσα' },
  'track.byItems': { en: 'By items', el: 'Ανά προϊόν' },
  'track.numberPeople': { en: 'Number of people', el: 'Αριθμός ατόμων' },
  'track.numberGuests': { en: 'Number of guests', el: 'Αριθμός επισκεπτών' },
  'track.person': { en: 'Person', el: 'Άτομο' },
  'track.guest': { en: 'Guest', el: 'Επισκέπτης' },
  'track.guestTotals': { en: 'Guest totals', el: 'Σύνολα επισκεπτών' },

  // Login
  'login.title': { en: 'Sign in to the restaurant platform.', el: 'Συνδεθείτε στην πλατφόρμα εστιατορίων.' },
  'login.helper': {
    en: 'Owners, managers, and staff use the same login. Role checks happen after authentication.',
    el: 'Ιδιοκτήτες, διαχειριστές και προσωπικό χρησιμοποιούν την ίδια σύνδεση. Ο έλεγχος ρόλων γίνεται μετά την ταυτοποίηση.',
  },
  'login.email': { en: 'Email', el: 'Email' },
  'login.password': { en: 'Password', el: 'Κωδικός' },
  'login.signIn': { en: 'Sign in', el: 'Σύνδεση' },
  'login.signingIn': { en: 'Signing in...', el: 'Σύνδεση...' },
  'login.forgot': { en: 'Forgot password?', el: 'Ξεχάσατε τον κωδικό;' },
  'login.createAccount': { en: 'Create restaurant account', el: 'Δημιουργία λογαριασμού εστιατορίου' },
}
