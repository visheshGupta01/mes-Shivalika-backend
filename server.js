const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` }); // Load environment-specific file

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.ATLAS_URI;
mongoose.connect(uri);

const connection = mongoose.connection;
connection.once("open", () => {
  console.log("MongoDB database connection established successfully");
});

app.get("/", (req, res) => {
  res.send("hello world");
});

const authRouter = require("./routes/auth");
app.use("/auth", authRouter);

const buyerRouter = require("./routes/buyer");
app.use("/buyers", buyerRouter);

const productRouter = require("./routes/product");
app.use("/product", productRouter);

const productionRouter = require("./routes/productionData");
app.use("/productionData", productionRouter);

app.listen(port, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
});
