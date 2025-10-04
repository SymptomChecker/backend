// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- API Endpoints ---

// Health check
// List models endpoint
app.get("/api/list-models", async (req, res) => {
    try {
      const response = await openai.models.list();
      res.json(response.data);
    } catch (err) {
      console.error("Error listing models:", err);
      res.status(500).json({ error: err.message });
    }
  });
  

// Check Symptoms endpoint
app.post("/api/check-symptoms", async (req, res) => {
    const { symptoms } = req.body;
    if (!symptoms) return res.status(400).json({ error: "Symptom description is required." });
  
    try {
      const prompt = `
  You are a helpful medical assistant.
  User symptoms: ${symptoms}
  Respond ONLY in JSON: an array of objects with the following fields:
  - "condition" (string)
  - "description" (string)
  - "confidence" (number from 0 to 100)
  `;
  
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
  
      const aiText = completion.choices[0].message.content;
  
      let parsedResults = [];
      try {
        const match = aiText.match(/\[.*\]/s);
        if (match) parsedResults = JSON.parse(match[0]);
      } catch (err) {
        console.warn("Failed to parse AI response as JSON:", err);
      }
  
      res.json({ results: parsedResults, model: "gpt-3.5-turbo" });
    } catch (err) {
      console.error("Error generating AI response, falling back to mock:", err);
  
      // Mock fallback for testing
      const mockResults = [
        { condition: "Common Cold", description: "Mild respiratory infection", confidence: 85 },
        { condition: "Flu", description: "Influenza virus infection", confidence: 60 },
      ];
      res.json({ results: mockResults, model: "mock" });
    }
  });
  

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
