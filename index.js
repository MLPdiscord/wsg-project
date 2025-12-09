import express from "express";
import session from "express-session";
import mainRouter from "./server.js";
import generateData from "./generate_data.js";

generateData();

const app = express();

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