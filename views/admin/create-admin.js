import db from './db-instance.js';
import bcrypt from 'bcrypt';

async function createAdmin() {
    const saltRounds = 10;
    const plainPassword = 'admin';
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    try {
        await db.createUser({
            name: 'admin',
            surname: 'admin',
            email: 'admin@gmail.com',
            passwordHash: passwordHash,
            role: 'admin'
        });

        console.log("User created!");
    } catch (err) {
        console.error("Failed to create a user!", err);
    } finally {
        process.exit();
    }
}
createAdmin();