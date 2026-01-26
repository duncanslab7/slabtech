import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/purchase-inquiry
 * Create a new purchase inquiry (public endpoint)
 * Uses service role to bypass RLS since this is a public form
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      productType,
      name,
      email,
      phone,
      industry,
      paymentPlan,
      customData,
      message
    } = body

    // Validate required fields
    if (!productType || !name || !email || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: productType, name, email, phone' },
        { status: 400 }
      )
    }

    // Validate product type
    if (!['hoodie', 'individual', 'company'].includes(productType)) {
      return NextResponse.json(
        { error: 'Invalid product type' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS (this is a public form)
    const supabase = createServiceRoleClient()

    // Insert inquiry into database
    const { data: inquiry, error } = await supabase
      .from('purchase_inquiries')
      .insert({
        product_type: productType,
        name,
        email,
        phone,
        industry,
        payment_plan: paymentPlan,
        custom_data: customData,
        message,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create purchase inquiry:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        {
          error: 'Failed to create inquiry',
          details: error.message,
          hint: error.hint
        },
        { status: 500 }
      )
    }

    // TODO: Send notification email/SMS to Duncan
    // Options for notification:
    // 1. Email: Use Resend, SendGrid, or similar service
    // 2. SMS: Use Twilio or similar service
    //
    // Example with Resend (requires RESEND_API_KEY env var):
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     from: 'SLAB Store <noreply@slabtraining.com>',
    //     to: 'duncan@slabtraining.com',
    //     subject: `New ${productType} inquiry from ${name}`,
    //     html: `<p>New purchase inquiry received...</p>`
    //   })
    // })
    //
    // Example with Twilio (requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER):
    // const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`
    // await fetch(twilioUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    //   body: new URLSearchParams({
    //     From: process.env.TWILIO_PHONE_NUMBER,
    //     To: '+15208341750',
    //     Body: `New ${productType} inquiry from ${name} (${email})`
    //   })
    // })

    return NextResponse.json({
      success: true,
      inquiry: {
        id: inquiry.id,
        created_at: inquiry.created_at
      }
    })
  } catch (error) {
    console.error('Error processing purchase inquiry:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/purchase-inquiry
 * List all purchase inquiries (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Use service role to bypass RLS for admin queries
    const supabase = createServiceRoleClient()

    // Fetch all inquiries
    const { data: inquiries, error } = await supabase
      .from('purchase_inquiries')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch purchase inquiries:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: 'Failed to fetch inquiries', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ inquiries })
  } catch (error) {
    console.error('Error in GET /api/purchase-inquiry:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
