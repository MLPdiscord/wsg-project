import express from "express";
import mysql from "mysql";

const pool = mysql.createPool({
    connectionLimit: 10,
    host: "localhost",
    user: "root",
    password: "",
    database: "wsg_project",
});

const app = express();

app.set("view engine", "ejs");

app.use(express.static("./node_modules/bootstrap/dist/"));

app.get("/", (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            throw err;
        }

        connection.query("SELECT * FROM `test`", (err, rows) => {
            connection.release();

            if (err) {
                throw err;
            }

            res.render("index.ejs", { array: rows });
        });
    });
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

app.listen(3000);