export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/create-checkout' && request.method === 'POST') {
      try {
        const body = await request.json();
        const stripeSecretKey = env.STRIPE_SECRET_KEY;
        const dailyRate = Number(env.STRIPE_DAILY_RATE || '10000');

        if (!stripeSecretKey) {
          return Response.json(
            {
              error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY in your deployment settings.'
            },
            { status: 500 }
          );
        }

        const startDate = body.startDate;
        const endDate = body.endDate;
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        const days = Math.round((end - start) / 86400000) + 1;

        if (!startDate || !endDate || days <= 0) {
          return Response.json({ error: 'Invalid rental dates provided.' }, { status: 400 });
        }

        const amount = dailyRate * days;
        const currency = env.STRIPE_CURRENCY || 'usd';
        const description = `${days} day rental of JLG ET500J lift (${startDate} - ${endDate})`;

        const params = new URLSearchParams();
        params.set('mode', 'payment');
        params.set('success_url', `${url.origin}/?checkout=success`);
        params.set('cancel_url', `${url.origin}/?checkout=cancel`);
        params.set('customer_email', body.customerEmail || '');
        params.set('payment_method_types[0]', 'card');
        params.set('line_items[0][price_data][currency]', currency);
        params.set('line_items[0][price_data][product_data][name]', 'JLG ET500J Lift Rental');
        params.set('line_items[0][price_data][product_data][description]', description);
        params.set('line_items[0][price_data][unit_amount]', amount.toString());
        params.set('line_items[0][quantity]', '1');
        params.set('metadata[customerName]', body.customerName || '');
        params.set('metadata[customerEmail]', body.customerEmail || '');
        params.set('metadata[startDate]', startDate || '');
        params.set('metadata[endDate]', endDate || '');
        params.set('metadata[notes]', body.notes || '');

        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });

        const data = await response.json();

        if (!response.ok) {
          return Response.json({ error: data.error?.message || 'Unable to create Stripe checkout session.' }, { status: 500 });
        }

        return Response.json({ url: data.url, sessionId: data.id });
      } catch (error) {
        console.error('Stripe checkout error:', error);
        return Response.json({ error: error?.message || 'Invalid checkout request.' }, { status: 400 });
      }
    }

    if (env.__STATIC_CONTENT && typeof env.__STATIC_CONTENT.fetch === 'function') {
      return env.__STATIC_CONTENT.fetch(request);
    }

    return new Response('Static asset binding not found. Check your Wrangler site configuration and redeploy.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
    });
  }
};
