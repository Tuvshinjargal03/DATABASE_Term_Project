// ===============================================================
// SIMULATED BACKEND (In-Memory Database & API Functions)
// ===============================================================

const API = "/api"; 
let TOKEN = null;
let USER = null;

// Simulated Database
const DB = {
    users: [
        { id: 1, username: "admin1", password: "password", email: "a@dts.org", role: "Admin" },
        { id: 2, username: "donor1", password: "password", email: "d1@dts.org", role: "Donor" },
        { id: 3, username: "operator1", password: "password", email: "o1@dts.org", role: "Operator" },
        { id: 4, username: "accountant1", password: "password", email: "ac1@dts.org", role: "Accountant" },
        { id: 5, username: "auditor1", password: "password", email: "au1@dts.org", role: "Auditor" },
    ],
    campaigns: [
        { campaign_id: 101, title: "School Lunch Program", description: "Providing daily meals for children.", start_date: "2024-01-01", end_date: "2024-12-31", created_by: "admin1", balance: 0 },
        { campaign_id: 102, title: "Water Well Project", description: "Building wells in rural communities.", start_date: "2024-03-01", end_date: "2025-03-01", created_by: "operator1", balance: 0 },
    ],
    donations: [], // { id, user_id, campaign_id, amount, donated_at, verified }
    allocations: [], // { id, donation_id, campaign_id, receiver_id, amount, status }
    receivers: [
        { receiver_id: 201, name: "Community Hospital", type: "Hospital", bank_account: "12345678" },
        { receiver_id: 202, name: "Local School District", type: "Education", bank_account: "87654321" },
    ],
    disbursements: [], // { id, allocation_id, executed_by, amount, executed_at, payment_tx_ref }
    documents: [], // { id, disbursement_id, storage_path, file_hash, uploaded_by }
    auditLogs: [], // { id, event_time, actor_user_id, action, object_table, object_id, old_data, new_data }
    
    donationCounter: 1000,
    campaignCounter: 103,
    allocationCounter: 5000,
    disbursementCounter: 2000,
    receiverCounter: 300,
    auditCounter: 9000
};

// --- AUDIT LOGGER ---
function audit(userId, action, table, objectId, oldData, newData) {
    const log = {
        id: DB.auditCounter++,
        event_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
        actor_user_id: userId,
        action: action,
        object_table: table,
        object_id: objectId,
        old_data: oldData ? JSON.stringify(oldData) : null,
        new_data: newData ? JSON.stringify(newData) : null,
    };
    DB.auditLogs.push(log);
}

// --- SIMULATED API FUNCTIONS ---
async function api(url, method = "GET", body = null) {
    await new Promise(r => setTimeout(r, 300)); // Simulate network latency

    if (url === "/auth/login" && method === "POST") {
        const { username, password } = body;
        const user = DB.users.find(u => u.username === username && u.password === password);
        if (user) {
            return { success: true, token: `fake-jwt-${user.id}`, user: { id: user.id, username: user.username, role: user.role } };
        }
        return { success: false, error: "Invalid username or password" };
    }

    if (!USER) return { success: false, error: "Authentication required" };

    
    // ===============================================================
    // CAMPAIGNS (GET/POST)
    // ===============================================================
    if (url === "/campaigns" && method === "GET") {
        return DB.campaigns;
    }
    if (url === "/campaigns" && method === "POST" && (USER.role === "Operator" || USER.role === "Admin")) {
        const { title, description, endDate } = body;
        if (!title || !description || !endDate) return { success: false, error: "Missing campaign data." };
        
        const campaign = {
            campaign_id: DB.campaignCounter++,
            title, description, 
            start_date: new Date().toISOString().slice(0, 10), 
            end_date: endDate, 
            created_by: USER.username, 
            balance: 0
        };
        DB.campaigns.push(campaign);
        audit(USER.id, "CREATE", "Campaign", campaign.campaign_id, null, { title, description });
        return { success: true, campaign };
    }

    // ===============================================================
    // DONATIONS (GET/POST/PUT)
    // ===============================================================
    if (url === "/donations" && method === "POST" && USER.role === "Donor") {
        const { campaign_id, amount: rawAmount } = body;
        const amount = parseFloat(rawAmount);
        
        if (isNaN(amount) || amount <= 0) return { success: false, error: "Invalid amount." };
        if (!DB.campaigns.find(c => c.campaign_id == campaign_id)) return { success: false, error: "Campaign not found." };
        
        const donation = {
            id: DB.donationCounter++,
            user_id: USER.id,
            campaign_id: parseInt(campaign_id),
            amount: amount.toFixed(2),
            donated_at: new Date().toISOString().slice(0, 10),
            verified: false
        };
        DB.donations.push(donation);
        
        // --- SIMULATE ALLOCATION CREATION (Operator's responsibility, but automated for demo) ---
        // Create an allocation that equals the donation amount, awaiting Operator approval
        DB.allocations.push({
            id: DB.allocationCounter++,
            donation_id: donation.id,
            campaign_id: donation.campaign_id,
            // Assign to a random receiver for demo purposes
            receiver_id: DB.receivers[Math.floor(Math.random() * DB.receivers.length)].receiver_id,
            amount: amount.toFixed(2),
            status: "pending"
        });
        // ------------------------------------------------------------------------------------------

        audit(USER.id, "CREATE", "Donation", donation.id, null, { campaign_id, amount });
        return { success: true, donation };
    }

    if (url === "/donations" && method === "GET") {
        const donationsWithInfo = DB.donations.map(d => {
            const campaign = DB.campaigns.find(c => c.campaign_id === d.campaign_id);
            const donor = DB.users.find(u => u.id === d.user_id);
            return {
                ...d,
                campaign_title: campaign ? campaign.title : "Unknown Campaign",
                donor_name: donor ? donor.username : "Unknown Donor"
            };
        });

        if (USER.role === "Donor") {
            return donationsWithInfo.filter(d => d.user_id === USER.id);
        }
        return donationsWithInfo; 
    }

    if (url.match(/^\/donations\/\d+\/verify$/) && method === "PUT" && (USER.role === "Operator" || USER.role === "Admin")) {
        const id = parseInt(url.split('/')[2]);
        const donation = DB.donations.find(d => d.id === id);
        if (donation) {
            if (donation.verified) return { success: false, error: "Donation already verified." };
            donation.verified = true;
            
            // Note: Campaign balance update logic moved to Allocation Approval/Disbursement steps in real world, 
            // but kept here for simple demo to show the impact of verification.
            const campaign = DB.campaigns.find(c => c.campaign_id === donation.campaign_id);
            if (campaign) {
                campaign.balance = (campaign.balance + parseFloat(donation.amount));
            }

            audit(USER.id, "VERIFY", "Donation", id, { verified: false }, { verified: true });
            return { success: true, message: "Donation verified." };
        }
        return { success: false, error: "Donation not found." };
    }

    // ===============================================================
    // ALLOCATIONS (GET/PUT)
    // ===============================================================
    if (url === "/allocations" && method === "GET") {
        const allocationsWithInfo = DB.allocations.map(a => {
            const donation = DB.donations.find(d => d.id === a.donation_id);
            const campaign = DB.campaigns.find(c => c.campaign_id === a.campaign_id);
            const receiver = DB.receivers.find(r => r.receiver_id === a.receiver_id);
            const donor = donation ? DB.users.find(u => u.id === donation.user_id) : { username: 'N/A' };
            
            return {
                ...a,
                campaign_title: campaign ? campaign.title : "Unknown Campaign",
                receiver_name: receiver ? receiver.name : "Unknown Receiver",
                donor_name: donor.username,
                donation_verified: donation ? donation.verified : false
            };
        });

        if (USER.role === "Donor") {
            const donorDonationIds = DB.donations.filter(d => d.user_id === USER.id).map(d => d.id);
            return allocationsWithInfo.filter(a => donorDonationIds.includes(a.donation_id)); //
        }
        return allocationsWithInfo;
    }
    
    // PUT /allocations/:id/status (Approve/Reject - Operator/Accountant)
    if (url.match(/^\/allocations\/\d+\/status$/) && method === "PUT" && (USER.role === "Operator" || USER.role === "Accountant" || USER.role === "Admin")) {
        const id = parseInt(url.split('/')[2]);
        const { status } = body;
        const allocation = DB.allocations.find(a => a.id === id);

        if (!allocation) return { success: false, error: "Allocation not found." };
        if (!["approved", "rejected", "pending"].includes(status)) return { success: false, error: "Invalid status." };

        const oldStatus = allocation.status;
        allocation.status = status;
        
        // If approved, increment campaign balance temporarily (simplified)
        // In a real system, the balance would have been updated at Verification.
        // For demo: if status changes to APPROVED, we track it.
        
        audit(USER.id, "UPDATE_STATUS", "Allocation", id, { status: oldStatus }, { status: status }); //
        return { success: true, message: `Allocation ${id} set to ${status}.` };
    }

    // ===============================================================
    // RECEIVERS (GET/POST)
    // ===============================================================
    if (url === "/receivers" && method === "GET") {
        return DB.receivers;
    }

    if (url === "/receivers" && method === "POST" && (USER.role === "Accountant" || USER.role === "Admin")) {
        const { name, type, bank_account } = body;
        if (!name || !type || !bank_account) return { success: false, error: "All fields are required." };

        const receiver = {
            receiver_id: DB.receiverCounter++,
            name, type, bank_account
        };
        DB.receivers.push(receiver);
        audit(USER.id, "CREATE", "Receiver", receiver.receiver_id, null, { name, type });
        return { success: true, receiver };
    }

    // ===============================================================
    // DISBURSEMENTS (GET/POST)
    // ===============================================================
    if (url === "/disbursements" && method === "POST" && (USER.role === "Accountant" || USER.role === "Admin")) {
        const { allocation_id, amount: rawAmount, payment_tx_ref } = body;
        const allocation = DB.allocations.find(a => a.id == allocation_id);
        const amount = parseFloat(rawAmount);

        if (!allocation || allocation.status !== 'approved') return { success: false, error: "Allocation not found or not approved." };
        if (allocation.amount != amount.toFixed(2)) return { success: false, error: "Disbursement amount must match Allocation amount." }; //

        const disbursement = {
            id: DB.disbursementCounter++,
            allocation_id: parseInt(allocation_id),
            executed_by: USER.id,
            executed_at: new Date().toISOString().slice(0, 10),
            amount: amount.toFixed(2),
            status: "completed",
            payment_tx_ref 
        };
        DB.disbursements.push(disbursement);
        
        // Critical step: Update Allocation status to 'disbursed' (TRANSACTION in real system)
        allocation.status = "disbursed"; 

        audit(USER.id, "DISBURSE", "Disbursement", disbursement.id, null, { allocation_id, amount });
        
        // For the demo, update campaign balance immediately
        const campaign = DB.campaigns.find(c => c.campaign_id === allocation.campaign_id);
        if (campaign) {
            campaign.balance = (campaign.balance - parseFloat(amount));
        }

        return { success: true, disbursement, newBalance: campaign.balance.toFixed(2) };
    }
    
    if (url === "/disbursements" && method === "GET") {
        return DB.disbursements.map(d => {
            const allocation = DB.allocations.find(a => a.id === d.allocation_id);
            const campaign = allocation ? DB.campaigns.find(c => c.campaign_id === allocation.campaign_id) : null;
            const receiver = allocation ? DB.receivers.find(r => r.receiver_id === allocation.receiver_id) : null;
            const executedBy = DB.users.find(u => u.id === d.executed_by);
            return {
                ...d,
                campaign_title: campaign ? campaign.title : "Unknown Campaign",
                receiver_name: receiver ? receiver.name : "Unknown Receiver",
                recorded_by: executedBy ? executedBy.username : "System"
            };
        });
    }
    
    // ===============================================================
    // DOCUMENTS (POST)
    // ===============================================================
    if (url === "/documents" && method === "POST" && (USER.role === "Accountant" || USER.role === "Admin")) {
        const { disbursement_id, storage_path, file_hash } = body;
        
        if (!DB.disbursements.find(d => d.id == disbursement_id)) return { success: false, error: "Disbursement not found." };
        if (!file_hash) return { success: false, error: "File hash is required for integrity." }; //

        const document = {
            id: DB.documents.length + 1,
            disbursement_id: parseInt(disbursement_id),
            storage_path,
            file_hash,
            uploaded_by: USER.id,
            uploaded_at: new Date().toISOString().slice(0, 10)
        };
        DB.documents.push(document);

        audit(USER.id, "UPLOAD_DOC", "Document", document.id, null, { disbursement_id });
        return { success: true, document };
    }

    // ===============================================================
    // AUDIT LOGS (GET)
    // ===============================================================
    if (url === "/audit" && method === "GET" && (USER.role === "Auditor" || USER.role === "Admin")) {
        // Auditor/Admin sees all logs
        return DB.auditLogs.map(log => {
            const actor = DB.users.find(u => u.id === log.actor_user_id);
            return {
                ...log,
                actor_name: actor ? actor.username : "System/Unknown"
            };
        });
    }

    return { success: false, error: "API Endpoint not found or unauthorized." };
}


// ===============================================================
// FRONTEND FUNCTIONS
// ===============================================================

document.addEventListener('DOMContentLoaded', () => {
    showView('home-view');
});

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  
  document.getElementById("login-error").classList.add("hidden");
  document.getElementById("signup-error").classList.add("hidden");
}

// ---------------------- AUTH -----------------------------------
async function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.classList.add("hidden");
  
  if (!username || !password) {
      errorEl.innerText = "Please enter both username and password.";
      errorEl.classList.remove("hidden");
      return;
  }

  const result = await api("/auth/login", "POST", { username, password });

  if (!result.success) {
    errorEl.innerText = result.error || "Login failed";
    errorEl.classList.remove("hidden");
    return;
  }

  TOKEN = result.token;
  USER = result.user;

  document.getElementById("welcome-text").innerText = `Welcome, ${USER.username} (${USER.role})`;
  showView('dashboard-view');
  
  showPanelsByRole();
  loadCampaigns(); 
  loadInitialDashboardData();
}

function signup() {
    const username = document.getElementById("signup-username").value;
    const email = document.getElementById("signup-email").value;
    const pass1 = document.getElementById("signup-password").value;
    const pass2 = document.getElementById("signup-password2").value;
    const role = document.getElementById("signup-role").value;
    const errorEl = document.getElementById("signup-error");
    errorEl.classList.add("hidden");

    if (!username || !email || !pass1 || !pass2 || !role) {
        errorEl.innerText = "Please fill in all fields.";
        errorEl.classList.remove("hidden");
        return;
    }
    if (pass1 !== pass2) {
        errorEl.innerText = "Passwords do not match.";
        errorEl.classList.remove("hidden");
        return;
    }
    
    if (DB.users.some(u => u.username === username)) {
        errorEl.innerText = "Username already exists.";
        errorEl.classList.remove("hidden");
        return;
    }
    
    // FIX: Add user to simulated DB for demo purposes
    const newId = DB.users.length + 10; 
    const newUser = {
        id: newId,
        username: username,
        password: pass1, 
        email: email,
        role: role
    };
    DB.users.push(newUser);

    alert(`Signup successful for ${username} (${role}). You can now log in with ${username} and the password you chose.`);
    showView('login-view');
    document.getElementById("signup-username").value = '';
    document.getElementById("signup-password").value = '';
    document.getElementById("signup-password2").value = '';
    document.getElementById("signup-email").value = '';
}


function logout() {
  TOKEN = null;
  USER = null;
  showView('home-view');
}


// ---------------------- DASHBOARD INIT -------------------------
function hideAllPanels() {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
}

function showPanelsByRole() {
  hideAllPanels();

  if (!USER) return;

  const r = USER.role;

  if (r === "Donor") document.getElementById("donor-section").classList.remove("hidden");
  if (r === "Operator") document.getElementById("operator-section").classList.remove("hidden");
  if (r === "Accountant") document.getElementById("accountant-section").classList.remove("hidden");
  if (r === "Auditor") document.getElementById("auditor-section").classList.remove("hidden");
  if (r === "Admin") {
    // Admin sees everything
    document.getElementById("donor-section").classList.remove("hidden");
    document.getElementById("operator-section").classList.remove("hidden");
    document.getElementById("accountant-section").classList.remove("hidden");
    document.getElementById("auditor-section").classList.remove("hidden");
  }
}

async function loadInitialDashboardData() {
    loadCampaigns(); // Needed by Donor, Operator, Accountant
    if (USER.role === "Donor" || USER.role === "Admin") loadDonorDonations();
    if (USER.role === "Operator" || USER.role === "Admin") {
        loadAllDonations();
        loadAllocationApprovals();
    }
    if (USER.role === "Accountant" || USER.role === "Admin") {
        loadReceivers();
        loadApprovedAllocationsForDisbursement();
        loadDisbursementsForDocumentUpload();
    }
    if (USER.role === "Auditor" || USER.role === "Admin") {
        loadAllAllocations();
        loadAllDisbursements();
        loadAuditLogs();
    }
}


// ---------------------- CAMPAIGNS ------------------------------
async function loadCampaigns() {
  const table = document.getElementById("campaign-table");
  const select = document.getElementById("donor-campaign-select");

  const data = await api("/campaigns");

  if (!data || data.error) return;

  // Fill donor dropdown
  if (select) {
    select.innerHTML = '<option value="" disabled selected>Select Campaign</option>';
    data.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.campaign_id;
      opt.innerText = `${c.title}`;
      select.appendChild(opt);
    });
  }

  // Fill Operator/Admin campaign management table
  if (table) {
    let html =       `<tr>
          <th>ID</th>
          <th>Title</th>
          <th>Balance</th>
          <th>Dates</th>
          <th>Created By</th>
          <th>Description</th>
      </tr>`;
    data.forEach(c => {
      html +=         `<tr>
          <td>${c.campaign_id}</td>
          <td>${c.title}</td>
          <td>$${c.balance.toFixed(2)}</td>
          <td>${c.start_date} → ${c.end_date}</td>
          <td>${c.created_by}</td>
          <td>${c.description}</td>
        </tr>`;
    });

    table.innerHTML = html;
  }
}

async function createCampaign() {
    const title = document.getElementById("new-campaign-title").value;
    const description = document.getElementById("new-campaign-desc").value;
    const endDate = document.getElementById("new-campaign-enddate").value;

    if (!title || !description || !endDate) {
        alert("Please fill in all campaign fields.");
        return;
    }
    
    const result = await api("/campaigns", "POST", { title, description, endDate });
    
    alert(result.success ? `Campaign "${title}" added!` : result.error);
    if (result.success) {
        document.getElementById("new-campaign-title").value = '';
        document.getElementById("new-campaign-desc").value = '';
        document.getElementById("new-campaign-enddate").value = '';
        loadCampaigns(); // Reload tables and dropdowns
    }
}


// ---------------------- DONOR ----------------------------------
async function submitDonation() {
  const campId = document.getElementById("donor-campaign-select").value;
  const amount = document.getElementById("donor-donation-amount").value;

  if (!campId || !amount) {
    alert("Please enter amount and select a campaign.");
    return;
  }

  const result = await api("/donations", "POST", { campaign_id: campId, amount });

  alert(result.success ? `Donation of $${parseFloat(amount).toFixed(2)} submitted! Verification/Allocation pending.` : result.error);
  if (result.success) {
      document.getElementById("donor-donation-amount").value = '';
  }
  loadInitialDashboardData(); // Reload all necessary tables
}

async function loadDonorDonations() {
  const table = document.getElementById("donor-donations-table");
  if (!table) return;

  const data = await api("/donations");
  const allocations = await api("/allocations"); // Load donor's allocations for tracing

  let html =       `<tr>
          <th>ID</th>
          <th>Campaign</th>
          <th>Amount</th>
          <th>Verified</th>
          <th>Allocated</th>
          <th>Date</th>
      </tr>`;
      
  data.forEach(d => {
    // Check if any allocation exists for this donation ID
    const allocated = allocations.some(a => a.donation_id === d.id);
    
    html +=       `<tr>
        <td>${d.id}</td>
        <td>${d.campaign_title}</td>
        <td>$${d.amount}</td>
        <td>${d.verified ? "Yes" : "Pending"}</td>
        <td>${allocated ? `<i class="fa-solid fa-arrow-right" style="color:blue;"></i>` : "No"}</td>
        <td>${d.donated_at}</td>
      </tr>`;
  });

  table.innerHTML = html;
}


// ---------------------- OPERATOR -------------------------------
async function loadAllDonations() {
  const table = document.getElementById("verify-donations-table");
  if (!table) return;

  const data = await api("/donations");

  let html =       `<tr>
          <th>ID</th>
          <th>Donor</th>
          <th>Campaign</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Action</th>
      </tr>`;
  data.forEach(d => {
    const actionButton = (!d.verified && (USER.role === "Operator" || USER.role === "Admin"))
        ? `<button onclick="verifyDonation(${d.id})">Verify</button>`
        : `<i class="fa-solid fa-check" style="color:#2c6f41;"></i> Verified`;
        
    html +=       `<tr>
        <td>${d.id}</td>
        <td>${d.donor_name}</td>
        <td>${d.campaign_title}</td>
        <td>$${d.amount}</td>
        <td>${d.verified ? "Verified" : "Pending"}</td>
        <td>${actionButton}</td>
      </tr>`;
  });

  table.innerHTML = html;
}

async function verifyDonation(id) {
  const result = await api(`/donations/${id}/verify`, "PUT");
  alert(result.success ? "Donation verified! Campaign balance updated (Demo)." : result.error);
  loadInitialDashboardData();
}

async function loadAllocationApprovals() {
    const table = document.getElementById("allocation-approval-table");
    if (!table) return;

    // Operator only needs to see pending allocations for approval
    const allAllocations = await api("/allocations");
    const pendingAllocations = allAllocations.filter(a => a.status === 'pending' && a.donation_verified === true);
    
    let html =       `<tr>
            <th>Alloc ID</th>
            <th>Donation ID</th>
            <th>Campaign</th>
            <th>Receiver</th>
            <th>Amount</th>
            <th>Action</th>
        </tr>`;

    pendingAllocations.forEach(a => {
        const actionButtons = `
            <button onclick="updateAllocationStatus(${a.id}, 'approved', ${a.amount}, ${a.campaign_id})" style="background-color: #3178c6;">Approve</button>
            <button onclick="updateAllocationStatus(${a.id}, 'rejected')" style="background-color: #c63131;">Reject</button>
        `;
        html +=       `<tr>
            <td>${a.id}</td>
            <td>${a.donation_id} (${a.donor_name})</td>
            <td>${a.campaign_title}</td>
            <td>${a.receiver_name}</td>
            <td>$${a.amount}</td>
            <td>${actionButtons}</td>
        </tr>`;
    });
    table.innerHTML = html;
}

async function updateAllocationStatus(id, status, amount, campaignId) {
    const result = await api(`/allocations/${id}/status`, "PUT", { status });
    alert(result.success ? `Allocation ${id} status changed to ${status}!` : result.error);

    // If approved, add amount to campaign balance in demo (simplified)
    // NOTE: This logic is heavily simplified for the client-side demo.
    if(status === 'approved') {
        const campaign = DB.campaigns.find(c => c.campaign_id === campaignId);
        if (campaign) {
            campaign.balance = (campaign.balance + parseFloat(amount));
            alert(`Campaign balance updated with allocated amount $${amount}. (Demo)`);
        }
    }
    
    loadInitialDashboardData();
}


// ---------------------- ACCOUNTANT -----------------------------
async function loadReceivers() {
  const table = document.getElementById("receiver-table");
  if (!table) return;

  const data = await api("/receivers");

  let html =       `<tr>
          <th>ID</th>
          <th>Name</th>
          <th>Type</th>
          <th>Bank/Wallet</th>
      </tr>`;
  data.forEach(r => {
    html +=       `<tr>
        <td>${r.receiver_id}</td>
        <td>${r.name}</td>
        <td>${r.type}</td>
        <td>${r.bank_account}</td>
      </tr>`;
  });
  table.innerHTML = html;
}

async function createReceiver() {
  const name = document.getElementById("r-name").value;
  const type = document.getElementById("r-type").value;
  const bank = document.getElementById("r-bank").value;
  
  if (!name || !type || !bank) {
      alert("Please fill in all receiver fields.");
      return;
  }

  const result = await api("/receivers", "POST", { name, type, bank_account: bank });

  alert(result.success ? "Receiver added!" : result.error);
  if (result.success) {
      document.getElementById("r-name").value = '';
      document.getElementById("r-type").value = '';
      document.getElementById("r-bank").value = '';
  }
  loadReceivers();
}

async function loadApprovedAllocationsForDisbursement() {
    const select = document.getElementById("disburse-allocation-select");
    if (!select) return;

    // Accountant only needs to see APPROVED allocations ready for payment
    const allAllocations = await api("/allocations");
    const approvedAllocations = allAllocations.filter(a => a.status === 'approved');

    select.innerHTML = '<option value="" disabled selected>Select Approved Allocation (ID - Campaign - Amount)</option>';
    approvedAllocations.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.setAttribute('data-amount', a.amount);
        opt.innerText = `${a.id} - ${a.campaign_title} (${a.receiver_name}) - $${a.amount}`;
        select.appendChild(opt);
    });
}

async function submitDisbursement() {
    const allocationId = document.getElementById("disburse-allocation-select").value;
    const txRef = document.getElementById("disburse-tx-ref").value;
    
    if (!allocationId) {
        alert("Please select an approved allocation.");
        return;
    }
    
    const selectedOption = document.querySelector(`#disburse-allocation-select option[value="${allocationId}"]`);
    const amount = selectedOption ? selectedOption.getAttribute('data-amount') : null;

    if (!amount) {
        alert("Error retrieving allocation amount.");
        return;
    }

    const result = await api("/disbursements", "POST", {
        allocation_id: allocationId,
        amount,
        payment_tx_ref: txRef
    });
    
    if (result.success) {
        alert(`Disbursement recorded (TX: ${txRef}). New Campaign Balance: $${result.newBalance}.`);
        document.getElementById("disburse-tx-ref").value = '';
        loadInitialDashboardData();
    } else {
        alert(result.error);
    }
}

async function loadDisbursementsForDocumentUpload() {
    const select = document.getElementById("doc-disbursement-select");
    if (!select) return;

    const data = await api("/disbursements");

    select.innerHTML = '<option value="" disabled selected>Select Disbursement to attach proof</option>';
    data.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.innerText = `ID ${d.id}: $${d.amount} to ${d.receiver_name} on ${d.executed_at}`;
        select.appendChild(opt);
    });
}

async function uploadDocument() {
    const disbursement_id = document.getElementById("doc-disbursement-select").value;
    const storage_path = document.getElementById("doc-storage-path").value;
    const file_hash = document.getElementById("doc-file-hash").value;

    if (!disbursement_id || !storage_path || !file_hash) {
        alert("All document fields are required.");
        return;
    }

    const result = await api("/documents", "POST", { disbursement_id, storage_path, file_hash });

    alert(result.success ? "Document metadata recorded!" : result.error);
    if (result.success) {
        document.getElementById("doc-storage-path").value = '';
        document.getElementById("doc-file-hash").value = '';
        // In a real application, you'd reload a document list here.
    }
}

// ---------------------- AUDITOR --------------------------------
async function loadAllAllocations() {
    const table = document.getElementById("auditor-allocation-table");
    if (!table) return;

    // Auditor sees all allocations
    const data = await api("/allocations");
    
    let html =       `<tr>
            <th>Alloc ID</th>
            <th>Donation ID</th>
            <th>Donor</th>
            <th>Campaign</th>
            <th>Receiver</th>
            <th>Amount</th>
            <th>Status</th>
        </tr>`;

    data.forEach(a => {
        let statusStyle = '';
        if (a.status === 'approved') statusStyle = 'color:blue; font-weight: bold;';
        if (a.status === 'disbursed') statusStyle = 'color:#2c6f41; font-weight: bold;';
        if (a.status === 'rejected') statusStyle = 'color:red;';

        html +=       `<tr>
            <td>${a.id}</td>
            <td>${a.donation_id}</td>
            <td>${a.donor_name}</td>
            <td>${a.campaign_title}</td>
            <td>${a.receiver_name}</td>
            <td>$${a.amount}</td>
            <td style="${statusStyle}">${a.status.toUpperCase()}</td>
        </tr>`;
    });
    table.innerHTML = html;
}

async function loadAllDisbursements() {
  const table = document.getElementById("disbursement-table");
  if (!table) return;

  // Auditor sees all disbursements
  const data = await api("/disbursements");

  let html =       `<tr>
          <th>Disb ID</th>
          <th>Alloc ID</th>
          <th>Receiver</th>
          <th>Amount</th>
          <th>Date</th>
          <th>Recorded By</th>
          <th>TX Ref</th>
      </tr>`;
  data.forEach(d => {
    html +=       `<tr>
        <td>${d.id}</td>
        <td>${d.allocation_id}</td>
        <td>${d.receiver_name}</td>
        <td>$${d.amount}</td>
        <td>${d.executed_at}</td>
        <td>${d.recorded_by}</td>
        <td>${d.payment_tx_ref}</td>
      </tr>`;
  });

  table.innerHTML = html;
}

async function loadAuditLogs() {
    const table = document.getElementById("audit-log-table");
    if (!table) return;

    // Audit logs endpoint requires Auditor/Admin role in a real system
    const data = await api("/audit");

    let html =       `<tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Table</th>
            <th>Object ID</th>
            <th>New Data</th>
        </tr>`;

    data.forEach(log => {
        let actionStyle = '';
        if (log.action === 'DISBURSE') actionStyle = 'color: purple; font-weight: bold;';
        if (log.action === 'CREATE') actionStyle = 'color: #2c6f41;';
        if (log.action === 'UPDATE_STATUS') actionStyle = 'color: blue;';

        html +=       `<tr>
            <td>${log.event_time.split(' ')[1]}</td>
            <td>${log.actor_name}</td>
            <td style="${actionStyle}">${log.action}</td>
            <td>${log.object_table}</td>
            <td>${log.object_id}</td>
            <td>${log.new_data}</td>
        </tr>`;
    });
    table.innerHTML = html;
}