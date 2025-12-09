import { Database } from './database.js'

const dbConfig = {
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wsg_project'
}

const database = new Database(dbConfig);

export default database;