import {
  GetMetaHandler,
  getMetaIds,
  metaQueryGenerator,
  MetaResultIdValue,
} from "../../utils/metaControllerHelpers.js";
import dotenv from "dotenv";

dotenv.config();

export const MetaController = async (AllProducts) => {
  try {
    const metafieldIds = getMetaIds(AllProducts);
    const metaQuery = metaQueryGenerator(metafieldIds);
    const metaResult = await MetaResultIdValue(metaQuery);

    return AllProducts.map((obj) => {
      if (!obj.metafields || !Array.isArray(obj.metafields)) {
        return obj;
      }

      return {
        ...obj,
        metafields: obj.metafields.map((metafield) => {
          let parsedValue = metafield.value;
          if (typeof parsedValue === "string") {
            try {
              parsedValue = JSON.parse(parsedValue);
            } catch (error) {
              // Keep original value if parsing fails
            }
          }

          const metavalue = Array.isArray(parsedValue)
            ? parsedValue.map((val) => ({
                id: val,
                handle: GetMetaHandler(metaResult, val),
              }))
            : {
                id: parsedValue,
                handle: GetMetaHandler(metaResult, parsedValue),
              };

          return {
            ...metafield,
            metavalue,
          };
        }),
      };
    });
  } catch (error) {
    console.error("Error in MetaController:", error);
    throw error;
  }
};
