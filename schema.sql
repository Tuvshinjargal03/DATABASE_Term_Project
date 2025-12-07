PRAGMA foreign_keys = ON;

---------------------------------------------------------
-- 1. USER TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS User (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT
);

---------------------------------------------------------
-- 2. CAMPAIGN TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Campaign (
    campaign_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES User(user_id)
);

---------------------------------------------------------
-- 3. DONATION TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Donation (
    donation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    donor_id INTEGER,
    campaign_id INTEGER,
    amount INTEGER CHECK (amount > 0),
    donated_at TEXT,
    verified INTEGER DEFAULT 0,
    FOREIGN KEY (donor_id) REFERENCES User(user_id),
    FOREIGN KEY (campaign_id) REFERENCES Campaign(campaign_id)
);

---------------------------------------------------------
-- 4. RECEIVER TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Receiver (
    receiver_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    bank_account TEXT
);

---------------------------------------------------------
-- 5. ALLOCATION TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Allocation (
    allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    donation_id INTEGER,
    campaign_id INTEGER,
    receiver_id INTEGER,
    amount INTEGER CHECK (amount >= 0),
    status TEXT,
    FOREIGN KEY (donation_id) REFERENCES Donation(donation_id),
    FOREIGN KEY (campaign_id) REFERENCES Campaign(campaign_id),
    FOREIGN KEY (receiver_id) REFERENCES Receiver(receiver_id)
);

---------------------------------------------------------
-- 6. DISBURSEMENT TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Disbursement (
    disbursement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    allocation_id INTEGER UNIQUE,
    executed_by INTEGER,
    executed_at TEXT,
    amount INTEGER,
    status TEXT,
    payment_tx_ref TEXT,
    FOREIGN KEY (allocation_id) REFERENCES Allocation(allocation_id),
    FOREIGN KEY (executed_by) REFERENCES User(user_id)
);

---------------------------------------------------------
-- 7. DOCUMENT TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Document (
    document_id INTEGER PRIMARY KEY AUTOINCREMENT,
    disbursement_id INTEGER,
    storage_path TEXT,
    file_hash TEXT NOT NULL,
    uploaded_by INTEGER,
    FOREIGN KEY (disbursement_id) REFERENCES Disbursement(disbursement_id),
    FOREIGN KEY (uploaded_by) REFERENCES User(user_id)
);

---------------------------------------------------------
-- 8. AUDIT LOG TABLE
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Audit_Log (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_time TEXT,
    actor_user_id INTEGER,
    action TEXT,
    object_table TEXT,
    object_id INTEGER,
    old_data TEXT,
    new_data TEXT,
    FOREIGN KEY (actor_user_id) REFERENCES User(user_id)
);
