import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Webhook endpoint for Payment Providers (e.g. SePay, PayOS, etc.)
// Providers usually POST a JSON payload when a transaction is successful.
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Ensure the webhook request is authenticated (e.g., via API key or signature).
    // In production, verify the signature using the provider's SDK or secret.
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')
    if (apiKey !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderCode, amount, status } = body

    if (!orderCode || amount == null) {
      return NextResponse.json({ error: 'Missing orderCode or amount' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for backend updates
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // Ignore
            }
          },
        },
      }
    )

    // Verify order exists
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, total, payment_status, order_status')
      .eq('order_code', orderCode)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ message: 'Order is already paid' })
    }

    if (Number(amount) < Number(order.total)) {
      return NextResponse.json({ error: 'Insufficient amount' }, { status: 400 })
    }

    // Update the order to paid
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('Webhook database update error:', updateError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Order updated to paid' })
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
  }
}
