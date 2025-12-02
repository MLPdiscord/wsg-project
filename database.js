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

    #query(query) {
        return new Promise((resolve, reject) =>
            this.pool.getConnection((err, connection) => {
                if (err) {
                    reject(err);
                    return;
                }
                connection.query(query, (err, result) => {
                    connection.release();
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(result);
                })
            }));
    }

    async selectAllFrom(table) {
        return await this.#query(`SELECT * FROM ${table}`);
    }
}

export { Database };