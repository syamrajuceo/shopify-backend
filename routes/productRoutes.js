import express from "express";
import { fetchAllProducts, searchProducts } from "../controllers/products/fetch.js";

const productsRouter = express.Router();

// GET /api/products – fetch all products
productsRouter.get("/", fetchAllProducts);

// GET /api/products/search?search=rayban – search products
productsRouter.get("/search", searchProducts);

export default productsRouter;
