const express = require("express");
const mysql = require("mysql");
const path = require("path");  // ✅ Import path module
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

let connection;

function handleDisconnect() {
    connection = mysql.createConnection(dbConfig);

    connection.connect((err) => {
        if (err) {
            console.error("Database connection failed:", err);
            setTimeout(handleDisconnect, 5000);
        } else {
            console.log("Connected to MySQL database!");
        }
    });

    connection.on("error", (err) => {
        console.error("Database error:", err);
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

// ✅ Serve index.html when visiting "/"
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ API to get users
app.get("/users", (req, res) => {
    connection.query("SELECT * FROM users", (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(results);
        }
    });
});

const bcrypt = require("bcrypt");

app.post("/login", (req, res) => {
    const { email, password, userType } = req.body;
    const table = userType === "owner" ? "owners" : "staff";

    const query = "SELECT * FROM ?? WHERE email = ?";
    connection.query(query, [table, email], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }

        if (results.length > 0) {
            if (results[0].password === password) {
                res.json({ success: true });
            } else {
                res.json({ success: false, message: "Invalid credentials" });
            }
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    });
});

app.get("/complaints", (req, res) => {
    const sql = "SELECT * FROM complaints";
    connection.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching complaints:", err);
            return res.status(500).send(err);
        }
        res.json(result);
    });
});

app.get("/amenity_bookings", (req, res) => {
    const sql = "SELECT * FROM amenity_bookings";
    connection.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching amenities:", err); // renamed message for clarity
            return res.status(500).send(err);
        }
        res.json(result);
    });
});

app.get('/getUserDetails', (req, res) => {
    const { email, userType } = req.query;

    if (!email || !userType) {
        console.error("Missing email or userType:", email, userType);
        return res.status(400).json({ success: false, message: "Missing email or userType" });
    }

    const table = userType === 'staff' ? 'staff' : 'owners';
    const query = `SELECT * FROM ${table} WHERE email = ?`;

    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error("DB Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: "User not found" });
        }

        res.json({ success: true, user: results[0] });
    });
});

app.post("/book-amenity", (req, res) => {
    const {
        amenity_name,
        amenity_number,
        owner_name,
        flat_number,
        phone_number,
        booking_date,
        start_time,
        end_time
    } = req.body;

    const query = `
        INSERT INTO amenity_bookings 
        (amenity_name, amenity_number, owner_name, flat_number, phone_number, booking_date, start_time, end_time) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;


    connection.query(query, [
        amenity_name,
        amenity_number,
        owner_name,
        flat_number,
        phone_number,
        booking_date,
        start_time,
        end_time
    ], (err, result) => {
        if (err) {
            console.error("Booking error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        res.json({ success: true, message: "Booking successful" });
    });
});

// ✅ Add this route to serve visitors data
app.get('/visitors', (req, res) => {
    const query = 'SELECT * FROM visitors ORDER BY visit_time DESC';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching visitors:', err);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(results);
        }
    });
});

app.get('/getUserComplaints', (req, res) => {
    const email = req.query.email;

    const sql = 'SELECT * FROM complaints WHERE email = ?';
    connection.query(sql, [email], (err, result) => {
        if (err) {
            console.error('Error fetching complaints:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        res.json({ success: true, complaints: result });
    });
});

app.get('/getOwnerInfo', (req, res) => {
    const email = req.query.email;

    if (!email) {
        return res.status(400).json({ success: false, message: "Email is required" });
    }

    const sql = 'SELECT name AS owner_name, flat_number, phone_number FROM owners WHERE email = ?';
    connection.query(sql, [email], (err, results) => {
        if (err) {
            console.error("Error fetching owner info:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Owner not found" });
        }

        res.json({ success: true, data: results[0] });
    });
});

app.post("/submit-complaint", (req, res) => {
    const {
        complaint,
        owner_name,
        flat_number,
        phone_number,
        available_date,
        available_from,
        available_to,
        status,
        email // 👈 Make sure this comes from the frontend
    } = req.body;

    const sql = `
        INSERT INTO complaints 
        (complaint, owner_name, flat_number, phone_number, available_date, available_from, available_to, status, email) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(sql, [
        complaint,
        owner_name,
        flat_number,
        phone_number,
        available_date,
        available_from,
        available_to,
        status,
        email // 👈 Include email in values too
    ], (err, result) => {
        if (err) {
            console.error("Insert complaint error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        res.json({ success: true, message: "Complaint submitted successfully" });
    });
});

app.post("/assign-worker", (req, res) => {
    const { id } = req.body;
    const query = "UPDATE complaints SET status = 'Resolved' WHERE id = ?";

    connection.query(query, [id], (err, result) => {
        if (err) {
            console.error("Error updating complaint:", err);
            return res.status(500).json({ success: false });
        }

        res.json({ success: true });
    });
});

app.post("/submit-amenity", (req, res) => {
    const {
        amenity_name,
        owner_name,
        flat_number,
        phone_number,
        booking_date,
        start_time,
        end_time,
        email
    } = req.body;

    const sql = `
        INSERT INTO amenity_bookings 
        (amenity_name, owner_name, flat_number, phone_number, booking_date, start_time, end_time, email) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(sql, [
        amenity_name,
        owner_name,
        flat_number,
        phone_number,
        booking_date,
        start_time,
        end_time,
        email
    ], (err, result) => {
        if (err) {
            console.error("Insert amenity booking error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        res.json({ success: true, message: "Amenity booking submitted successfully" });
    });
});

app.get('/getUserAmenities', (req, res) => {
    const email = req.query.email;

    const sql = 'SELECT * FROM amenity_bookings WHERE email = ?';
    connection.query(sql, [email], (err, result) => {
        if (err) {
            console.error('Error fetching amenities:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        res.json({ success: true, amenity_bookings: result });
    });
});

// Fetch all messages
app.get("/messages", (req, res) => {
    const query = 'SELECT * FROM chat ORDER BY created_at ASC';
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching messages:", err);
            return res.status(500).json({ success: false });
        }
        res.json(results);
    });
});

app.post("/messages", (req, res) => {
    const { username, text } = req.body;
    console.log("Received message:", username, text); // ✅ Debug line

    const query = 'INSERT INTO chat (username, text) VALUES (?, ?)';
    connection.query(query, [username, text], (err, result) => {
        if (err) {
            console.error("Error inserting message:", err);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true });
    });
});

// Search visitors by name or date
app.post("/search-visitors", (req, res) => {
    const { name, date } = req.body;

    let query = "SELECT * FROM visitors WHERE 1=1";
    let params = [];

    if (name && name.trim() !== "") {
        query += " AND visitor_name LIKE ?";
        params.push(`%${name.trim()}%`);
    }

    if (date && date.trim() !== "") {
        query += " AND DATE(visit_time) LIKE ?";
        params.push(`${date.trim()}%`);
    }

    query += " ORDER BY visit_time DESC";

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Search visitors error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        res.json(results);
    });
});

app.post("/searchUserVisitors", (req, res) => {
    const { name, date, ownerPhone } = req.body;

    let query = "SELECT * FROM visitors WHERE owner_phone = ?";
    let params = [ownerPhone];  // Ensure we filter by the logged-in user's phone number

    if (name && name.trim() !== "") {
        query += " AND visitor_name LIKE ?";
        params.push(`%${name.trim()}%`);
    }

    if (date && date.trim() !== "") {
        query += " AND DATE(visit_time) LIKE ?";
        params.push(`${date.trim()}%`);
    }

    query += " ORDER BY visit_time DESC";

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Search visitors error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        res.json(results);
    });
});

app.post("/searchUserVisitorsByDate", (req, res) => {
    const { name, date, ownerPhone } = req.body;

    let query = "SELECT * FROM visitors WHERE owner_phone = ?";
    let params = [ownerPhone];  // Ensure we filter by the logged-in user's phone number

    if (name && name.trim() !== "") {
        query += " AND visitor_name LIKE ?";
        params.push(`%${name.trim()}%`);
    }

    if (date && date.trim() !== "") {
        query += " AND DATE(visit_time) LIKE ?";
        params.push(`${date.trim()}%`);
    }

    query += " ORDER BY visit_time DESC";

    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Search visitors error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        res.json(results);
    });
});

app.get('/getOwnerDetailsByOTP', (req, res) => {
    const otp = req.query.otp;

    if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required" });
    }

    const sql = "SELECT name, phone_number, flat_number FROM owners WHERE otp = ?";
    connection.query(sql, [otp], (err, results) => {
        if (err) {
            console.error("DB error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length > 0) {
            res.json({ success: true, owner: results[0] });
        } else {
            res.json({ success: false, message: "No user found with that OTP" });
        }
    });
});

app.post('/add-visitor', (req, res) => {
    const { visitor_name, phone_number, flat_number, owner_name, owner_phone } = req.body;

    const sql = `
        INSERT INTO visitors (visitor_name, phone_number, flat_number, owner_name, owner_phone) 
        VALUES (?, ?, ?, ?, ?)
    `;

    connection.query(sql, [visitor_name, phone_number, flat_number, owner_name, owner_phone], (err, result) => {
        if (err) {
            console.error("Error inserting visitor:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, message: "Visitor added successfully" });
    });
});

app.get('/getPayments', (req, res) => {
    const sql = 'SELECT * FROM payment_dues';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching payments:', err);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true, payments: results });
    });
});

app.get('/getDuePayments', (req, res) => {
    const phone = req.query.phone;

    if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const sql = 'SELECT * FROM payment_dues WHERE phone_number = ?';

    connection.query(sql, [phone], (err, results) => {
        if (err) {
            console.error('Error fetching dues:', err);
            return res.status(500).json({ success: false });
        }

        if (results.length === 0) {
            return res.json({ success: true, dues: [], message: 'No user found with that phone number.' });
        }

        const user = results[0];
        const dueBills = [];

        // Check which bills are marked "Not Paid"
        ['water', 'maintenance', 'electricity', 'gas', 'parking', 'internet', 'security', 'clubhouse', 'lift_maintenance', 'housekeeping'].forEach(bill => {
            if (user[bill].toLowerCase() === 'not paid') {
                dueBills.push(bill.charAt(0).toUpperCase() + bill.slice(1)); // Capitalize first letter
            }
        });

        res.json({
            success: true,
            owner_name: user.owner_name,
            flat_number: user.flat_number,
            phone_number: user.phone_number,
            due_bills: dueBills
        });
    });
});

app.get('/getPaidPayments', (req, res) => {
    const phone = req.query.phone;

    if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const sql = 'SELECT * FROM payment_dues WHERE phone_number = ?';

    connection.query(sql, [phone], (err, results) => {
        if (err) {
            console.error('Error fetching paid bills:', err);
            return res.status(500).json({ success: false });
        }

        if (results.length === 0) {
            return res.json({ success: true, paid: [], message: 'No user found with that phone number.' });
        }

        const user = results[0];
        const paidBills = [];

        // Check which bills are marked "Paid"
        ['water', 'maintenance', 'electricity', 'gas', 'parking', 'internet', 'security', 'clubhouse', 'lift_maintenance', 'housekeeping'].forEach(bill => {
            if (user[bill].toLowerCase() === 'paid') {
                paidBills.push(bill.charAt(0).toUpperCase() + bill.slice(1)); // Capitalize first letter
            }
        });

        res.json({
            success: true,
            owner_name: user.owner_name,
            flat_number: user.flat_number,
            phone_number: user.phone_number,
            paid_bills: paidBills
        });
    });
});

app.post('/markBillAsPaid', (req, res) => {
    const { phone_number, bill_type } = req.body;

    const allowedBills = [
        'water', 'maintenance', 'electricity', 'gas',
        'parking', 'internet', 'security', 'clubhouse',
        'lift_maintenance', 'housekeeping'
    ];

    if (!allowedBills.includes(bill_type.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Invalid bill type' });
    }

    const sql = `UPDATE payment_dues 
                 SET ${bill_type.toLowerCase()} = 'paid' 
                 WHERE phone_number = ?`;

    connection.query(sql, [phone_number], (err, result) => {
        if (err) {
            console.error("Error updating due status:", err);
            return res.status(500).json({ success: false, message: "Failed to update payment status." });
        }

        res.json({ success: true, message: "Payment successful!" });
    });
});

app.get("/getEventNames", (req, res) => {
    const query = "SELECT name FROM events ORDER BY event_date, timings";
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching events:", err);
            return res.status(500).json({ success: false, error: "Database error" });
        }
        res.json(results);
    });
});

// Event Management Routes
app.get("/getEvents", (req, res) => {
    const query = 'SELECT * FROM events ORDER BY event_date';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching events:', err);
            return res.status(500).json({ error: 'Failed to load events' });
        }
        res.json(results);
    });
});

app.post('/saveEvent', (req, res) => {
    const { name, event_date, timings, venue, events_list } = req.body;
    
    if (!name || !event_date || !timings || !venue || !events_list) {
        return res.status(400).json({
            success: false,
            error: 'All fields are required'
        });
    }
    const sql = `INSERT INTO events 
                (name, event_date, timings, venue, events_list, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())`;
    
    connection.query(sql, 
        [name, event_date, timings, venue, events_list],
        (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Database operation failed'
                });
            }

            res.status(201).json({
                success: true,
                id: result.insertId,
                message: 'Event created successfully'
            });
        }
    );
});

app.get('/getEventParticipants', (req, res) => {
    const { eventName, activity } = req.query;
    
    if (!eventName || !activity) {
        return res.status(400).json({ 
            error: 'Both eventName and activity parameters are required' 
        });
    }

    // First get the event ID from the event name
    connection.query('SELECT id FROM events WHERE name = ?', [eventName], (err, eventResults) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                error: 'Database error',
                details: err.message 
            });
        }

        if (eventResults.length === 0) {
            return res.status(404).json({ 
                error: 'Event not found' 
            });
        }

        const eventId = eventResults[0].id;
        
        // Now query participants for this event and activity
        const query = `
            SELECT 
                participant_name,
                participant_age,
                owner_name,
                flat_no,
                owner_phone
            FROM event_participants
            WHERE event_id = ? AND event_participated = ?
            ORDER BY participant_name
        `;
        
        connection.query(query, [eventId, activity.trim()], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                    error: 'Database error',
                    details: err.message 
                });
            }
            
            res.json(results);
        });
    });
});

app.post('/addActivity', (req, res) => {
    const { eventId, activityName } = req.body;
    
    if (!eventId || !activityName) {
        return res.status(400).json({ 
            success: false, 
            message: 'Both eventId and activityName are required' 
        });
    }

    connection.query('SELECT events_list FROM events WHERE id = ?', [eventId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        
        const currentActivities = results[0].events_list;
        const updatedActivities = currentActivities 
            ? `${currentActivities}, ${activityName.trim()}`
            : activityName.trim();
            
        connection.query(
            'UPDATE events SET events_list = ? WHERE id = ?',
            [updatedActivities, eventId],
            (err, result) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ success: false, message: 'Failed to update event' });
                }
                
                res.json({ success: true, message: "Activity added successfully" });
            }
        );
    });
});

app.delete("/delete-event", (req, res) => {
    const { name } = req.body;

    const query = "DELETE FROM events WHERE name = ?";
    connection.query(query, [name], (err, result) => {
        if (err) {
            console.error("Error deleting event:", err);
            return res.status(500).json({ success: false, error: "Database error" });
        }
        res.json({ success: true });
    });
});

// Add this route to your server.js, preferably with your other event-related routes
app.post('/registerForEvent', (req, res) => {
    const {
        event_id,
        participant_name,
        participant_age,
        event_participated,
        owner_name,
        flat_no,
        owner_phone
    } = req.body;

    // Validate required fields
    if (!event_id || !participant_name || !participant_age || !event_participated || 
        !owner_name || !flat_no || !owner_phone) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required'
        });
    }

    // Validate participant age is a number
    if (!participant_age || isNaN(Number(participant_age))) {
        return res.status(400).json({
            success: false,
            message: 'Age must be a valid number'
        });
    }    

    const sql = `
        INSERT INTO event_participants (
            event_id,
            participant_name,
            participant_age,
            event_participated,
            owner_name,
            flat_no,
            owner_phone
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(sql, [
        event_id,
        participant_name,
        participant_age,
        event_participated,
        owner_name,
        flat_no,
        owner_phone
    ], (err, result) => {
        if (err) {
            console.error('Registration error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: 'You are already registered for this activity'
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Database error during registration'
            });
        }

        res.json({
            success: true,
            message: 'Registration successful',
            registrationId: result.insertId
        });
    });
});

app.get('/checkRegistration', (req, res) => {
    const { event_id, owner_phone, event_participated } = req.query;

    if (!event_id || !owner_phone || !event_participated) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameters'
        });
    }

    const sql = `
        SELECT COUNT(*) as count 
        FROM event_participants 
        WHERE event_id = ? 
        AND owner_phone = ? 
        AND event_participated = ?
    `;

    connection.query(sql, [event_id, owner_phone, event_participated], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Database error'
            });
        }

        res.json({
            success: true,
            isRegistered: results[0].count > 0
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
