import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "https://4bz4tg-qg.myshopify.com/api/2024-10/graphql.json";
const API_TOKEN = process.env.SHOPIFY_API_TOKEN;

if (!API_TOKEN) {
    throw new Error("Missing SHOPIFY_API_TOKEN in environment variables.");
}

const getMetaIds = (AllProducts) => {
    if (!Array.isArray(AllProducts)) return [];

    const metafieldIds = new Set(
        AllProducts.flatMap((productObj) => {
            if (!Array.isArray(productObj?.metafields)) return [];

            return productObj.metafields.flatMap((metafield) => {
                let metaValues = metafield?.value;

                if (Array.isArray(metaValues)) {
                    return metaValues;
                }

                if (typeof metaValues === "string") {
                    try {
                        const parsedValue = JSON.parse(metaValues);
                        return Array.isArray(parsedValue) ? parsedValue : [parsedValue];
                    } catch (error) {
                        return [];
                    }
                }

                if (typeof metaValues === "object" && metaValues !== null) {
                    return Object.values(metaValues);
                }

                return metaValues ? [metaValues] : [];
            });
        })
    );

    return [...metafieldIds].filter(id => id && typeof id === "string");
};

const metaQueryGenerator = (metafieldIds) => {
    const validMetafieldIds = metafieldIds.filter(id => 
        typeof id === "string" && id.startsWith("gid://shopify/Metaobject/")
    );

    if (validMetafieldIds.length === 0) {
        return { query: "query GetMetaobjects { }" };
    }

    const query = validMetafieldIds.map((metaId, index) => 
        `metaobject${index + 1}: metaobject(id: "${metaId}") { id handle }`
    ).join(",");

    return {
        query: `query GetMetaobjects { ${query} }`
    };
};

const transformMetaObjects = (metaObjects) => {
    if (!metaObjects || typeof metaObjects !== "object") return [];

    return Object.values(metaObjects)
        .filter(obj => obj?.id && obj?.handle)
        .map(({ id, handle }) => ({ id, handle }));
};

const MetaResultIdValue = async (query) => {
    try {
        const response = await axios.post(API_URL, query, {
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Storefront-Access-Token": API_TOKEN,
            },
        });

        if (!response.data?.data) {
            console.error("Empty response from Shopify API");
            return [];
        }
        return transformMetaObjects(response.data.data);
    } catch (error) {
        console.error("Error fetching metaobjects:", error.response?.data || error.message);
        return [];
    }
};

const GetMetaHandler = (metaResult, id) => {
    if (!Array.isArray(metaResult) || !id) return null;
    return metaResult.find(metaObject => metaObject.id === id)?.handle || null;
};

export { getMetaIds, metaQueryGenerator, MetaResultIdValue, GetMetaHandler };