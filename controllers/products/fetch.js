import axios from "axios";
import dotenv from "dotenv";
import MetaController from "../../controllers/metacontroller/MetaController.js";

dotenv.config();

const API_URL = "https://4bz4tg-qg.myshopify.com/api/2024-10/graphql.json";
const API_TOKEN = process.env.SHOPIFY_API_TOKEN;

export const fetchAllProducts = async (req, res) => {
  const { limit = 50, cursor = null } = req.query;

  const query = `
    query ($first: Int!, $after: String) {
      products(first: $first, after: $after) {
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
    const variables = { first: parseInt(limit), after: cursor };

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

    const metaAllProduct=await MetaController(processedProducts)

    // Send response
    // In your backend response, align with frontend expectations
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
