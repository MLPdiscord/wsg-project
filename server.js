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

            console.log(user.role + user.id);

            req.session.save(err => {
                if (err) {
                    return res.status(500).send('Server error');
                }
                res.redirect(`/${user.role}`);
            });
        } else {
            res.render('login', { error: 'Wrong e-mail or password.'});
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

        res.render('admin/admin', {
            userRole: req.session.userRole,
            buildings: allBuildings,
            users: allUsers
        });
    } catch (err) {
        console.error('Admin panel error', err);
        res.status(500).send('Server error')
    }
});

router.get('/users_list', isAdmin, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.render('admin/users/list', {
            title: 'User Management',
            users_list: users
        });
    } catch (err) {
        res.status(500).send("Error fetching users")
    }
});

router.get('/users_list/new', isAdmin, (req, res) => {
    res.render('admin/user_form', {
        title: 'Create New User',
        user: null,
        isNew: true
    });
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

router.post('/admin/buildings/add', isAdmin, async (req, res) => {
    const { name, address } = req.body;

    try {
        const insertBuildingSql = 'INSERT INTO buildings (name, address) VALUES (?, ?)';
        const builingResult = await db.query(insertBuildingSql, [name, address]);

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

router.get('/manager', isManager, async (req, res) => {
    try {
        const isAdmin = req.session.userRole === 'admin';
        
        if (isAdmin && req.query.viewAs === 'admin') {
            req.session.isAdminPreview = true;
        }

        else if (req.session.userRole !== 'admin') {
            req.session.isAdminPreview = false;
        }

        const managedBuildings = isAdmin
            ? await db.selectAllFrom('buildings')
            : await db.selectBuildingsByManagerId(req.session.userId);

        res.render('manager/manager', {
            buildings: managedBuildings || [],
            isAdminPreview: req.session.isAdminPreview
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Manager login error");
    }
});

router.get('/manager/building/:id', isManager, async (req, res) => {
    if (req.query.viewAs === 'admin' && req.session.userRole === 'admin') {
        req.session.isAdminPreview = true;
    } else if (!req.query.viewAs && req.session.userRole === 'admin') {
        req.session.isAdminPreview = true;
    }
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

        res.render('manager/building_details', {
            building: building,
            floors: floors,
            isAdminPreview: req.session.isAdminPreview || false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Building opening error");
    }
});

router.post('/manager/building/:id/add-floor', isManager, async (req, res) => {
    const buildingId = req.params.id;
    const { number, description, barriers } = req.body;

    try {
        const sql = `
        INSERT INTO floors (building_id, number, description, barriers)
        VALUES (?, ?, ?, ?)`;

        await db.query(sql, [buildingId, number, description, barriers]);

        res.redirect(`/manager/building/${buildingId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Floor making error");
    }
});

router.get('/manager/floor/:id', isManager, async (req, res) => {
    const floorId = req.params.id;
    try {
        const floorSql = `
            SELECT f.*, b.name as building_name
            FROM floors f
            JOIN buildings b ON f.building_id = b.id
            WHERE f.id = ?`;
        const floor = (await db.query(floorSql, [floorId]))[0];

        const rooms = await db.query("SELECT * FROM rooms WHERE floor_id = ? ORDER BY corridor_order ASC", [floorId]);

        if (!floor) return res.status(404).send("Floor hasn`t been found");

        res.render('manager/floor_details', {
            floor: floor,
            rooms: rooms,
            isAdminPreview: req.session.isAdminPreview || false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Floor settings error");
    }
});

router.post('/manager/floor/:id/update', isManager, async (req, res) => {
    const floorId = req.params.id;

    const { description, barriers, notes } = req.body;

    try {
        const sql = `
            UPDATE floors
            SET description = ?, barriers = ?, notes = ?
            WHERE id = ?`;

        await db.query(sql, [description || null, barriers || null, notes || null, floorId]);

        res.redirect(`/manager/floor/${floorId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Floor changing error");
    }
});

router.post('/manager/floor/:id/add-room', isManager, async (req, res) => {
    const floorId = req.params.id;
    const { name, description, corridor_order } = req.body;

    try {
        const sql = `
            INSERT INTO rooms (floor_id, name, description, corridor_order)
            VALUES (?, ?, ?, ?)`;

        await db.query(sql, [floorId, name, description, corridor_order]);

        res.redirect(`/manager/floor/${floorId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Adding room error");
    }
});

router.post('/manager/room/:id/update', isManager, async (req, res) => {
    const roomId = req.params.id;
    const { name, description, corridor_order, floor_id } = req.body;
    try {
        await db.query(
            "UPDATE rooms SET name = ?, description = ?, corridor_order = ? WHERE id = ?",
            [name, description, corridor_order, roomId]
        );
        res.redirect(`/manager/floor/${floor_id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Room update error");
    }
});

router.get('/manager/room/:id/delete', isManager, async (req, res) => {
    const roomId = req.params.id;
    const floorId = req.query.floor_id;
    try {
        await db.query("DELETE FROM rooms WHERE id = ?", [roomId]);
        
        res.redirect(`/manager/floor/${floorId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Room deleting error");
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

        res.render('user', {
            buildings: allBuildings,
            userEmail: req.session.userEmail,
            isAdminPreview: true
        });
    } catch (err) {
        console.error('Couldn`t find buildings list', err);
        res.status(500).send('Server Error')
    }
});

export default router;