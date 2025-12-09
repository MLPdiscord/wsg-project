import express from "express";
import session from 'express-session';
import { Database } from "./database.js";
import mainRouter from './server.js';

const app = express();
const db = new Database({
    connectionLimit:10,
    host: "Localhost",
    user: "root",
    password: "",
    database: "wsg_project"
});

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(express.static("./node_modules/bootstrap/dist/"));

app.get("/", async (req, res) => {
    if (req.session.userId) {
        return res.redirect(`/${req.session.userRole}`);
    }

    res.redirect("/login");
});

app.use('/', mainRouter);

app.listen(3000, () => console.log("http://localhost:3000/"));