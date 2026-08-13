type WelcomeEmailInput = {
  email: string
  fullName: string
  restaurantName: string
}

type ConfirmationEmailInput = {
  email: string
  confirmationUrl: string
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const PLACEHOLDER_RESEND_KEY = 'your-resend-api-key-here'

/**
 * True when a real Resend API key is present (not the .env.example placeholder).
 * Resend is optional: without it, confirmation emails fall back to Supabase's
 * built-in "Confirm signup" template (which is rate-limited).
 */
export function isResendConfigured() {
  const apiKey = process.env.RESEND_API_KEY
  return Boolean(apiKey && apiKey.length > 5 && apiKey !== PLACEHOLDER_RESEND_KEY)
}

/**
 * Sends the signup confirmation email via Resend. Returns true when the email
 * was accepted, false when Resend is not configured or the request failed —
 * callers then fall back to Supabase's built-in email delivery.
 */
export async function sendConfirmationEmail(input: ConfirmationEmailInput): Promise<boolean> {
  if (!isResendConfigured()) {
    console.warn('Confirmation email not sent: RESEND_API_KEY is not configured.')
    return false
  }

  const body = {
    from: process.env.RESEND_FROM_EMAIL || 'Waiter AI <onboarding@resend.dev>',
    to: [input.email],
    subject: 'Confirm your Waiter AI account',
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #1f1a17;">
        <h2 style="margin-bottom: 8px;">Confirm your Waiter AI account</h2>
        <p style="margin-top: 0;">Thanks for registering! Confirm your email to activate your owner account:</p>
        <p>
          <a
            href="${input.confirmationUrl}"
            style="display:inline-block;padding:10px 18px;background:#16a34a;color:#ffffff;border-radius:6px;text-decoration:none;"
          >
            Confirm my email
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${input.confirmationUrl}">${input.confirmationUrl}</a></p>
      </div>
    `,
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Confirmation email failed:', errorText)
      return false
    }

    return true
  } catch (error) {
    console.error('Confirmation email request threw:', error)
    return false
  }
}

export async function sendRegistrationEmail(input: WelcomeEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const from = process.env.RESEND_FROM_EMAIL || 'Waiter AI <onboarding@resend.dev>'

  if (!isResendConfigured()) {
    console.warn('Registration email not sent: RESEND_API_KEY is not configured.')
    return
  }

  const body = {
    from,
    to: [input.email],
    subject: `Welcome to Waiter AI, ${input.fullName}`,
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #1f1a17;">
        <h2 style="margin-bottom: 8px;">Welcome to Waiter AI</h2>
        <p style="margin-top: 0;">Hi ${input.fullName},</p>
        <p>Your restaurant workspace for <strong>${input.restaurantName}</strong> is ready.</p>
        <p>You can now sign in from:</p>
        <p><a href="${appUrl}/login">${appUrl}/login</a></p>
        <p>Next recommended step: open the setup area and configure your tables and menu.</p>
      </div>
    `,
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Registration email failed:', errorText)
  }
}
