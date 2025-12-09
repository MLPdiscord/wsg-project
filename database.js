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

    async selectAllFrom(table) {
        return await this.#query(`SELECT * FROM ${table};`);
    }

    async createUser({ name, surname, email, passwordHash }) {
        return await this.#query("INSERT INTO users (name, surname, email, password) VALUES (?, ?, ?, ?);", [name, surname, email, passwordHash]);
    }

    async selectUserByEmail(email) {
        return (await this.#query("SELECT users.id, users.name, users.surname, users.password FROM users WHERE users.email=?;", [email]))[0];
    }

    async selectBuildingsByUserId(id) {
        return await this.#query("SELECT buildings.id, buildings.name, buildings.address, users_buildings.user_role FROM buildings INNER JOIN users_buildings ON users_buildings.user_id WHERE users_buildings.user_id = ?", [id]);
    }

    async createBuilding({ name, address }) {
        return await this.#query("INSERT INTO buildings (name, address) VALUES (?, ?);", [name, address]);
    }

    async assignBuilding({ userID, buildingID, userRole }) {
        return await this.#query(`INSERT INTO users_buildings (user_id, building_id, user_role) VALUES (?, ?, '${userRole}');`, [userID, buildingID]);
    }

    async _DELETE_ALL_DATA() {
        await this.#query("DELETE FROM sensors");
        await this.#query("DELETE FROM beacons");
        await this.#query("DELETE FROM users_buildings");
        await this.#query("DELETE FROM rooms");
        await this.#query("DELETE FROM floors");
        await this.#query("DELETE FROM buildings");
        await this.#query("DELETE FROM users");
    }
}

export { Database };