const express = require('express');
const mongoose = require('mongoose');
const amqplib = require('amqplib');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongodb:27017/livraison-service';
const AMQP_URL = process.env.AMQP_URL || 'amqp://rabbitmq';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// --- Mongoose model
const Delivery = mongoose.model('Delivery', new mongoose.Schema({
  clientId: { type: String, required: true },
  pickup: { type: Object },
  dropoff: { type: Object },
  assignedTo: { type: String, default: null },
  status: { type: String, default: 'created' },
  historique: [{
    statut: { type: String, required: true },
    date: { type: Date, default: Date.now },
    commentaire: { type: String, default: '' }
  }],
  history: [{ status: String, by: String, at: Date }],
  createdAt: { type: Date, default: Date.now }
}));

mongoose.connect(MONGO_URL)
  .then(() => console.log('Livraison DB connected'))
  .catch(err => console.error('Mongo error', err.message));

// --- RabbitMQ setup
let amqpChannel;
async function setupAmqp(){
  try{
    const conn = await amqplib.connect(AMQP_URL);
    const ch = await conn.createChannel();
    await ch.assertExchange('delivery.status', 'fanout', { durable: false });
    amqpChannel = ch;
    console.log('Connected to AMQP');
  }catch(err){
    console.error('AMQP error', err.message);
  }
}
setupAmqp();

function publishStatusChange(payload){
  if(!amqpChannel) return console.warn('AMQP channel not ready');
  amqpChannel.publish('delivery.status', '', Buffer.from(JSON.stringify(payload)));
}

// --- Auth middleware
function verifyToken(req, res, next){
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({message:'No token'});
  const token = auth.split(' ')[1];
  try{
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  }catch(e){
    return res.status(401).json({message:'Invalid token'});
  }
}

function requireRole(role){
  return (req, res, next) => {
    if(!req.user || req.user.role !== role) return res.status(403).json({message:'Forbidden'});
    next();
  };
}

function requireAnyRole(roles){
  return (req, res, next) => {
    if(!req.user || !roles.includes(req.user.role)) return res.status(403).json({message:'Forbidden'});
    next();
  };
}

function appendTrace(delivery, statut, commentaire){
  const trace = { statut, date: new Date(), commentaire: commentaire || '' };
  delivery.historique = delivery.historique || [];
  delivery.history = delivery.history || [];
  delivery.historique.push(trace);
  delivery.history.push({ status: statut, by: delivery.assignedTo || delivery.clientId || 'system', at: trace.date });
}

// --- Routes
// Create delivery (client)
app.post('/deliveries', verifyToken, requireRole('client'), async (req, res) => {
  const { pickup, dropoff } = req.body;
  const d = new Delivery({ clientId: req.user.id, pickup, dropoff });
  appendTrace(d, 'created', 'Demande créée');
  await d.save();
  res.status(201).json(d);
});

// Get delivery detail for any authenticated role
app.get('/deliveries/:id', verifyToken, async (req, res) => {
  const d = await Delivery.findById(req.params.id);
  if(!d) return res.status(404).json({message:'Not found'});
  res.json(d);
});

// Get deliveries by client (client owns his own deliveries or gestionnaire can inspect)
app.get('/deliveries/client/:clientId', verifyToken, requireAnyRole(['client', 'gestionnaire']), async (req, res) => {
  const { clientId } = req.params;
  if (req.user.role === 'client' && req.user.id !== clientId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const items = await Delivery.find({ clientId }).sort({ createdAt: -1 });
  res.json(items);
});

// Assign delivery (gestionnaire)
app.post('/deliveries/:id/assign', verifyToken, requireRole('gestionnaire'), async (req, res) => {
  const { livreurId } = req.body;
  const d = await Delivery.findById(req.params.id);
  if(!d) return res.status(404).json({message:'Not found'});
  d.assignedTo = livreurId;
  appendTrace(d, 'assigned', `Livraison assignée au livreur ${livreurId}`);
  await d.save();
  res.json(d);
});

// Update status (livreur)
app.patch('/deliveries/:id/status', verifyToken, requireRole('livreur'), async (req, res) => {
  const { status, commentaire } = req.body;
  const d = await Delivery.findById(req.params.id);
  if(!d) return res.status(404).json({message:'Not found'});
  d.status = status;
  appendTrace(d, status, commentaire || `Statut mis à jour vers ${status}`);
  await d.save();
  // publish to rabbitmq
  publishStatusChange({ deliveryId: d._id, status, clientId: d.clientId, assignedTo: d.assignedTo, at: new Date() });
  res.json(d);
});

// Start
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Livraison-Service at ${PORT}`));
