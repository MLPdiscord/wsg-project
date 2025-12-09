import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const passwordsToHash = [
    ["AdminPassword123", "admin@yahoo.com", "admin"],
    ["ManagerPassword123", "manager@wsg.pl", "manager"],
    ["UserPassword123", "user@gmail.com", "user"]
];

async function generateSQL() {
    console.log("--- SQL INSERT STATEMENTS ---");

    for (const [password, email, role] of passwordsToHash) {
        try {
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const sql = `INSERT INTO users (email, password, role) VALUES ('${email}', '${hashedPassword}', '${role}');`;

            console.log(sql);
        } catch (error) {
            console.error(`Error hashing password for ${email}:`, error);
        }
    }
    console.log("-----------------------------")
}

generateSQL();