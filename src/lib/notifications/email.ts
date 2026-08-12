type WelcomeEmailInput = {
  email: string
  fullName: string
  restaurantName: string
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

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
