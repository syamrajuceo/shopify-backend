import axios from 'axios';
import crypto from 'crypto';

// Verify Shopify webhook signature
export const verifyWebhook = (req, res, next) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const body = JSON.stringify(req.body);
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');

  if (hmac !== calculatedHmac) {
    return res.status(401).send('Unauthorized');
  }
  next();
};

// Update product sales count
export const updateProductSalesCount = async (productId, quantity) => {
  try {
    // Fetch current sales_count
    const { data: { metafields } } = await axios.get(
      `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2024-10/products/${productId}/metafields.json`,
      { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN } }
    );

    // Find or initialize sales_count
    const salesMeta = metafields.find(m => m.namespace === 'custom' && m.key === 'sales_count');
    const currentCount = salesMeta ? parseInt(salesMeta.value) : 0;

    // Update metafield
    if (salesMeta) {
      await axios.put(
        `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2024-10/metafields/${salesMeta.id}.json`,
        { metafield: { value: (currentCount + quantity).toString() } },
        { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN } }
      );
    } else {
      await axios.post(
        `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2024-10/products/${productId}/metafields.json`,
        {
          metafield: {
            namespace: 'custom',
            key: 'sales_count',
            value: quantity.toString(),
            type: 'number_integer'
          }
        },
        { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN } }
      );
    }
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error.message);
    throw error;
  }
};

// Process order webhook
export const handleOrderWebhook = async (req, res) => {
  try {
    const order = req.body;

    // Skip if order is not paid
    if (order.financial_status !== 'paid') {
      return res.status(200).send('Order not paid - skipped');
    }

    // Process all line items in parallel
    await Promise.all(
      order.line_items.map(item => 
        updateProductSalesCount(item.product_id, item.quantity)
      )
    );

    res.status(200).send('Sales count updated');
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    res.status(500).send('Error processing webhook');
  }
};

// Alternative default export if preferred
export default {
  verifyWebhook,
  handleOrderWebhook,
  updateProductSalesCount
};