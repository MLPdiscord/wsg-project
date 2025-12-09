import db from "./db-instance.js";
import bcrypt from "bcrypt"

async function generateData() {
    await db._DELETE_ALL_DATA();

    const buildingID = (await db.createBuilding({ name: "Test building", address: "Test address" }))
        .insertId;

    for (let i = 0; i < 10; i++) {
        const hash = await bcrypt.hash("test", 10);
        const user = { name: "Name", surname: "Surname", email: `test${i}@gmail.com`, passwordHash: hash };
        const userID = (await db.createUser(user))
            .insertId;

        await db.assignBuilding({ userID, buildingID, userRole: i !== 0 ? "user" : "manager" });
    }
}

export default generateData;