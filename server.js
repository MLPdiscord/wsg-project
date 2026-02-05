import db from './db-instance.js';
import bcrypt from 'bcrypt';
import express from 'express';
import nodemailer from 'nodemailer';
const router = express.Router();

function isAdmin(req, res, next) {
    if (req.session.userId && req.session.userRole === 'admin') {
        next();
    } else {
        if (req.session.userId) {
            if (req.session.userRole === 'admin') {
                return res.redirect('/admin')
            }
            return res.redirect(`/buildings`);
        }
        res.redirect('/login');
    }
};

function isManager(req, res, next) {
    const roles = ['admin', 'manager', 'user'];
    if (req.session.userId && roles.includes(req.session.userRole)) {
        next();
    } else {
        res.redirect('/login');
    }
};

async function logAction(req, action, entityType, entityName, details) {
    try {
        const sql = `INSERT INTO audit_logs (user_id, user_name, action_type, entity_type, entity_name, details) 
                     VALUES (?, ?, ?, ?, ?, ?)`;
        await db.query(sql, [
            req.session.userId, 
            req.session.userEmail,
            action, 
            entityType, 
            entityName, 
            details
        ]);
    } catch (err) {
        console.error("Failed to write audit log:", err);
    }
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'daraknoiid@gmail.com',
        pass: 'tpsm fitw nvfz iawf'
    },
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
});

router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await db.selectUserByEmail(email);

        if (!user) {
            return res.render('login', { error: 'Wrong email or password.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            if (user.status === 'blocked') {
                return res.render('login', { error: 'Twoje konto jest zablokowane!'});
            }
            
            if (user.role !== 'admin' && user.role !== 'manager') {
                const buildings = await db.selectBuildingsByUserId(user.id);
                let finalRole = "user";

                for (const building of buildings) {
                    if (building.user_role === "manager") {
                        finalRole = "manager";
                        break;
                    }
                }
                user.role = finalRole;
            }

            req.session.userId = user.id;
            req.session.userRole = user.role;

            req.session.save(err => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).send('Server error');
                }
                
                if (user.role === 'admin') {
                    res.redirect('/admin');
                } else {
                    res.redirect('/buildings');
                }
            });
        } else {
            res.render('login', { error: 'Wrong e-mail or password.' });
        }
    } catch (err) {
        console.error('Login error', err);
        res.status(500).send('Server error');
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

router.get('/admin', isAdmin, async (req, res) => {
    try {
        const allBuildings = await db.selectAllFrom('buildings');
        const allUsers = await db.selectAllFrom('users');

        const currentUserData = await db.findUserById(req.session.userId);

        const logSql = `
            SELECT sd.*, s.name as sensor_name, b.name as building_name
            FROM sensor_data sd
            JOIN sensors s ON sd.sensor_id = s.id
            JOIN floors f ON s.floor_id = f.id
            JOIN buildings b ON f.building_id = b.id
            ORDER BY sd.created_at DESC
            LIMIT 20
        `;
        const sensorLogs = await db.query(logSql)

        res.render('admin', {
            userRole: req.session.userRole,
            buildings: allBuildings,
            users: allUsers,
            sensorLogs: sensorLogs,
            currentUser: {
                name: currentUserData.name,
                surname: currentUserData.surname,
                email: currentUserData.email,
                role: currentUserData.role
            }
        });
    } catch (err) {
        console.error('Admin panel error', err);
        res.status(500).send('Server error')
    }
});

router.post('/users_list/new', isAdmin, async (req, res)=> {
    const { name, surname, email, password, role } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await db.createUser({ name, surname, email, passwordHash });

        const newUser = await db.selectUserByEmail(email);
        await db.query("UPDATE users SET role = ? WHERE id = ?", [role, newUser.id]); 

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error creating user");
    }
});

router.post('/admin/users/create', isAdmin, async (req, res) => {
    const { name, surname, email, password, role } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await db.createUser({
            name,
            surname,
            email,
            passwordHash
        });

        const newUser = await db.selectUserByEmail(email);
        await db.query("UPDATE users SET role = ? WHERE id = ?", [role, newUser.id]);

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error creating user");
    }
});

router.get('/users/delete/:id', isAdmin, async (req, res) => {
    try {
        await db.deleteUser(req.params.id);
        res.redirect('/admin');
    } catch (err) {
        console.error('Failed to delete user.', err);
        res.status(500).send('Server error');
    }
});

router.get('/admin/buildings/add', isAdmin, (req, res) => {
    res.render('admin/add_building', {
        isNew:true,
        building: {},
        userRole: req.session.userRole
    });
});

router.get('/admin/manager_buildings/:id', isAdmin, async (req, res) => {
    try {
        const sql = `
            SELECT b.id, b.name
            FROM buildings b
            JOIN manager_buildings mb ON b.id = mb.building_id
            WHERE mb.user_id = ?`;

        const rows = await db.query(sql, [req.params.id]);
        console.log("Found buildings for manager:", rows);
        res.json(rows);
    } catch (err) {
        console.error("Error fetching manager buildings:", err);
        res.status(500).json([]);
    }
});

router.post('/admin/manager_buildings/assign', isAdmin, async (req, res) => {
    const { userId, buildingId } = req.body;
    try {
        if (!userId || !buildingId) return res.status(400).send("Missing data");

        const sql = `INSERT IGNORE INTO manager_buildings (user_id, building_id) VALUES (?, ?)`;
        await db.query(sql, [userId, buildingId]);

        res.sendStatus(200);
    } catch (err) {
        console.error("Assign error:", err);
        res.status(500).send("Database error");
    }
});

router.delete('/admin/manager_buildings/detach/:userId/:buildingId', isAdmin, async (req, res) => {
    const { userId, buildingId } = req.params;
    try {
        const sql = `DELETE FROM manager_buildings WHERE user_id = ? AND building_id = ?`;
        await db.query(sql, [userId, buildingId]);

        res.sendStatus(200);
    } catch (err) {
        console.error("Detach error:", err);
        res.status(500).send("Database error");
    }
});

router.post('/admin/buildings/add', isAdmin, async (req, res) => {
    const { name, address, description } = req.body;

    try {
        const insertBuildingSql = 'INSERT INTO buildings (name, address, description) VALUES (?, ?, ?)';
        const builingResult = await db.query(insertBuildingSql, [name, address, description]);

        res.redirect('/admin');
    } catch (err) {
        console.error('Coudn`t add building', err);
        res.status(500).send('Server error');
    }
});

router.get('/admin/buildings/toggle-status/:id/:currentStatus', isAdmin, async (req, res) => {
    try {
        await db.toggleBuildingStatus(req.params.id, req.params.currentStatus);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Building status change error");
    }
});

router.get('/admin/buildings/edit', isAdmin, async (req, res) => {
    try {
        const building = await db.findBuildingById(req.query.id);
        res.render('admin/add_building', {
            title: 'Edytuj Budynek',
            building: building,
            isNew: false
        });
    } catch (err) {
        res.status(500).send("Database error");
    }
});

router.post('/admin/buildings/edit', isAdmin, async (req, res) => {

    const { id, name, address, description } = req.body;

    try {
        await db.updateBuilding(id, {
            name: name,
            address: address,
            description: description
        });

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Activation error");
    }
});

router.get('/admin/buildings/delete/:id', isAdmin, async (req, res) => {
    try {
        await db.query("DELETE FROM buildings WHERE id = ?", [req.params.id]);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Building deleting error");
    }
});

router.get('/users_list', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    const users_list = await db.getAllUsers();

    res.render('/admin/users_list', {
        title: 'User Management',
        users_list: users_list
    });
});

router.get('/users_list/new', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    res.render('admin/user_form', {
        title: 'New user creation',
        user: null,
        isNew: true
    });
});

router.get('/users_list/edit', async (req, res) => {
    const userId = req.query.id;

    if (!userId) {
        return res.status(400).send("Missing user ID");
    }

    try {
        const user = await db.findUserById(userId);
        const allBuildings = await db.selectAllBuildings();
        const managedBuildings = await db.selectBuildingsByManagerId(userId);
        
        if (!user) {
            return res.status(404).send("User not found");
        }

        res.render('admin/user_form', {
            title: 'Edit User Account',
            user: user,
            isNew: false,
            userRole: req.session.userRole,
            allBuildings: allBuildings,
            managedBuildings: managedBuildings
        });
    } catch (err) {
        console.error("Error fetching user for edit:", err);
        res.status(500).send("Database error");
    }
});

router.get('/buildings', isManager, async (req, res) => {
    try {
        if (req.query.viewAs === 'admin') {
            req.session.viewAs = 'admin';
        } else if (req.query.viewAs === 'edit') {
            req.session.viewAs = null;
        }

        const isFullAccess = req.session.userRole === 'admin' || req.session.userRole === 'user';
        const managedBuildings = isFullAccess
            ? await db.selectAllFrom('buildings')
            : await db.selectBuildingsByManagerId(req.session.userId);

        const currentUserData = await db.findUserById(req.session.userId);

        res.render('buildings/buildings', {
            buildings: managedBuildings || [],
            userRole:req.session.userRole,
            isAdminPreview: req.session.viewAs === 'admin',
            currentUser: {
                name: currentUserData.name,
                surname: currentUserData.surname,
                email: currentUserData.email,
                role: currentUserData.role
            }
            
        });
    } catch (err) {
        console.error("Router building error!", err);
        res.status(500).send("Manager login error");
    }
});

router.get('/buildings/building/:id', isManager, async (req, res) => {
    try {
        const building = await db.findBuildingById(req.params.id);

        const sql = `
            SELECT f.*, COUNT(r.id) as room_count
            FROM floors f
            LEFT JOIN rooms r ON f.id = r.floor_id
            WHERE f.building_id = ?
            GROUP BY f.id
            ORDER BY f.number DESC`;

        const floors = await db.query(sql, [req.params.id]);

        const isPreviewMode = (req.session.userRole === 'admin' && req.session.viewAs === 'admin');

        const currentUserData = await db.findUserById(req.session.userId);

        res.render('buildings/building_details', {
            building: building,
            floors: floors,
            userRole: req.session.userRole,
            isAdminPreview: isPreviewMode,
            currentUser: {
                name: currentUserData.name,
                surname: currentUserData.surname,
                email: currentUserData.email,
                role: currentUserData.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Building opening error");
    }
});

router.post('/buildings/building/:id/add-floor', isManager, async (req, res) => {
    const buildingId = req.params.id;
    const { number, description, barriers } = req.body;

    try {
        const sql = `
        INSERT INTO floors (building_id, number, description, barriers)
        VALUES (?, ?, ?, ?)`;

        await db.query(sql, [buildingId, number, description, barriers]);

        res.redirect(`/buildings/building/${buildingId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Floor making error");
    }
});

router.get('/buildings/floor/:id', isManager, async (req, res) => {
    const floorId = req.params.id;
    try {
        const floorSql = `
            SELECT f.*, b.name as building_name
            FROM floors f
            LEFT JOIN buildings b ON f.building_id = b.id
            WHERE f.id = ?`;
        const floor = (await db.query(floorSql, [floorId]))[0];
        const rooms = await db.query("SELECT * FROM rooms WHERE floor_id = ? ORDER BY corridor_order ASC", [floorId]);
        const sensors = await db.query(`SELECT * FROM sensors WHERE floor_id = ?`, [floorId]);
        const beacons = await db.query("SELECT * FROM beacons WHERE floor_id = ?", [floorId]);

        if (!floor) return res.status(404).send("Floor hasn`t been found");

        const isPreviewMode = (req.session.userRole === 'admin' && req.session.viewAs === 'admin');

        const currentUserData = await db.findUserById(req.session.userId);

        res.render('buildings/floor_details', {
            floor: floor,
            rooms: rooms,
            sensors: sensors,
            beacons: beacons,
            userRole: req.session.userRole,
            isAdminPreview: isPreviewMode,
            currentUser: {
                name: currentUserData.name,
                surname: currentUserData.surname,
                email: currentUserData.email,
                role: currentUserData.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Floor settings error");
    }
});

router.post('/buildings/floor/:id/update', isManager, async (req, res) => {
    const floorId = req.params.id;

    const { description, barriers, notes } = req.body;

    try {
        const sql = `
            UPDATE floors
            SET description = ?, barriers = ?, notes = ?
            WHERE id = ?`;

        await db.query(sql, [description || null, barriers || null, notes || null, floorId]);

        res.redirect(`/buildings/floor/${floorId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Floor changing error");
    }
});

router.post('/buildings/floor/:id/add-room', isManager, async (req, res) => {
    const floorId = req.params.id;
    const { name, description, corridor_order } = req.body;

    try {
        const sql = `
            INSERT INTO rooms (floor_id, name, description, corridor_order)
            VALUES (?, ?, ?, ?)`;

        await db.query(sql, [floorId, name, description, corridor_order]);

        res.redirect(`/buildings/floor/${floorId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Adding room error");
    }
});

router.post('/buildings/room/:id/update', isManager, async (req, res) => {
    const roomId = req.params.id;
    const { name, description, corridor_order, floor_id } = req.body;
    try {
        await db.query(
            "UPDATE rooms SET name = ?, description = ?, corridor_order = ? WHERE id = ?",
            [name, description, corridor_order, roomId]
        );
        res.redirect(`/buildings/floor/${floor_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Room update error");
    }
});

router.get('/buildings/room/:id/delete', isManager, async (req, res) => {
    const roomId = req.params.id;
    const floorId = req.query.floor_id;
    try {
        await db.query("DELETE FROM rooms WHERE id = ?", [roomId]);
        
        res.redirect(`/buildings/floor/${floorId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Room deleting error");
    }
});

router.post('/buildings/sensors/add', async (req, res) => {
    const { name, type, floor_id, localisation } = req.body;
    try {
        const sql = `INSERT INTO sensors (name, type, floor_id, localisation, status) VALUES (?, ?, ?, ?, 'active')`;
        await db.query(sql, [name, type, floor_id, localisation]);
        res.redirect(`/buildings/floor/${floor_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Ошибка при создании датчика");
    }
});

router.get('/buildings/sensors/delete/:id', async (req, res) => {
    const sensorId = req.params.id;
    const floorId = req.query.floor_id;
    try {
        await db.query(`DELETE FROM sensors WHERE id = ?`, [sensorId]);
        res.redirect(`/buildings/floor/${floorId}`);
    } catch (err) {
    console.error(err);
        res.status(500).send("Error removing sensor");
    }
});

router.post('/users_list/edit', isAdmin, async (req, res) => {
    const { id, name, surname, email, role } = req.body;

    try {
        const sql = `
            UPDATE users
            SET name = ?, surname = ?, email = ?, role = ?
            WHERE id = ?
        `;

        await db.query(sql, [name, surname, email, role, id]);

        res.redirect('/admin');
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).send('Waiting error')
    }
});

router.get('/users/toggle-status/:id/:currentStatus', isAdmin, async (req, res) => {
    try {
        await db.toggleUserStatus(req.params.id, req.params.currentStatus);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send("Status change error");
    }
});

router.post('/admin/users/assign_building', isAdmin, async (req, res) => {
    const { userId, buildingId } = req.body;
    
    try {
        if (!userId) {
            return res.status(400).send("User ID is missing")
        }
        await db.assignBuildingToManager(userId, buildingId);
        res.redirect(`/users_list/edit?id=${userId}`);
    } catch (err) {
        res.status(500).send("Error assigning building");
    }
});

router.get('/admin/users/detach_building/:userId/:buildingId', isAdmin, async (req, res) => {
    const { userId, buildingId } = req.params;
    try {
        await db.detachBuildingFromManager(userId, buildingId);
        res.redirect(`/users_list/edit?id=${userId}`);
    } catch (err) {
        res.status(500).send("Error detaching building");
    }
});

router.get('/user', async (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'user') {
        return res.redirect('/login');
    }

    try {
        const allBuildings = await db.selectAllFrom('buildings');

        req.session.isAdminPreview = true;

        res.render('buildings/buildings', {
            buildings: allBuildings,
            userRole:req.session.userRole,
            userEmail: req.session.userEmail,
            isAdminPreview: true
        });
    } catch (err) {
        console.error('Couldn`t find buildings list', err);
        res.status(500).send('Server Error')
    }
});

router.post('/buildings/beacons/add', isManager, async (req, res) => {
    const { beacon_id, floor_id, localisation } = req.body;
    try {
        await db.query(
            "INSERT INTO beacons (beacon_id, floor_id, localisation) VALUES (?, ?, ?)",
            [beacon_id, floor_id, localisation] 
        );
        res.redirect(`/buildings/floor/${floor_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Beacon save error");
    }
});

router.post('/buildings/beacons/delete/:id', isManager, async (req, res) => {
    const beaconDbId = req.params.id;
    const { floor_id } = req.body;

    try {
        await db.query("DELETE FROM beacons WHERE id = ?", [beaconDbId]);
        
        res.redirect(`/buildings/floor/${floor_id}`);
    } catch (err) {
        console.error("Error deleting beacon:", err);
        res.status(500).send("Error removing device");
    }
});

router.post('/api/sensors/event', async (req, res) => {
    const { sensor_id, value } = req.body;

    if (!sensor_id || value === undefined) {
        return res.status(400).json({ error: "sensor_id and value required"});
    }

    try {
        const criticalKeywords = ['FIRE', 'SMOKE', 'ALARM', 'WATER', 'HELP'];
        const isCritical = criticalKeywords.some(k => value.toString().toUpperCase().includes(k));

        await db.query(
            `INSERT INTO sensor_data (sensor_id, value, is_critical) VALUES (?, ?, ?)`,
            [sensor_id, value, isCritical ? 1 : 0]
        );

        if (isCritical) {
            const findManagerSql = `
                SELECT 
                    u.email, 
                    u.name, 
                    u.surname, 
                    b.name AS building_name, 
                    s.localisation
                FROM sensors s
                JOIN floors f ON s.floor_id = f.id
                JOIN buildings b ON f.building_id = b.id
                JOIN manager_buildings mb ON b.id = mb.building_id
                JOIN users u ON mb.user_id = u.id
                WHERE s.id = ? AND u.role = 'manager'
            `;
            const managers = await db.query(findManagerSql, [sensor_id]);

            let recipients = managers.map(m => m.email);
            recipients.push('daraknoiid@gmail.com');

            recipients = [...new Set(recipients)];

            for (const manager of managers) {

                const mailOptions = {
                    from: '"Smart Building System" <daraknoiid@gmail.com>',
                    to: 'daraknoiid@gmail.com, kalasnikb7@gmail.com,' + manager.email,
                    subject: `ALERT: ${value} in ${manager.building_name}`,
                    text: `Hello, ${manager.name} ${manager.surname}!\n\n` +
                          `On "${manager.building_name}" an alarm has been recorded: "${value}"\n` +
                          `Czuynik: ${sensor_id}\n` +
                          `Localosation: ${manager.localisation}\n\n` +
                          `Please, do something.`
                };

                await transporter.sendMail(mailOptions);
            }
        }

        res.status(200).json({ success:true, message: "Data has been treated!" });
    } catch (err) {
        console.error("Router error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;