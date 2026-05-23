const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

// ── Schéma ────────────────────────────────────────────────────
const Utilisateur = mongoose.model(
  "utilisateur",
  new mongoose.Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mot_passe: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  }),
);

// ── DB ────────────────────────────────────────────────────────
mongoose
  .connect("mongodb://db:27017/auth-service")
  .then(() => console.log("Auth-Service DB Connected"))
  .catch((err) => console.error("DB Error:", err.message));

// ── Routes ────────────────────────────────────────────────────
app.post("/auth/register", async (req, res) => {
  const { nom, email, mot_passe } = req.body;
  if (!nom || !email || !mot_passe)
    return res.status(400).json({ message: "Champs obligatoires manquants" });

  if (await Utilisateur.findOne({ email }))
    return res.status(409).json({ message: "Utilisateur déjà existant" });

  const hash = await bcrypt.hash(mot_passe, 10);
  const user = await new Utilisateur({ nom, email, mot_passe: hash }).save();
  const { mot_passe: _, ...data } = user.toObject();
  res.status(201).json(data);
});

app.post("/auth/login", async (req, res) => {
  const { email, mot_passe } = req.body;
  const user = await Utilisateur.findOne({ email });
  if (!user || !(await bcrypt.compare(mot_passe, user.mot_passe)))
    return res.status(401).json({ message: "Email ou mot de passe incorrect" });

  const token = jwt.sign(
    { id: user._id, email: user.email, nom: user.nom },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "24h" },
  );
  res.status(200).json({ token });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(4002, () => console.log("Auth-Service at 4002"));
