// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

app.post("/api/check-symptoms", (req, res) => {
  const { symptoms } = req.body;
  console.log("Received symptoms:", symptoms);

  // Mock AI/NLP result
  const results = [
    { condition: "Common Cold", description: "A viral infection of your nose and throat.", confidence: 85 },
    { condition: "Flu (Influenza)", description: "Cough, sore throat, tiredness, mild fever.", confidence: 70 },
    { condition: "Strep Throat", description: "Bacterial infection with sore throat and fever.", confidence: 55 },
  ];

  res.json({ results });
});

app.get("/", (req, res) => {
  res.send("✅ Symptom Checker API is running. Use POST /api/check-symptoms");
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
