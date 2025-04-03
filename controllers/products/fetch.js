import axios from "axios";
import dotenv from "dotenv";
import MetaController from "../../controllers/metacontroller/MetaController.js";

dotenv.config();

const API_URL = "https://4bz4tg-qg.myshopify.com/api/2024-10/graphql.json";
const API_TOKEN = process.env.SHOPIFY_API_TOKEN;

export const fetchAllProducts = async (req, res) => {
  const { 
    limit = 50, 
    cursor = null, 
    minPrice,
    maxPrice ,
    gender,
    frameColor,
    brand ,
    available,
    category
  } = req.query;

  const query = `
    query ($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            descriptionHtml
            description
            vendor
            handle
            productType
            options {
              name
              values
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  priceV2 {
                    amount
                    currencyCode
                  }
                  compareAtPriceV2 {
                    amount
                    currencyCode
                  }
                  availableForSale
                  sku
                  quantityAvailable
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
            images(first: 100) {
              edges {
                node {
                  id
                  url
                  altText
                }
              }
            }
            metafields(identifiers: [
              {namespace: "shopify", key: "color-pattern"},
              {namespace: "shopify", key: "age-group"},
              {namespace: "shopify", key: "eyewear-frame-design"},
              {namespace: "shopify", key: "target-gender"},
              {namespace: "shopify", key: "fabric"},
              {namespace: "shopify", key: "lens_polarization"},
              {namespace: "custom", key: "express_delivery"},
              {namespace: "custom", key: "free_delivery"},
              {namespace: "custom", key: "brand"},
              {namespace: "shopify", key: "lens-color"},
              {namespace: "shopify", key: "temple-color"},
              {namespace: "shopify", key: "eyewear-frame-color"},
            ]) {
              namespace
              key
              value
              type
              description
            }
          }
        }
      }
    }
  `;

  try {
    // Build the query filter string
    const filters = [];
    
    // Price filters
    if (minPrice) filters.push(`variants.price:>=${minPrice}`);
    if (maxPrice) filters.push(`variants.price:<=${maxPrice}`);
    
    // Gender filter (using metafield)
    if (gender) filters.push(`metafield:shopify.target-gender:${gender}`);
    
    // Frame color filter (using metafield)
    if (frameColor) filters.push(`metafield:shopify.eyewear-frame-color:${frameColor}`);
    
    // Brand filter (using metafield)
    if (brand) filters.push(`metafield:custom.brand:${brand}`);
    
    // Availability filter
    if (available === 'true') filters.push(`variants.available_for_sale:true`);
    
    // Category/ProductType filter
    if (category) filters.push(`product_type:${category}`);

    const variables = { 
      first: parseInt(limit), 
      after: cursor,
      query: filters.join(' AND ') || null
    };

    const response = await axios.post(
      API_URL,
      { query, variables },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": API_TOKEN,
        },
      }
    );

    const { products } = response.data.data;

    // Process Products
    const processedProducts = products.edges.map((edge) => {
      const product = edge.node;
      const metafields = product.metafields
        ? product.metafields
            .filter((mf) => mf !== null)
            .map((mf) => ({
              key: mf.key,
              value: mf.value,
              namespace: mf.namespace,
              type: mf.type,
              description: mf.description,
            }))
        : [];

      return { ...product, metafields };
    });

    const metaAllProduct = await MetaController(processedProducts);

    // Send response
    res.json({
      success: true,
      products: metaAllProduct,
      pagination: {
        hasNextPage: products.pageInfo.hasNextPage,
        nextCursor: products.pageInfo.endCursor,
      },
    });
  } catch (error) {
    console.error("Error fetching Shopify products:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};