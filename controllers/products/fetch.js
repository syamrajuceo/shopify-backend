import axios from "axios";
import dotenv from "dotenv";
import MetaController from "../../controllers/metacontroller/MetaController.js";

dotenv.config(); // Load environment variables

const API_URL = "https://4bz4tg-qg.myshopify.com/api/2025-04/graphql.json";
const API_TOKEN = process.env.API_TOKEN || "80a45abbc99fa8d887c693c5aae5996e";

export const fetchAllProducts = async (req, res) => {
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

  let allProducts = [];
  let hasNextPage = true;
  let endCursor = null;

  try {
    while (hasNextPage) {
      const variables = { first: 250, after: endCursor };

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

        // Map metafields safely
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

      // Store products
      allProducts = [...allProducts, ...processedProducts];

      // Update pagination variables
      hasNextPage = products.pageInfo.hasNextPage;
      endCursor = products.pageInfo.endCursor;
    }
    const metaAllProduct=await MetaController(allProducts)
    res.json({ success: true, products: metaAllProduct });
  } catch (error) {
    console.error("Error fetching Shopify products:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
