const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
require('dotenv').config();

app = express();
app.use(express.static('public'))
app.use(express.static('views'))
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

const SECRET_KEY = process.env.SECRET_KEY;
app.use(
    session({
        secret: SECRET_KEY,
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false},
    })
);

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port : process.env.DB_PORT,
    database: process.env.DB_DATABASE
});

db.connect(err => {
    if (err) throw err;
    console.log('Mysql connected');
});

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/', async (req, res) => {
    const {id, password} = req.body;

    db.query('SELECT * from users where id = ? ', [id], async (err, results) => {
        if (err) return res.stauts(500).send('Server Error');
        if (results.length === 0) return res.status(401).send('Invalid Credentials');

        const user = results[0]
        if (password != user.password) return res.status(401).send('Invalid Credentials');

        req.session.user = user;
        if (user.id === 'admin') {
            res.redirect('master');
        } else {
            res.redirect('index');
        };
    })
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.send('Logged Out');
})

app.get("/index", async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    res.render("index", { name: req.session.user.name, id : req.session.user.id });
});

app.get("/leave", (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    res.render("leave", { name: req.session.user.name, id: req.session.user.id });
});

app.get("/absence", (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');
    res.render("absence", { name: req.session.user.name, id: req.session.user.id });
});

app.get("/master", async (req, res) => {
    if (!req.session.user || req.session.user.name != "admin") return res.status(401).send('Unauthorized');
    res.render("master", { name: req.session.user.name });
});

app.get('/search', async (req, res) => {
    db.query('SELECT distinct id from users', (err, results) => {
        if (err) return res.status(500).json({error : err.message});
        const uniqueId = results.map(row => row.id);
        res.json(uniqueId);
    });
});

// users
app.get('/users', async (req, res) => {
    if (!req.session.user || req.session.user.name != "admin") return res.status(401).send('Unauthorized');
    db.query('SELECT * from users', (err, results) => {
        if (err) return res.status(500).json({error : err.message});
        res.json(results);
    });
});

// get overtime
app.get('/overtime/:condition', async (req, res) => {
    const condition = req.params.condition;
    if (condition === 'all') {
        db.query('SELECT * from overtime', (err, results) => {
            if (err) return res.status(500).json({error : err.message});
            res.json(results);
        });
    } else { 
        db.query('SELECT * from overtime where code = ?', [condition], (err, results) => {
            if (err) return res.status(500).json({error : err.message});
            res.json(results);
        });
    };
});

// get leaves
app.get('/leaves/:condition', async (req, res) => {
    const condition = req.params.condition;
    if (condition === 'all') {
        db.query('SELECT * from leaves', (err, results) => {
            if (err) return res.status(500).json({error : err.message});
            res.json(results);
        });
    } else {
        db.query('SELECT * from leaves where code = ?', [condition], (err, results) => {
            if (err) return res.status(500).json({error : err.message});
            res.json(results);
        });
    };
});

// get overtime
app.get('/balance_leaves/:condition', async (req, res) => {
    const condition = req.params.condition;
    if (condition === 'all') {
        db.query('SELECT * from balance_leaves', (err, results) => {
            if (err) return res.status(500).json({error : err.message});
            res.json(results);
        });
    } else {
        db.query('SELECT * from balance_leaves where code = ?', [condition], (err, results) => {
            if (err) return res.status(500).json({error : err.message});
            res.json(results);
        });
    }
});


// Delete Overtime Item
app.delete('/delete/overtime/:code/:period', async (req, res) => {
    const {code, period} = req.params;

    db.query('delete from overtime where code = ? && period = ?', [code, period], async (err, results) => {
        if (err) return res.status(500).send('Server Error');

        if (results.affectedRows === 0) {
            return res.status(404).send('Item not found')
        }
        console.log('Item Deleted');
        res.status(200).send('Item Deleted');
    });
});

// Delete Leaves Item
app.delete('/delete/leaves/:code/:date', async (req, res) => {
    const {code, date} = req.params;

    db.query('delete from leaves where code = ? && date = ?', [code, date], async (err, results) => {
        if (err) return res.status(500).send('Server Error');

        if (results.affectedRows === 0) {
            return res.status(404).send('Item not found')
        }
        console.log('Item Deleted');
        res.status(200).send('Item Deleted');
    });
});

// Delete Balance Leaves Item
app.delete('/delete/balance/:code', async (req, res) => {
    const {code} = req.params;

    db.query('delete from balance_leaves where code = ?', [code], async (err, results) => {
        if (err) return res.status(500).send('Server Error');

        if (results.affectedRows === 0) {
            return res.status(404).send('Item not found')
        }
        console.log('Item Deleted');
        res.status(200).send('Item Deleted');
    });
});

// Delete User Information
app.delete('/delete/user/:id', async (req, res) => {
    const {id} = req.params;

    db.query('delete from users where id = ?', [id], async (err, results) => {
        if (err) return res.status(500).send('Server Error');

        if (results.affectedRows === 0) {
            return res.status(404).send('User not found')
        }
        console.log('User Deleted');
        res.status(200).send('User Deleted');
    });
});

// Add Item
app.post('/add/:type', (req, res) => {
    const type = req.params.type;

    if (type === "overtime") {
        const {code, period, wd_ot, wk_ot, nt_ot} = req.body;
    
        console.log(req.body);
        console.log(code, period, wd_ot, wk_ot, nt_ot);
    
        db.query(`INSERT INTO ${type} (code, period, wd_ot, wk_ot, nt_ot) values (?, ?, ?, ?, ?)`, [code, period, wd_ot, wk_ot, nt_ot], async (err, results) => {
            if (err) {
                console.log('Error adding item:, err');
                res.status(500).send('Server Error');
            }
            if (results.affectedRows === 0) {
                return res.status(404).send('Item not added');
            }        
            console.log('Item Added')
            res.status(200).send('Item added');
        });
    };

    if (type === "leaves") {
        const {code, date, amt} = req.body;

        db.query(`INSERT INTO ${type} (code, date, amt) values (?, ?, ?)`, [code, date, amt], async (err, results) => {
            if (err) {
                console.log('Error adding item:, err');
                res.status(500).send('Server Error');
            }
            if (results.affectedRows === 0) {
                return res.status(404).send('Item not added');
            }        
            console.log('Item Added')
            res.status(200).send('Item added');
        });
    };

    if (type === "balance_leaves") {
        const {code, granted, used, remain} = req.body;

        db.query(`INSERT INTO ${type} (code, granted, used, remain) values (?, ?, ?, ?)`, [code, granted, used, remain], async (err, results) => {
            if (err) {
                console.log('Error adding item:, err');
                res.status(500).send('Server Error');
            }
            if (results.affectedRows === 0) {
                return res.status(404).send('Item not added');
            }        
            console.log('Item Added')
            res.status(200).send('Item added');
        });
    };
    
    if (type === "users") {
        const {id, password, user_type, name} = req.body;
        console.log(id, password, user_type, name);

        db.query(`INSERT INTO ${type} (id, password, type, name) values (?, ?, ?, ?)`, [id, password, user_type, name], async (err, results) => {
            if (err) {
                console.log('Error adding user:, err');
                res.status(500).send('Server Error');
            }
            if (results.affectedRows === 0) {
                return res.status(404).send('User not added');
            }        
            console.log('User Added')
            res.status(200).send('User added');
        });
    };
});

app.listen(3000, () => {
    console.log('server is running on port 3000')
});