const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

const LIVRAISON_URL = process.env.LIVRAISON_URL || 'http://livraison-service:3003';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });

  const token = auth.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

app.post('/clients/deliveries', verifyToken, requireRole('client'), async (req, res) => {
  try {
    const response = await axios.post(`${LIVRAISON_URL}/deliveries`, req.body, {
      headers: { authorization: req.headers.authorization },
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

app.get('/clients/deliveries/moi', verifyToken, requireRole('client'), async (req, res) => {
  try {
    const response = await axios.get(`${LIVRAISON_URL}/deliveries/client/${req.user.id}`, {
      headers: { authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

app.get('/clients/:clientId/deliveries', verifyToken, async (req, res) => {
  try {
    const response = await axios.get(`${LIVRAISON_URL}/deliveries/client/${req.params.clientId}`, {
      headers: { authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

app.get('/deliveries/:id', verifyToken, async (req, res) => {
  try {
    const response = await axios.get(`${LIVRAISON_URL}/deliveries/${req.params.id}`, {
      headers: { authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

app.get('/clients/deliveries/:id', verifyToken, async (req, res) => {
  try {
    const response = await axios.get(`${LIVRAISON_URL}/deliveries/${req.params.id}`, {
      headers: { authorization: req.headers.authorization },
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Client-Service at ${PORT}`));
