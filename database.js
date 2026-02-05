import mysql from "mysql";

class Database {
    constructor({ connectionLimit, host, user, password, database }) {
        this.pool = mysql.createPool({
            connectionLimit: connectionLimit,
            host: host,
            user: user,
            password: password,
            database: database,
        });
    }

    #query(sql, params) {

        return new Promise((resolve, reject) =>
            this.pool.getConnection((err, connection) => {
                if (err) {
                    reject(err);
                    return;
                }
                connection.query(sql, params, (err, result) => {
                    connection.release();
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(result);
                })
            }));
    }

    async query(sql, params) {
        return await this.#query(sql, params);
    }

    async getAllUsers() {
        return await this.#query("SELECT users.id, users.name, users.surname, users.email, users.role, users.status FROM users", []);
    }

    async findUserById(id) {
        const sql = "SELECT users.id, users.name, users.surname, users.email, users.role FROM users WHERE users.id = ?";
        const results = await this.#query(sql, [id]);
        return results[0];
    }

    async findBuildingById(id) {
        const sql = "SELECT * FROM buildings WHERE id = ?";
        const results = await this.#query(sql, [id]);
        return results[0];
    }

    async User(id) {
        return await this.#query("DELETE FROM users WHERE id = ?", [id]);
    }

    async toggleUserStatus(id, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
        const sql = "UPDATE users SET status = ? WHERE id = ?";
        return await this.#query(sql, [newStatus, id]);
    }

    async toggleBuildingStatus(id, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'archived' : 'active';
        const sql = "UPDATE buildings SET status = ? WHERE id = ?";
        return await this.#query(sql, [newStatus, id]);
    }

    async updateBuilding(id, { name, address, description }) {
        const sql = "UPDATE buildings SET name = ?, address = ?, description = ? WHERE id = ?";
        return await this.#query(sql, [
            name.trim(),
            address.trim(),
            description ? description.trim() : '',
            id
        ]);
    }

    async selectAllFrom(table) {
        return await this.#query(`SELECT * FROM ${table};`);
    }

    async selectAllBuildings() {
        return await this.#query("SELECT id, name, address, status FROM buildings", []);
    }

    async createUser({ name, surname, email, passwordHash }) {
        return await this.#query("INSERT INTO users (name, surname, email, password) VALUES (?, ?, ?, ?);", [name, surname, email, passwordHash]);
    }

    async selectUserByEmail(email) {
        return (await this.#query("SELECT users.id, users.name, users.surname, users.password, users.role FROM users WHERE users.email=?;", [email]))[0];
    }

    async selectBuildingsByUserId(id) {
        return await this.#query("SELECT buildings.id, buildings.name, buildings.address, users_buildings.user_role FROM buildings INNER JOIN users_buildings ON users_buildings.user_id WHERE users_buildings.user_id = ?", [id]);
    }

    async selectBuildingsByManagerId(id) {
        const sql = `
        SELECT b.id, b.name, b.address
        FROM buildings b
        INNER JOIN manager_buildings mb ON b.id = mb.building_id
        WHERE mb.user_id = ?`;
        return await this.#query(sql, [id]);
    }

    async assignBuildingToManager(userId, buildingId) {
        const sql = "INSERT IGNORE INTO manager_buildings (user_id, building_id) Values (?, ?)";
        return await this.#query(sql, [userId, buildingId]);
    }

    async detachBuildingFromManager(userId, buildingId) {
        const sql = "DELETE FROM manager_buildings WHERE user_id = ? AND building_id = ?";
        return await this.#query(sql, [userId, buildingId]);
    }

    async createBuilding({ name, address }) {
        return await this.#query("INSERT INTO buildings (name, address) VALUES (?, ?);", [name, address]);
    }

    async assignBuilding({ userID, buildingID, userRole }) {
        return await this.#query(`INSERT INTO users_buildings (user_id, building_id, user_role) VALUES (?, ?, '${userRole}');`, [userID, buildingID]);
    }

    async deleteUser(id) {
        return await this.#query("DELETE FROM users WHERE id = ?", [id]);
    }
}

export { Database };