import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
// import chalk from "chalk";
import dayjs from "dayjs";
import joi from 'joi'


const app = express();
app.use(cors());
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
    const nome = req.body;
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
        let participante = await db.collection("participantes").find({ name: nome.name }).toArray();
        if (participante.length > 0) {
            res.sendStatus(409);
            console.log("Esse nome já existe mano");
            return;
        }
        await db.collection("participantes").insertOne({ ...nome, lastStatus: Date.now() });
        await db.collection("messages").insertOne({ from: nome.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:MM:ss') });
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const participantes = await db.collection("participantes").find().toArray();
        res.send(participantes);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post("/messages", async (req, res) => {
    const { body } = req;
    const messageSchema = joi.object({
        to: joi.string().min(1).required(),
        text: joi.string().min(1).required(),
        type: joi.string().valid('message', 'private_message').required()
    })
    const validation = messageSchema.validate(req.body);
    if (validation.error) {
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }

    try {
        const existeParticipante = await db.collection("participantes").find({ name: req.headers.user }).toArray();
        if (!existeParticipante) {
            res.sendStatus(422);
            return;
        }
        await db.collection("messages").insertOne({ from: req.headers.user, to: body.to, text: body.text, type: body.type, time: dayjs().format('HH:MM:ss') });
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const limit = req.query.limit;
    const user = req.headers.user;
    try {
        if (limit) {
            const mensagens = await db.collection("messages").find({ $or: [{ to: user, type: "private_message" }, { type: "message" }, { type: "status" }, { from: user }] }).limit(parseInt(limit)).toArray();
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
    const user = req.headers.user;
    try {
        const participante = await db.collection("participantes").find({ name: user }).toArray();
        if (participante.length < 1) {
            res.sendStatus(404);
            return;
        } else {
            await db.collection("participantes").updateOne({
                name: user
            }, { $set: { lastStatus: Date.now() } });
            res.sendStatus(200);
        }
        setInterval(async () => {
            const participantesRemovidos = await db.collection("participantes").find({ lastStatus: { $lt: Date.now() - 11000 } }).toArray();
            if (participantesRemovidos.length > 0) {
                await db.collection("messages").insertOne({ from: participantesRemovidos[0].name, to: "Todos", text: "sai da sala...", type: "status", time: dayjs().format('HH:MM:ss') });
                await db.collection("participantes").deleteOne({ lastStatus: { $lt: Date.now() - 11000 } });
            }
        }, 15000);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});



app.listen(5000);