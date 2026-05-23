const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json()); // permet de lire le body des requêtes en JSON

// ── Schéma ────────────────────────────────────────────────────
// Définit la structure des documents dans la collection MongoDB "utilisateur"
const Utilisateur = mongoose.model(
  "utilisateur",
  new mongoose.Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // unique : pas deux comptes avec le même email
    role: {
      type: String,
      enum: ["client", "livreur", "gestionnaire"], // seules ces 3 valeurs sont acceptées
      required: true,
    },
    mot_passe: { type: String, required: true }, // sera stocké hashé, jamais en clair
    created_at: { type: Date, default: Date.now }, // date automatique à la création
  }),
);

// ── DB ────────────────────────────────────────────────────────
// "db" = nom du service MongoDB dans docker-compose.yml
// En local remplace par "mongodb://localhost:27017/auth-service"
mongoose
  .connect("mongodb://db:27017/auth-service")
  .then(() => console.log("Auth-Service DB Connected"))
  .catch((err) => console.error("DB Error:", err.message));

// ── Routes ────────────────────────────────────────────────────

// Créer un nouveau compte utilisateur
app.post("/auth/register", async (req, res) => {
  const { nom, email, role, mot_passe } = req.body;

  // Vérification que tous les champs sont présents
  if (!nom || !email || !role || !mot_passe)
    return res.status(400).json({ message: "Champs obligatoires manquants" });

  // Vérification que l'email n'est pas déjà utilisé
  if (await Utilisateur.findOne({ email }))
    return res.status(409).json({ message: "Utilisateur déjà existant" });

  // Hashage du mot de passe (10 = nombre de rounds, plus c'est élevé plus c'est sécurisé mais lent)
  const hash = await bcrypt.hash(mot_passe, 10);

  // Sauvegarde en base avec le mot de passe hashé
  const user = await new Utilisateur({
    nom,
    email,
    role,
    mot_passe: hash,
  }).save();

  // On retire mot_passe de la réponse avant de la renvoyer au client
  const { mot_passe: _, ...data } = user.toObject();
  res.status(201).json(data);
});

// Connecter un utilisateur et retourner un token JWT
app.post("/auth/login", async (req, res) => {
  const { email, mot_passe } = req.body;

  // Recherche de l'utilisateur par email
  const user = await Utilisateur.findOne({ email });

  // bcrypt.compare hash le mot de passe entré et le compare au hash stocké en base
  if (!user || !(await bcrypt.compare(mot_passe, user.mot_passe)))
    return res.status(401).json({ message: "Email ou mot de passe incorrect" });

  // Création du token JWT
  // 1er arg : payload (données embarquées dans le token, lisibles par les autres services)
  // 2ème arg : clé secrète pour signer le token (vérifier qu'il n'a pas été falsifié)
  // 3ème arg : options (expiration après 24h)
  const token = jwt.sign(
    { id: user._id, email: user.email, nom: user.nom, role: user.role },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "24h" },
  );

  res.status(200).json({ token });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(4002, () => console.log("Auth-Service at 4002"));
