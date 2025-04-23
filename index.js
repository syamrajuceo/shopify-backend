import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dbConnection from "./config/dbConnection.js";
import userRouter from "./routes/userRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import productsRouter from "./routes/productRoutes.js";

const app = express();
app.use(express.json());
// Use CORS with specific origin
app.use(cors({
  origin: 'http://localhost:5174',
  credentials: true,
}));
dotenv.config();

const port = process.env.PORT || 3000;

app.use("/api/customer", userRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/orders", orderRouter)
app.use("/api/cart", cartRouter)
app.use("/api/products", productsRouter)


dbConnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`✓ App is running on port: ${port}`);
    });
  })
  .catch((err) => {
    console.error("✘ Failed to connect to the database", err);
  });
