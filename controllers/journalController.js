import JournalVoucher from "../models/JournalVoucher.js";
import Customer from "../models/Customer.js";

// GET /api/journal  — all JVs, newest first + optional search
export const getAll = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      const r = new RegExp(search, "i");
      query = {
        $or: [
          { jvNo: r },
          { debitAccountTitle: r },
          { creditAccountTitle: r },
          { debitDescription: r },
          { creditDescription: r },
          { debitInvoice: r },
        ],
      };
    }
    const data = await JournalVoucher.find(query)
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /api/journal/next-jv
export const getNextJv = async (req, res) => {
  try {
    const last = await JournalVoucher.findOne(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    let num = 1;
    if (last?.jvNo) {
      const n = parseInt(last.jvNo.replace("JV-", ""));
      if (!isNaN(n)) num = n + 1;
    }
    res.json({
      success: true,
      data: { jvNo: `JV-${String(num).padStart(5, "0")}` },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/journal
export const create = async (req, res) => {
  try {
    const jv = new JournalVoucher(req.body);
    await jv.save();

    // If debit account is a customer → update their currentBalance (they paid us → reduce balance)
    if (
      req.body.debitAccountId &&
      req.body.creditAccountTitle?.toLowerCase().includes("sale")
    ) {
      // credit = SALE means customer is paying us → reduce customer balance
    }
    // If credit account is a customer → they owe more
    // Balance update logic: when debitAccountTitle = customer & creditAccountTitle = SALE/CASH
    // → customer paid → reduce currentBalance
    if (req.body.debitAccountId) {
      const cust = await Customer.findById(req.body.debitAccountId);
      if (cust) {
        // Debit on customer = they received (we gave them money) OR they paid us (depends on context)
        // In this shop context: Debit customer = they owe us (sale on credit)
        // Credit customer = they paid us (payment received)
        // Since this is general JV, we just save — balance managed separately
      }
    }

    res.status(201).json({ success: true, data: jv });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// PUT /api/journal/:id
export const update = async (req, res) => {
  try {
    const jv = await JournalVoucher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!jv)
      return res.status(404).json({ success: false, message: "JV not found" });
    res.json({ success: true, data: jv });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// DELETE /api/journal/:id
export const remove = async (req, res) => {
  try {
    const jv = await JournalVoucher.findByIdAndDelete(req.params.id);
    if (!jv)
      return res.status(404).json({ success: false, message: "JV not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /api/journal/accounts  — returns customers + fixed accounts for dropdown
export const getAccounts = async (req, res) => {
  try {
    const { search } = req.query;
    const FIXED = [
      { _id: "CASH", title: "CASH", type: "fixed" },
      { _id: "SALE", title: "SALE", type: "fixed" },
      { _id: "PURCHASE", title: "PURCHASE", type: "fixed" },
      { _id: "BANK", title: "BANK", type: "fixed" },
      { _id: "CAPITAL", title: "CAPITAL", type: "fixed" },
      { _id: "EXPENSE", title: "EXPENSE", type: "fixed" },
      { _id: "DRAWINGS", title: "DRAWINGS", type: "fixed" },
      { _id: "DISCOUNT", title: "DISCOUNT", type: "fixed" },
    ];

    let custQuery = {};
    if (search) custQuery = { name: new RegExp(search, "i") };

    const customers = await Customer.find(custQuery)
      .limit(50)
      .select("name phone currentBalance type");
    const custList = customers.map((c) => ({
      _id: c._id,
      title: c.name,
      phone: c.phone,
      balance: c.currentBalance || 0,
      type: "customer",
    }));

    // Filter fixed by search too
    const fixedFiltered = search
      ? FIXED.filter((f) =>
          f.title.toLowerCase().includes(search.toLowerCase()),
        )
      : FIXED;

    res.json({ success: true, data: [...fixedFiltered, ...custList] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
