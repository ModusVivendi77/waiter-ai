type WelcomeEmailInput = {
  email: string
  fullName: string
  restaurantName: string
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export async function sendVerificationEmail(input: WelcomeEmailInput & { code: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const from = process.env.RESEND_FROM_EMAIL || 'Waiter AI <onboarding@resend.dev>'

  if (!apiKey || apiKey === 'your-resend-api-key-here') {
    console.warn('Verification email not sent: RESEND_API_KEY is not configured.')
    return
  }

  const verifyUrl = `${appUrl}/verify-email?email=${encodeURIComponent(input.email)}`

  const body = {
    from,
    to: [input.email],
    subject: `Your Waiter AI verification code is ${input.code}`,
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #1f1a17;">
        <h2 style="margin-bottom: 8px;">Verify your email</h2>
        <p style="margin-top: 0;">Hi ${input.fullName},</p>
        <p>Use the verification code below to confirm your email for <strong>${input.restaurantName}</strong>:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; background: #f3f0ec; padding: 12px 16px; text-align: center;">
          ${input.code}
        </p>
        <p>This code expires shortly. If you did not request this, you can safely ignore this email.</p>
        <p>Alternatively, open the verification page:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
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
    console.error('Verification email failed:', errorText)
  }
}

export async function sendRegistrationEmail(input: WelcomeEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const from = process.env.RESEND_FROM_EMAIL || 'Waiter AI <onboarding@resend.dev>'

  if (!apiKey || apiKey === 'your-resend-api-key-here') {
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
