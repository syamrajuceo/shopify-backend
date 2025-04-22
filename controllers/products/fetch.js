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
    maxPrice,
    gender,
    color,
    brand,
    available,
    category,
    shape,
  } = req.query;

  console.log("req.query :", req.query);

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
    const buildFilterString = (key, values) => {
      if (!values) return null;
      const valueArray = Array.isArray(values) ? values : [values];
      return valueArray.length > 1
        ? `(${valueArray.map((val) => `${key}:${val}`).join(" OR ")})`
        : `${key}:${valueArray[0]}`;
    };

    // Apply filters
    const filters = [];

    // Price filters
    if (minPrice) filters.push(`variants.price:>=${minPrice}`);
    if (maxPrice) filters.push(`variants.price:<=${maxPrice}`);

    // Gender filter - using metafield handle
    const genderFilter = buildFilterString(
      "metafield.shopify.target-gender.handle",
      gender
    );
    if (genderFilter) filters.push(genderFilter);

    // Frame color filter - using metafield handle
    const frameColorFilter = buildFilterString(
      "metafield.shopify.eyewear-frame-color.handle",
      color
    );
    if (frameColorFilter) filters.push(frameColorFilter);

    // Brand filter
    const brandFilter = buildFilterString("metafield.custom.brand", brand);
    if (brandFilter) filters.push(brandFilter);

    // Availability filter - handle both true and false cases
    if (available !== undefined) {
      filters.push(`variants.available-for-sale:${available === "true"}`);
    }

    // Category/ProductType filter
    const categoryFilter = buildFilterString("product_type", category);
    if (categoryFilter) filters.push(categoryFilter);

     // Shape filter - using eyewear-frame-design metafield
     const shapeFilter = buildFilterString(
      "metafield.shopify.eyewear-frame-design.handle", 
      shape
    );
    if (shapeFilter) filters.push(shapeFilter);

    // Final query string
    const queryString = filters.length > 0 ? filters.join(" AND ") : null;

    const variables = {
      first: parseInt(limit),
      after: cursor,
      query: queryString,
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

    console.log("product res : ", response.data.data);

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

export const searchProducts = async (req, res) => {
  const { limit = 100, cursor = null, search } = req.query;

  console.log("query : ", search, limit);

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
    const filters = [];

    // Only search filter
    if (search) {
      const searchQuery = `(${[
        `title:*${search}*`,
        `product_type:*${search}*`,
        `vendor:*${search}*`,
        `metafield:custom.brand:*${search}*`,
        `metafield:shopify.target-gender:*${search}*`,
      ].join(" OR ")})`;
      filters.push(searchQuery);
    }

    const queryString = filters.length > 0 ? filters.join(" AND ") : null;

    const variables = {
      first: parseInt(limit),
      after: cursor,
      query: queryString,
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

    const result = res.json({
      success: true,
      products: metaAllProduct,
      pagination: {
        hasNextPage: products.pageInfo.hasNextPage,
        nextCursor: products.pageInfo.endCursor,
      },
    });

    console.log("result : ", result);
  } catch (error) {
    console.error("Error fetching Shopify products:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
