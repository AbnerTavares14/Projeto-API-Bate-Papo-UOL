import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
// import chalk from "chalk";
import dayjs from "dayjs";
import joi from 'joi'


const app = express();
app.use(cors);
app.use(express.json());

dotenv.config();

let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then(() => {
    db = mongoClient.db(process.env.BANCO);
    console.log("Deu bom demais!");
});
promise.catch(e => console.log("Não deu certo a conexão!", e));

app.post("/participants", async (req, res) => {
    const userSchema = joi.object({
        name: joi.string().min(1).required()
    });
    const validation = userSchema.validate(req.body);
    if (validation.error) {
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }
    try {
        const participante = await db.collection("participantes").find(req.body).toArray();
        if (participante) {
            res.sendStatus(409);
            console.log("Esse nome já existe mano");
            return;
        }
        await db.collection("participantes").insertOne({ name: req.body, lastStatus: Date.now() }).toArray();
        await db.collection("messages").insertOne({ from: req.body, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:MM:SS') });
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const participantes = await db.collection("participantes").find({}).toArray();
        res.json({});
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post("/messages", async (req, res) => {
    const { body } = req;
    console.log("Entrou aqui mano!");

    try {
        const existeParticipante = await db.collection("participantes").find({ from: body.from }).toArray();
        const messageSchema = joi.object({
            to: joi.string().min(1).required(),
            text: joi.string().min(1).required(),
            type: joi.string().min(6).required(),
        })
        const validation = messageSchema.validate(req.body);
        if (validation.error || !existeParticipante) {
            console.log(validation.error.details);
            res.sendStatus(422);
            return;
        }
        await db.collection("messages").insertOne({ from: req.header.user, to: body.to, text: body.text, type: body.type, time: dayjs().format('HH:MM:SS') });
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const limit = req.query.limit;
    try {
        if (limit) {
            const mensagens = await db.collection("messages").find({}).limit(limit).toArray();
            res.send(mensagens);
        } else {
            const mensagens = await db.collection("messages").find({}).toArray();
            res.send(mensagens);
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post("/status", async (req, res) => {
    const user = req.header.user;
    try {
        const participante = await db.collection("participantes").find({ name: user }).toArray();
        if (!participante) {
            res.sendStatus(404);
            return;
        } else {
            await participante.collection("participantes").updateOne({
                lastStatus: Date.now()
            }, { $set: Date.now() });
            res.sendStatus(200);
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
        mongoClient.close();
    }
})


app.listen(5000);