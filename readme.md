Below is a **build-ready technical specification** for the MVP. It is intentionally opinionated so a development team or coding LLM can implement it without having to make major architectural decisions themselves.

# QR Restaurant Ordering Platform — MVP Technical Specification

**Version:** 1.0
**Status:** Build specification
**Target:** Web-based SaaS MVP
**Primary stack:** Next.js + Supabase + Vercel
**Payments:** Out of scope for MVP, architecture must support them later

---

# 1. Product definition

The platform allows restaurant/bar customers to order food and drinks directly from their table using a QR code.

### MVP customer flow

```text
Customer sits at table
        ↓
Scans unique table QR
        ↓
Restaurant-specific menu opens
        ↓
Customer selects items
        ↓
Adds optional notes
        ↓
Reviews cart
        ↓
Submits order
        ↓
Restaurant receives order in real time
        ↓
Restaurant accepts/prepares/serves order
        ↓
Customer sees order status
```

No customer account or app installation is required.

### MVP restaurant flow

```text
Restaurant signs up
        ↓
Creates restaurant
        ↓
Creates tables
        ↓
Creates menu/categories/items
        ↓
Generates QR codes
        ↓
Prints QR codes and puts them on tables
        ↓
Receives customer orders
        ↓
Updates order status
```

---

# 2. MVP scope

## 2.1 Included

### Platform

* Restaurant registration
* Restaurant authentication
* Restaurant users
* Roles
* Restaurant profile
* Table management
* QR generation
* Menu/category management
* Menu item management
* Item availability
* Customer ordering
* Cart
* Order creation
* Order status
* Restaurant live order dashboard
* Customer order-status view
* Order history
* Basic analytics
* CSV menu import
* Printable QR codes
* Responsive mobile UI
* Basic platform administration
* Subscription-ready architecture

### Customer

No account required.

Customer can:

* scan QR
* browse menu
* select items
* specify quantity
* add item notes
* review order
* submit order
* see order status

### Restaurant

Can:

* manage users
* manage tables
* generate QR codes
* manage categories
* manage products
* change prices
* mark items unavailable
* receive orders
* accept/reject orders
* update status
* view order history

---

# 3. Explicitly out of scope

Do **not** implement these in MVP:

* Online payments
* Stripe/Viva/Adyen integration
* Split bills
* Tips
* Customer accounts
* Native mobile apps
* POS integrations
* KDS integrations
* Inventory management
* Reservations
* Loyalty
* Promotions/coupons
* Delivery
* Kitchen routing
* Waiter assignment
* Multi-location chains
* AI functionality
* NFC
* SMS notifications
* WhatsApp notifications

Architecture should not prevent these from being added later.

---

# 4. Recommended technology stack

## Frontend/backend

**Next.js 15+ / React / TypeScript**

Use the App Router.

Recommended:

* TypeScript
* React
* Next.js
* Tailwind CSS
* shadcn/ui or equivalent component library
* Zod for validation
* React Hook Form where forms are complex

## Hosting

**Vercel**

Use:

* Vercel deployments
* Vercel environment variables
* Vercel preview environments

## Backend

Use Next.js server-side functionality:

* Server Components where appropriate
* Server Actions for suitable mutations
* Route Handlers for API endpoints/webhooks
* Supabase server client

Do **not** create a separate backend service for MVP unless a specific requirement emerges.

## Database/backend platform

**Supabase**

Use:

* PostgreSQL
* Supabase Auth
* Supabase Realtime
* Supabase Storage
* Row Level Security

## QR generation

Use a maintained TypeScript QR-code library.

QR should encode only a public URL/token.

## Validation

**Zod**

All externally supplied input must be validated.

## Testing

* Vitest/Jest for unit tests
* Playwright for E2E
* React Testing Library where useful

---

# 5. High-level architecture

```text
                         ┌──────────────────┐
                         │     CUSTOMER     │
                         │    Mobile Web    │
                         └────────┬─────────┘
                                  │
                               HTTPS
                                  │
                                  ▼
                         ┌──────────────────┐
                         │      VERCEL      │
                         │                  │
                         │     Next.js      │
                         │                  │
                         │ Customer UI      │
                         │ Restaurant UI    │
                         │ Admin UI         │
                         │ Server Actions   │
                         │ API Routes       │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │     SUPABASE     │
                         │                  │
                         │ PostgreSQL       │
                         │ Auth             │
                         │ Realtime         │
                         │ Storage          │
                         └──────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │      VERCEL      │
                         │      Admin       │
                         └──────────────────┘
```

---

# 6. Application structure

Recommended project structure:

```text
src/
├── app/
│   ├── (public)/
│   │   └── t/
│   │       └── [token]/
│   │           ├── page.tsx
│   │           ├── menu/
│   │           ├── cart/
│   │           └── order/
│   │
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   │
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── orders/
│   │   ├── menu/
│   │   ├── tables/
│   │   ├── users/
│   │   └── settings/
│   │
│   ├── platform/
│   │   ├── layout.tsx
│   │   ├── restaurants/
│   │   └── users/
│   │
│   └── api/
│       ├── orders/
│       ├── qr/
│       └── ...
│
├── components/
│   ├── customer/
│   ├── admin/
│   ├── shared/
│   └── ui/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── orders/
│   ├── menu/
│   ├── qr/
│   └── validation/
│
├── types/
│
└── tests/
```

---

# 7. Database architecture

Use PostgreSQL.

## 7.1 restaurants

```sql
restaurants
-----------
id UUID PRIMARY KEY
name TEXT NOT NULL
slug TEXT UNIQUE NOT NULL
logo_url TEXT
address TEXT
currency CHAR(3) DEFAULT 'EUR'
timezone TEXT DEFAULT 'Europe/Athens'
active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

# 8. Restaurant users

Supabase Auth owns authentication.

Application-level relationship:

```sql
restaurant_users
----------------
id UUID PRIMARY KEY
restaurant_id UUID REFERENCES restaurants(id)
user_id UUID REFERENCES auth.users(id)
role TEXT NOT NULL
created_at TIMESTAMPTZ
```

Allowed roles:

```text
OWNER
MANAGER
STAFF
```

Platform super role:

```text
SUPER_ADMIN
```

Constraints:

```text
OWNER   → full access
MANAGER → operational + menu/table access
STAFF   → orders only
SUPER_ADMIN → platform-wide administration across restaurants
```

---

# 9. Tables

```sql
restaurant_tables
-----------------
id UUID PRIMARY KEY
restaurant_id UUID NOT NULL
name TEXT NOT NULL
qr_token TEXT UNIQUE NOT NULL
active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Example:

```text
Table 1 → X7k91Lm
Table 2 → Pq83Za1
Table 3 → V9k2Hn8
```

`qr_token` must be cryptographically random.

Do not expose sequential table IDs in the public QR URL.

---

# 10. Dining sessions

```sql
dining_sessions
---------------
id UUID PRIMARY KEY
restaurant_id UUID NOT NULL
table_id UUID NOT NULL
status TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
closed_at TIMESTAMPTZ
```

Statuses:

```text
ACTIVE
CLOSED
```

There should normally be one active session per table.

A session represents a group of customers currently using the table.

---

# 11. Menu categories

```sql
menu_categories
---------------
id UUID PRIMARY KEY
restaurant_id UUID NOT NULL
name TEXT NOT NULL
description TEXT
sort_order INTEGER DEFAULT 0
active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Example:

```text
Food
Drinks
Cocktails
Desserts
```

---

# 12. Menu items

```sql
menu_items
----------
id UUID PRIMARY KEY
category_id UUID NOT NULL
restaurant_id UUID NOT NULL
name TEXT NOT NULL
description TEXT
price NUMERIC(10,2) NOT NULL
image_url TEXT
available BOOLEAN DEFAULT TRUE
sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Important:

`restaurant_id` should be stored directly even though it can technically be derived through `category_id`.

This simplifies RLS and queries.

---

# 13. Orders

```sql
orders
------
id UUID PRIMARY KEY
restaurant_id UUID NOT NULL
table_id UUID NOT NULL
session_id UUID NOT NULL
status TEXT NOT NULL
subtotal NUMERIC(10,2) NOT NULL
total NUMERIC(10,2) NOT NULL
currency CHAR(3) NOT NULL
customer_note TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Statuses:

```text
NEW
ACCEPTED
PREPARING
READY
SERVED
REJECTED
CANCELLED
```

---

# 14. Order items

```sql
order_items
-----------
id UUID PRIMARY KEY
order_id UUID NOT NULL
menu_item_id UUID NOT NULL
item_name TEXT NOT NULL
quantity INTEGER NOT NULL
unit_price NUMERIC(10,2) NOT NULL
notes TEXT
created_at TIMESTAMPTZ
```

Store:

```text
item_name
unit_price
```

as snapshots.

Never depend on the current menu item for historical orders.

---

# 15. Order status history

```sql
order_status_history
--------------------
id UUID PRIMARY KEY
order_id UUID NOT NULL
old_status TEXT
new_status TEXT NOT NULL
changed_by UUID
created_at TIMESTAMPTZ NOT NULL
```

This enables future analytics such as:

* order acceptance time
* preparation time
* service time

---

# 16. Important database constraints

Implement:

* foreign keys
* NOT NULL constraints
* CHECK constraints
* unique constraints
* indexes

Recommended indexes:

```text
restaurant_tables.qr_token
restaurant_tables.restaurant_id

menu_categories.restaurant_id
menu_items.restaurant_id
menu_items.category_id

orders.restaurant_id
orders.table_id
orders.session_id
orders.status
orders.created_at

order_items.order_id

order_status_history.order_id
```

---

# 17. Row Level Security

RLS is mandatory.

Never rely on the frontend to restrict tenant access.

Every restaurant-owned table must enforce:

```text
user can only access records belonging to restaurants
for which they have membership.
```

Conceptually:

```sql
EXISTS (
    SELECT 1
    FROM restaurant_users ru
    WHERE ru.restaurant_id = target.restaurant_id
    AND ru.user_id = auth.uid()
)
```

Customer-facing data requires a different mechanism because customers are unauthenticated.

Do not expose unrestricted database access to anonymous users.

---

# 18. Public QR security model

The QR URL:

```text
https://app.example.com/t/{qr_token}
```

is public.

The customer can:

* read the restaurant's active menu
* create an order associated with that table
* view their current order/session

They cannot:

* query arbitrary restaurant data
* query other tables
* modify menu items
* modify restaurant settings
* access staff accounts

Prefer server-side order creation rather than allowing unrestricted anonymous inserts directly into PostgreSQL.

---

# 19. QR lifecycle

When creating a table:

1. Generate cryptographically random token.
2. Store token.
3. Generate public URL.
4. Generate QR image.
5. Allow download/print.

Example:

```text
https://app.example.com/t/4d8e3c9a7f2b
```

If a QR is compromised:

```text
Regenerate QR
```

should invalidate the old token.

---

# 20. Customer application

## Landing page

URL:

```text
/t/{token}
```

Display:

```text
Restaurant logo

The Green Bar

Table 17

[ START ORDER ]
```

Validate token server-side.

If invalid:

```text
This table QR code is no longer active.
Please ask a member of staff for assistance.
```

---

# 21. Menu UI

Mobile-first.

Categories displayed horizontally or vertically.

Example:

```text
THE GREEN BAR
TABLE 17

[ Food ] [ Drinks ] [ Cocktails ]

BURGER
Beef burger, fries
€12.00

[ − ] 1 [ + ]


MYTHOS
Greek lager
€4.00

[ − ] 2 [ + ]
```

Cart should remain accessible at all times.

---

# 22. Cart

Cart contains:

```text
Burger
1 × €12.00

Mythos
2 × €4.00

----------------
Total €20.00

[ SEND ORDER ]
```

Customer can add notes:

```text
Burger:
"No onions"
```

---

# 23. Order submission

Before submission:

1. Client sends item IDs and quantities.
2. Server retrieves current prices.
3. Server checks availability.
4. Server calculates total.
5. Server creates order.
6. Server creates order items.
7. Transaction commits.
8. Realtime notification becomes available.

Never trust:

```text
price
total
restaurant_id
table_id
```

sent by the browser.

The server must derive these.

---

# 24. Race condition: price/availability

Example:

Customer loads menu at 18:00.

At 18:03:

Restaurant changes burger:

```text
€12 → €14
```

Customer submits at 18:04.

The backend must use the current price and either:

### Option A — silently use current price

or preferably:

### Option B — return:

> The price of Burger has changed from €12 to €14.

For MVP, **Option A is acceptable**, provided the customer sees the final calculated total before submission.

If item becomes unavailable:

```text
Burger is currently unavailable.
Please remove it from your order.
```

---

# 25. Restaurant dashboard

Desktop/tablet-first.

Main screen:

```text
ACTIVE ORDERS

┌──────────────────────────────┐
│ TABLE 17             NEW     │
│                              │
│ Burger × 1                   │
│ Mythos × 2                   │
│                              │
│ €20.00                       │
│                              │
│ 16:42                        │
│                              │
│ [ ACCEPT ] [ REJECT ]        │
└──────────────────────────────┘
```

---

# 26. Order workflow

Restaurant can transition:

```text
NEW
 ↓
ACCEPTED
 ↓
PREPARING
 ↓
READY
 ↓
SERVED
```

Rejected:

```text
NEW → REJECTED
```

Cancelled:

```text
NEW/ACCEPTED/PREPARING → CANCELLED
```

Invalid state transitions must be rejected server-side.

For example:

```text
SERVED → NEW
```

must fail.

---

# 27. Realtime

Subscribe restaurant dashboard to relevant orders.

Conceptually:

```text
restaurant_id = current_restaurant
```

When:

```text
INSERT orders
```

occurs:

```text
dashboard receives event
```

When:

```text
UPDATE orders.status
```

occurs:

```text
customer receives event
```

Realtime subscriptions must be filtered to prevent cross-restaurant data leakage.

---

# 28. Customer order status

Customer sees:

```text
ORDER #92831

✓ Order received
✓ Restaurant accepted
● Preparing
○ Ready
○ Served
```

When status changes, update UI immediately.

If realtime connection fails, provide fallback polling.

For example:

```text
poll every 30–60 seconds
```

only while the order is active.

---

# 29. Restaurant menu management

Restaurant manager/owner can:

### Category

* create
* edit
* delete/deactivate
* reorder

### Item

* create
* edit
* deactivate
* change price
* change description
* upload image
* mark available/unavailable
* reorder

Deletion should preferably be **soft deletion/deactivation**, not physical deletion, because historical orders reference items.

---

# 30. CSV import

Provide:

```text
Download template
```

Template:

```csv
category,name,description,price,available
Drinks,Mythos,Greek lager,4.00,true
Drinks,Aperol Spritz,,8.00,true
Food,Burger,Beef burger with fries,12.00,true
```

Import process:

```text
Upload
 ↓
Validate
 ↓
Preview
 ↓
Confirm
 ↓
Transaction
 ↓
Import
```

Invalid rows should be reported without partially importing the entire file.

---

# 31. Table management

Restaurant can:

* create table
* rename table
* deactivate table
* regenerate QR
* download QR
* download all QR codes

Example:

```text
TABLES

Table 1    Active    [QR] [Edit]
Table 2    Active    [QR] [Edit]
Table 3    Inactive [QR] [Edit]

[ + ADD TABLE ]

[ DOWNLOAD ALL QR CODES ]
```

---

# 32. QR printable PDF

Generate a PDF containing:

```text
┌──────────────────┐
│  RESTAURANT LOGO │
│                  │
│    [ QR CODE ]   │
│                  │
│     TABLE 17     │
│                  │
│   Scan to order  │
└──────────────────┘
```

Restaurant can print it.

Allow configurable:

* logo
* restaurant name
* table number

---

# 33. Authentication

Restaurant users:

```text
Email
Password
```

Use Supabase Auth.

Password reset:

```text
Forgot password
      ↓
Email
      ↓
Reset link
```

Do not implement your own password storage.

---

# 34. Authorization

Create centralized authorization helpers.

Example conceptual API:

```typescript
requireRestaurantMember(userId, restaurantId)

requireRestaurantRole(
    userId,
    restaurantId,
    ["OWNER", "MANAGER"]
)
```

Never scatter authorization logic throughout components.

---

# 35. Restaurant roles

## OWNER

Everything.

## MANAGER

* menu
* tables
* orders
* analytics
* staff

Cannot:

* delete restaurant
* manage subscription/billing

## STAFF

* view orders
* update order status

Cannot:

* modify menu
* modify tables
* manage users
* view billing

---

# 36. Platform administrator

Separate platform role.

Platform admin can:

* list restaurants
* view restaurant status
* deactivate restaurant
* view system metrics
* view support information

Do not expose platform admin functionality to normal restaurant users.

---

# 37. Analytics

MVP analytics should be basic.

Restaurant dashboard:

```text
Today

Orders: 74
Revenue: €1,842
Average order: €24.89

Top products:
1. Mythos       83
2. Burger       41
3. Aperol       32
```

Since payments aren't integrated, label revenue as:

> **Order value**

rather than actual revenue.

---

# 38. System analytics

Platform should track:

```text
restaurants
active restaurants
tables
orders
orders/day
orders/month
average order value
```

Potential funnel:

```text
QR scans
 ↓
Menu sessions
 ↓
Carts
 ↓
Orders
```

QR scans should not be over-engineered initially.

---

# 39. Logging

Log:

* API errors
* authentication errors
* order creation failures
* invalid QR access
* authorization failures
* database errors
* realtime errors

Never log:

* passwords
* authentication tokens
* payment credentials
* unnecessary customer data

---

# 40. Error handling

Customer-facing errors must be friendly.

Instead of:

```text
500 Internal Server Error
```

display:

> Something went wrong while placing your order. Please try again.

Restaurant dashboard:

> We couldn't update the order. Please try again.

All errors should have a correlation/request ID in server logs.

---

# 41. Performance requirements

Target:

### Customer menu

Initial load:

**<2 seconds** on normal mobile connection where reasonably achievable.

### Order submission

Target:

**<1 second** backend response under normal load.

### Restaurant order notification

Target:

**<2 seconds** from successful order creation to dashboard display under normal conditions.

### Mobile

Must support:

* iOS Safari
* Android Chrome
* modern mobile browsers

---

# 42. Accessibility

Target WCAG 2.1 AA where practical.

Minimum:

* readable font sizes
* sufficient contrast
* keyboard navigation for admin
* semantic HTML
* alt text for menu images
* accessible buttons
* visible focus states
* don't rely exclusively on color

---

# 43. Security requirements

Mandatory:

* HTTPS
* Supabase RLS
* server-side validation
* server-side authorization
* secure cookies/session handling
* CSRF protection where applicable
* rate limiting for public order endpoints
* input sanitization
* XSS protection
* SQL injection prevention through parameterized queries/Supabase client
* secure HTTP headers

---

# 44. Abuse prevention

The public QR endpoint is inherently anonymous.

Implement basic rate limiting.

Potential rules:

```text
Maximum order submissions per IP/table/session
```

Example starting point:

```text
20 order submissions / 10 minutes / IP
```

This should be configurable.

Also:

* maximum quantity per item
* maximum number of items per order
* maximum order total

Example:

```text
quantity <= 50
items <= 100
order total <= €2,000
```

These limits protect against accidental/malicious requests.

---

# 45. Idempotency

Order creation needs protection against double taps.

Customer may tap:

```text
SEND ORDER
SEND ORDER
```

quickly.

The client should generate an idempotency key:

```text
UUID
```

The server must ensure the same key cannot create two orders.

Example:

```text
POST /api/orders
Idempotency-Key: 3f4...
```

If request is retried, return the existing order.

This is particularly important once payments are added.

---

# 46. Transactions

Order creation must be transactional:

```text
BEGIN

validate session
validate items
validate prices
calculate total
create order
create order items

COMMIT
```

If anything fails:

```text
ROLLBACK
```

No orphaned orders/order items.

---

# 47. Environment variables

Example:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

NEXT_PUBLIC_APP_URL

SENTRY_DSN
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to the browser.

---

# 48. Deployment environments

Use:

```text
Development
    ↓
Preview
    ↓
Production
```

Git branches:

```text
main
develop
feature/*
```

Suggested workflow:

```text
feature
 ↓
Pull Request
 ↓
Automated tests
 ↓
Preview deployment
 ↓
Review
 ↓
merge
 ↓
Production
```

---

# 49. CI/CD

Every PR should run:

```text
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

E2E tests should run against a test environment.

Production deployment should happen only after successful checks.

---

# 50. Database migrations

Never manually modify production schema.

Use Supabase migrations:

```text
supabase/migrations/
```

Every schema change must be represented by a migration.

Example:

```text
001_initial_schema.sql
002_add_dining_sessions.sql
003_add_order_status_history.sql
```

---

# 51. Seed data

Provide development seed data:

```text
Restaurant:
The Green Bar

Tables:
1–10

Categories:
Food
Drinks
Cocktails

Products:
Burger
Club Sandwich
Greek Salad
Mythos
Aperol Spritz
Mojito
```

This makes local development and automated tests easier.

---

# 52. Testing strategy

## Unit tests

Test:

* price calculations
* order validation
* status transitions
* permissions
* QR token generation
* CSV validation

Example:

```text
Burger €12 × 2
Beer €4 × 3

Expected total = €36
```

---

# 53. Integration tests

Test:

```text
Create restaurant
 ↓
Create table
 ↓
Generate QR
 ↓
Create menu
 ↓
Customer accesses QR
 ↓
Customer creates order
 ↓
Restaurant sees order
 ↓
Restaurant accepts order
 ↓
Customer sees ACCEPTED
```

---

# 54. E2E test

The most important test should simulate the complete customer journey.

### Scenario

```text
Restaurant exists
Table 1 exists
Menu exists

Customer scans QR
Customer adds Burger
Customer adds Beer × 2
Customer submits order

Expected:
Order exists
Order total correct
Restaurant dashboard receives order
Customer sees NEW
```

Then:

```text
Restaurant accepts

Expected:
Customer sees ACCEPTED
```

Then:

```text
Restaurant → PREPARING
Restaurant → READY
Restaurant → SERVED
```

Customer should see each transition.

---

# 55. Acceptance criteria

The MVP is considered complete when:

### Restaurant

* [ ] Can register
* [ ] Can log in
* [ ] Can create restaurant
* [ ] Can create tables
* [ ] Can generate QR codes
* [ ] Can download/print QR codes
* [ ] Can create categories
* [ ] Can create menu items
* [ ] Can upload item images
* [ ] Can change prices
* [ ] Can disable items
* [ ] Can import menu via CSV

### Customer

* [ ] QR opens correct restaurant
* [ ] Correct table is identified
* [ ] Menu loads
* [ ] Customer can add items
* [ ] Customer can modify quantities
* [ ] Customer can add notes
* [ ] Customer can review cart
* [ ] Customer can submit order
* [ ] Customer doesn't need account
* [ ] Customer sees order status

### Restaurant

* [ ] New order appears without refresh
* [ ] Staff can accept order
* [ ] Staff can reject order
* [ ] Staff can change status
* [ ] Customer receives status updates
* [ ] Historical orders are retained

### Security

* [ ] RLS implemented
* [ ] Cross-restaurant access impossible
* [ ] Staff permissions enforced
* [ ] Public API rate limited
* [ ] Duplicate order submission prevented
* [ ] Server calculates prices
* [ ] Secrets not exposed client-side

---

# 56. Future payment architecture

Do not implement yet, but design around this:

```text
                    ORDER
                      │
                      ▼
                 PAYMENT
                      │
             ┌────────┴────────┐
             ▼                 ▼
        Payment PSP         Webhook
             │                 │
             └────────┬────────┘
                      ▼
               PAYMENT STATUS
                      │
                      ▼
                    ORDER
```

Future tables:

```text
payments
payment_transactions
refunds
tips
```

Potential providers can be evaluated later based on Greece/EU availability, fees, marketplace/platform capabilities, Apple Pay/Google Pay support, and restaurant settlement model.

---

# 57. Future POS integration

The architecture should eventually support:

```text
Customer
   ↓
QR
   ↓
Your Platform
   ↓
Order
   ├────────→ Restaurant Dashboard
   │
   └────────→ POS
                 │
                 ▼
              Kitchen
```

Don't implement POS integrations until the basic ordering workflow is validated.

---

# 58. Future subscription architecture

Although payment billing isn't MVP functionality, restaurants should have:

```text
subscription_status
subscription_plan
subscription_provider_id
```

Possible plans:

```text
FREE
STARTER
PRO
```

Feature flags should eventually be based on subscription:

```text
can_use_ordering
can_use_analytics
can_use_payments
can_use_pos
```

Don't hard-code:

```typescript
if restaurant.id === ...
```

for feature access.

---

# 59. Recommended MVP pricing model

The initial commercial model can be:

### Free

* digital menu
* limited tables

### Starter

**€19/month**

* unlimited tables
* QR ordering
* restaurant dashboard
* order history

### Pro

**€49/month**

Future:

* payments
* advanced analytics
* POS integration
* waiter call
* other advanced features

Do not implement billing until there are pilot restaurants willing to pay.

---

# 60. Estimated infrastructure

Initial target:

```text
Vercel
Supabase
Domain
Monitoring
Email
```

Budget:

### Pilot

**~€20–€60/month**

### 100 restaurants

Roughly:

**~€100–€300/month**

depending on traffic, database usage, storage, realtime usage and chosen plans.

These are planning estimates, not guaranteed provider bills.

---

# 61. MVP development sequence

## Phase 1 — Infrastructure

```text
Create GitHub repository
Create Supabase project
Create Vercel project
Configure environments
Configure migrations
Configure CI/CD
```

## Phase 2 — Database

Implement all tables and RLS.

## Phase 3 — Authentication

Implement:

```text
Login
Logout
Password reset
Roles
Restaurant membership
```

## Phase 4 — Restaurant setup

Implement:

```text
Restaurant
Tables
QR
Menu
Categories
Items
```

## Phase 5 — Customer

Implement:

```text
QR landing
Menu
Cart
Order
Status
```

## Phase 6 — Realtime

Implement:

```text
Restaurant receives order
Customer receives status
```

## Phase 7 — Admin

Implement:

```text
Platform admin
Restaurant management
```

## Phase 8 — Testing

Complete unit/integration/E2E testing.

## Phase 9 — Pilot

Deploy to:

**1–3 real restaurants.**

---

# 62. Definition of "production ready"

Do not consider the product production-ready merely because:

> "The customer can place an order."

Production-ready means:

```text
Security
   +
Reliability
   +
Error handling
   +
Backups
   +
Monitoring
   +
Authorization
   +
Mobile UX
   +
Operational workflow
```

A restaurant cannot afford to have:

> "The QR ordering system isn't working tonight."

So reliability is more important than adding features.

---

# 63. Development principle for the team/LLM

The following rules should be treated as non-negotiable:

1. **TypeScript strict mode.**
2. **No secrets in client-side code.**
3. **All restaurant data protected by RLS.**
4. **Never trust client-provided prices or totals.**
5. **All mutations validated server-side.**
6. **Use database transactions for multi-step operations.**
7. **Use idempotency for order creation.**
8. **Never physically delete historical order data.**
9. **Use soft deletion/deactivation for menu items and tables.**
10. **Do not introduce microservices unless a concrete requirement exists.**
11. **Do not introduce a separate backend unless a concrete requirement exists.**
12. **Keep payment architecture extensible but payment implementation out of MVP.**
13. **Every feature must include authorization and tests.**
14. **Mobile customer UX takes priority over desktop customer UX.**
15. **Restaurant dashboard must work well on tablets.**

---

# 64. First development milestone

The first milestone should be deliberately small:

> **A customer can scan a QR code at Table 1, see the restaurant's menu, order a burger and two beers, and the restaurant's dashboard receives the order in real time.**

Everything else is secondary.

Once that works reliably, the team has proven the fundamental technical loop:

```text
QR
 ↓
Restaurant + Table identification
 ↓
Menu
 ↓
Cart
 ↓
Order
 ↓
Database
 ↓
Realtime
 ↓
Restaurant dashboard
```

That is the **technical core of the product**.

---

## Recommended repository README

The development team/LLM should treat the following hierarchy as the source of truth:

```text
Product requirements
        ↓
Architecture
        ↓
Database schema
        ↓
RLS/security
        ↓
API contracts
        ↓
UI requirements
        ↓
Acceptance criteria
        ↓
Tests
```

When requirements conflict, **security and data integrity take precedence over UI convenience**.

The MVP should favor **simple, maintainable, managed infrastructure** over premature scalability.

---

### Suggested next step

The logical next artifact is a **developer implementation pack** containing the actual **Supabase SQL migration, RLS policies, TypeScript types, API contracts, folder/file skeleton, environment variables, and detailed user stories/tasks**. That can be handed directly to a coding LLM such as Cursor/Copilot/Claude Code and used to start generating the application rather than requiring the team to translate this specification into technical tasks themselves.
