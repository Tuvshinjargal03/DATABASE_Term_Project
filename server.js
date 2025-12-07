import express from "express";
import sqlite3 from "sqlite3";
import fs from "fs";
import cors from "cors";
import path from "path";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.resolve(process.cwd(), "database.db");
const db = new sqlite3.Database(DB_FILE);

const schemaFile = path.resolve(process.cwd(), "schema.sql");
const schemaSQL = fs.readFileSync(schemaFile, "utf8");

schemaSQL.split(";").forEach(stmt => {
    const s = stmt.trim();
    if (s.length > 0) db.run(s);
});

app.set("db", db);

// -------------------------------------------------------------
// AUTH MIDDLEWARE
// -------------------------------------------------------------
function authRequired(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
        const decoded = jwt.verify(token, "secret123");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Access denied" });
        }
        next();
    };
}

// -------------------------------------------------------------
// AUDIT LOGGER
// -------------------------------------------------------------
function writeAuditLog(db, userId, action, tableName, objectId, oldData, newData) {
    db.run(
        `INSERT INTO Audit_Log (event_time, actor_user_id, action, object_table, object_id, old_data, new_data)
         VALUES (datetime('now'), ?, ?, ?, ?, ?, ?)`,
        [userId, action, tableName, objectId, oldData, newData]
    );
}

app.set("audit", writeAuditLog);

// -------------------------------------------------------------
// IMPORT ROUTES
// -------------------------------------------------------------
import authRoutes from "./routes/auth.js";
import campaignRoutes from "./routes/campaigns.js";
import donationRoutes from "./routes/donations.js";
import allocationRoutes from "./routes/allocation.js";
import receiverRoutes from "./routes/receiver.js";
import disbursementRoutes from "./routes/disbursement.js";
import auditRoutes from "./routes/audit.js";
import documentRoutes from "./routes/document.js";

// Register
app.use("/auth", authRoutes);
app.use("/campaigns", authRequired, campaignRoutes);
app.use("/donations", authRequired, donationRoutes);
app.use("/allocations", authRequired, allocationRoutes);
app.use("/receivers", authRequired, receiverRoutes);
app.use("/disbursements", authRequired, disbursementRoutes);
app.use("/audit", authRequired, requireRole("Auditor", "Admin"), auditRoutes);
app.use("/documents", authRequired, documentRoutes);

app.listen(8081, () => console.log("Backend running at http://localhost:8081"));
