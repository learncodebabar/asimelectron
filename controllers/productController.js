import Product from "../models/Product.js";

async function generateProductId() {
  const count = await Product.countDocuments();
  let num = count + 1;
  let id = String(num).padStart(4, "0");
  while (await Product.findOne({ productId: id })) {
    num++;
    id = String(num).padStart(4, "0");
  }
  return id;
}

// GET all products
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET single product
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST create — auto-generates productId and code if not provided
export const createProduct = async (req, res) => {
  try {
    const body = { ...req.body };

    // Auto-generate productId if blank or not sent
    if (!body.productId || !body.productId.trim()) {
      body.productId = await generateProductId();
    }

    // Auto-generate code = same as productId if blank
    if (!body.code || !body.code.trim()) {
      body.code = body.productId;
    }

    const product = await Product.create(body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    // Duplicate productId — generate a new one and retry once
    if (error.code === 11000) {
      try {
        const body = { ...req.body };
        body.productId = await generateProductId();
        if (!body.code || !body.code.trim()) body.code = body.productId;
        const product = await Product.create(body);
        return res.status(201).json({ success: true, data: product });
      } catch (retryErr) {
        return res
          .status(400)
          .json({ success: false, message: retryErr.message });
      }
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT update
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// controllers/productController.js - Add this function

// UPDATE PRODUCT STOCK
export const updateProductStock = async (req, res) => {
  try {
    const { productId, measurement, quantity, operation } = req.body;
    // operation: "add" or "subtract"
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    // Find the packing info for this measurement
    const packingIndex = product.packingInfo.findIndex(p => p.measurement === measurement);
    if (packingIndex === -1) {
      return res.status(404).json({ success: false, message: "Packing info not found" });
    }
    
    let newStock = product.packingInfo[packingIndex].openingQty || 0;
    
    if (operation === "add") {
      newStock += quantity;
    } else if (operation === "subtract") {
      newStock -= quantity;
      if (newStock < 0) newStock = 0;
    }
    
    // Update the packing info
    product.packingInfo[packingIndex].openingQty = newStock;
    await product.save();
    
    res.status(200).json({ 
      success: true, 
      message: `Stock updated successfully`, 
      data: { productId, measurement, newStock } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// BULK UPDATE PRODUCT STOCK
export const bulkUpdateProductStock = async (req, res) => {
  try {
    const { items, operation } = req.body;
    // items: array of { productId, measurement, quantity }
    // operation: "add" or "subtract"
    
    const results = [];
    
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        results.push({ ...item, success: false, message: "Product not found" });
        continue;
      }
      
      const packingIndex = product.packingInfo.findIndex(p => p.measurement === item.measurement);
      if (packingIndex === -1) {
        results.push({ ...item, success: false, message: "Packing info not found" });
        continue;
      }
      
      let newStock = product.packingInfo[packingIndex].openingQty || 0;
      
      if (operation === "add") {
        newStock += item.quantity;
      } else if (operation === "subtract") {
        newStock -= item.quantity;
        if (newStock < 0) newStock = 0;
      }
      
      product.packingInfo[packingIndex].openingQty = newStock;
      await product.save();
      
      results.push({ ...item, success: true, newStock });
    }
    
    res.status(200).json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};