import express from "express";
import { Database } from "./database.js";

const app = express();
const db = new Database({
    connectionLimit: 10,
    host: "localhost",
    user: "root",
    password: "",
    database: "wsg_project"
});

app.set("view engine", "ejs");

app.use(express.static("./node_modules/bootstrap/dist/"));

app.get("/", async (req, res) => {
    res.render("index.ejs", { tables: [await db.selectAllFrom("users")] });
});

app.get("/admin", (req, res) => {
    res.render("admin.ejs");
});

app.get("/manager", (req, res) => {
    res.render("manager.ejs");
});

app.get("/user", (req, res) => {
    res.render("user.ejs");
});

app.listen(3000, () => console.log("http://localhost:3000/"));
