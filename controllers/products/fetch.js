import axios from "axios";
import dotenv from "dotenv";
import { MetaController } from "../metacontroller/MetaController.js";

dotenv.config();

const API_URL = "https://4bz4tg-qg.myshopify.com/api/2024-10/graphql.json";
const API_TOKEN = process.env.SHOPIFY_API_TOKEN;

const buildFilterString = (key, values) => {
  if (!values) return null;
  const valueArray = Array.isArray(values) ? values : [values];
  return valueArray.length > 1
    ? `(${valueArray.map((val) => `${key}:${val}`).join(" OR ")})`
    : `${key}:${valueArray[0]}`;
};

const applyClientSideFilters = (products, filters) => {
  return products.filter((product) => {
    // Gender filter
    if (filters.gender) {
      const genderMetafield = product.metafields?.find(
        (mf) => mf.key === "target-gender"
      );
      if (!genderMetafield) return false;

      const genderValues = Array.isArray(filters.gender)
        ? filters.gender
        : [filters.gender];
      const metavalues = Array.isArray(genderMetafield.metavalue)
        ? genderMetafield.metavalue.map((v) => v?.handle)
        : [genderMetafield.metavalue?.handle];

      if (!metavalues.some((val) => genderValues.includes(val))) return false;
    }

    // Color filter
    if (filters.color) {
      const colorFields = ["eyewear-frame-color", "lens-color", "temple-color"];

      // Get all color metafields that exist for this product
      const colorMetafields = product.metafields?.filter(
        (mf) => mf && colorFields.includes(mf.key)
      );

      // If no color metafields found at all, exclude the product
      if (!colorMetafields || colorMetafields.length === 0) return false;

      const colorValues = Array.isArray(filters.color)
        ? filters.color
        : [filters.color];

      // Check if any of the color metafields match the filter
      const hasMatchingColor = colorMetafields.some((metafield) => {
        // Extract values from metafield
        const metavalues = Array.isArray(metafield.metavalue)
          ? metafield.metavalue.map((v) => v?.handle)
          : [metafield.metavalue?.handle];

        // Check if any metavalue matches filter colors
        return metavalues.some((val) => val && colorValues.includes(val));
      });

      if (!hasMatchingColor) return false;
    }

    return true;
  });
};

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

  console.log("query : ", req.query);

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
                                    quantityAvailable
                                    sku
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
                        }
                    }
                }
            }
        }
    `;

  try {
    // Build filters array for Shopify API
    const shopifyFilters = [];

    // Price filters
    if (minPrice) shopifyFilters.push(`variants.price:>=${minPrice}`);
    if (maxPrice) shopifyFilters.push(`variants.price:<=${maxPrice}`);

    // Brand filter
    const brandFilter = buildFilterString("metafield.custom.brand", brand);
    if (brandFilter) shopifyFilters.push(brandFilter);

    // Availability filter
    if (available !== undefined) {
      shopifyFilters.push(
        `variants.available-for-sale:${available === "true"}`
      );
    }

    // Category/ProductType filter
    const categoryFilter = buildFilterString("product_type", category);
    if (categoryFilter) shopifyFilters.push(categoryFilter);

    // Shape filter
    const shapeFilter = buildFilterString(
      "metafield.shopify.eyewear-frame-design.handle",
      shape
    );
    if (shapeFilter) shopifyFilters.push(shapeFilter);

    // Final query string for Shopify
    const queryString =
      shopifyFilters.length > 0 ? shopifyFilters.join(" AND ") : null;

    // GraphQL query variables
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

    // Process initial product data
    const processedProducts = response.data.data.products.edges.map((edge) => ({
      ...edge.node,
      metafields: edge.node.metafields?.filter((mf) => mf !== null) || [],
    }));

    // Transform metafields to include handles
    const productsWithMeta = await MetaController(processedProducts);

    // Apply client-side filters for gender and color
    const clientSideFilters = {
      gender,
      color,
    };

    const filteredProducts = applyClientSideFilters(
      productsWithMeta,
      clientSideFilters
    );

    // Extract unique brands from filtered products
    const brandsList = [
      ...new Set(
        filteredProducts
          .map((product) => {
            const brandMeta = product.metafields?.find(
              (mf) => mf.key === "brand"
            );
            return brandMeta?.metavalue?.handle || brandMeta?.value;
          })
          .filter((brand) => brand)
      ),
    ];

    res.json({
      success: true,
      // brandsList: brandsList,
      products: filteredProducts,
      pagination: {
        hasNextPage: response.data.data.products.pageInfo.hasNextPage,
        nextCursor: response.data.data.products.pageInfo.endCursor,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.response?.data?.errors || null,
    });
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
