import db from './db-instance.js';
import bcrypt from 'bcrypt';
import express from 'express';
const router = express.Router();

function isAdmin(req, res, next) {
    if (req.session.userId && req.session.userRole === 'admin') {
        next();
    } else {
        if (req.session.userId) {
            return res.redirect(`/${req.session.userRole}`);
        }
        res.status(403).send('Access Denied. Only Admins can access this.');
    }
};

function isManager(req, res, next) {
    if (req.session.userId && (req.session.userRole === 'manager' || req.session.userRole === 'admin')) {
        next();
    } else {
        res.status(403).send('Access Denied. Only Managers/Admins can access this.');
    }
};

router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await db.selectUserByEmail(email);

        if (!user) {
            return res.render('login', { error: 'Wrong email or password. 1' });
        }

        const buildings = await db.selectBuildingsByUserId(user.id);
        user.role = "user";
        for (const building of buildings) {
            if (building.user_role === "manager") {
                user.role = "manager";
            }
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.save(err => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).send('Server error');
                }
                res.redirect(`/${user.role}`);
            });

        } else {
            res.render('login', { error: 'Wrong email or password. 2' });
        }
    } catch (err) {
        console.error('Login error', err);
        res.status(500).send('Server error');
    }
});

router.get('/admin', isAdmin, async (req, res) => {
    try {
        const sql = `SELECT id, name, address FROM buildings`;
        const allBuildings = await db.query(sql);

        res.render('admin', {
            userRole: req.session.userRole,
            buildings: allBuildings,
        });
    } catch (err) {
        console.error('Error finding list of all buildings for admin', err);
        res.status(500).send('Server error')
    }
});

router.get('/manager', isManager, async (req, res) => {
    const userId = req.session.userId;

    try {
        const sql = `
            SELECT b.id, b.name, b.address
            FROM buildings b
            JOIN users_buildings ub ON b.id = ub.building_id
            WHERE ub.user_id = ?
        `;
        const buildings = await db.query(sql, [userId]);

        res.render('manager', {
            userRole: req.session.userRole,
            buildings: buildings
        });
    } catch (err) {
        console.error('Error finding list of buildings', err);
        res.status(500).send('Server error')
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error: ", err);
            return res.status(500).send("Could not log out");
        }
        res.redirect('/login');
    });
});

router.get('/manager/buildings/add', isManager, (req, res) => {
    res.render('add_building', {
        userRole: req.session.userRole
    });
});

router.post('/manager/buildings/add', isManager, async (req, res) => {
    const { name, address } = req.body;

    try {
        const insertBuildingSql = 'INSERT INTO buildings (name, address) VALUES (?, ?)';
        const buildingResult = await db.query(insertBuildingSql, [name, address]);
        const newBuildingId = buildingResult.insertId;
        const insertManagerSql = 'INSERT INTO users_buildings (user_id, building_id, user_role) VALUES (?, ?, ?)';
        await db.query(insertManagerSql, [req.session.userId, newBuildingId, 'manager']);

        res.redirect('/manager');
    } catch (err) {
        console.error('Couldn`t add building', err);
        res.status(500).send('Server error');
    }
});

router.get('/user', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const userId = req.session.userId;

    try {
        const sql = `
            SELECT b.id, b.name, b.address
            FROM buildings b
            JOIN users_buildings ub ON b.id = ub.building_id
            WHERE ub.user_id = ?
        `;
        const buildings = await db.query(sql, [req.session.userId]);
        res.render('user', { buildings: buildings });
    } catch (err) {
        console.error('Couldn`t find buildings list', err);
        res.status(500).send('Server Error')
    }
});

export default router;

// manager@wsg.pl / managerpasswosd