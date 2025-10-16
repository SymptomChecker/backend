const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// Load dataset
const datasetPath = path.join(__dirname, "symptom_conversations_dataset.json");
let mockConversations = [];

try {
  const data = fs.readFileSync(datasetPath, "utf8");
  mockConversations = JSON.parse(data);
  console.log(`✅ Loaded ${mockConversations.length} conversation samples`);
} catch (err) {
  console.error("⚠️ Failed to load dataset:", err);
}

// In-memory session store
const sessions = {};

// --- Greeting Detection ---
const greetings = [
  "hi", "hello", "hey", "hiya", "howdy", "yo", "sup", "heyyo", "hiyayo", "yo yo",
  "how are you", "how are you doing", "how do you do", "how's it going",
  "how is it going", "how you doing", "how's everything", "how's life",
  "good morning", "good afternoon", "good evening", "good day", "morning",
  "afternoon", "evening", "hi there", "hello there", "hey there", "hiya there",
  "hello friend", "hi friend", "greetings friend", "what's up", "what's happening",
  "greetings", "g'day", "howzit", "aloha", "namaste", "hi hi", "hey hey",
  "hello hello", "hey hi"
];

const greetingResponses = [
  "Hello! How can I assist you today?",
  "Hi there! Tell me how you're feeling.",
  "Hey! What symptoms are you experiencing today?",
  "Greetings! How can I help you today?",
  "Hi! I’m here to help you check your symptoms."
];

function randomGreetingResponse() {
  return greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
}

function detectGreeting(userInput) {
  const cleaned = userInput.toLowerCase().trim().replace(/[^\w\s]/g, "");
  return greetings.some(greet => cleaned.includes(greet));
}

// --- Utilities ---
function filterMeaningfulWords(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function findBestConversation(userInput) {
  const inputLower = userInput.toLowerCase();
  let bestScore = -1;
  let bestConv = null;

  for (const conv of mockConversations) {
    const firstUserMsg = conv.conversation.find(m => m.role === "user");
    if (!firstUserMsg) continue;
    const score = firstUserMsg.text.toLowerCase().split(/\s+/)
      .filter(word => inputLower.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      bestConv = conv;
    }
  }
  return { conv: bestConv, score: bestScore };
}

// --- Start Session ---
app.post("/api/start-session", (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = { conversation: null, currentStep: 0, possible_conditions: [] };
  res.json({ sessionId });
});

// --- Next Step Handler ---
app.post("/api/next-step", (req, res) => {
  const { sessionId, userMessage } = req.body;
  if (!sessionId || !userMessage)
    return res.status(400).json({ error: "sessionId and userMessage required" });

  const session = sessions[sessionId];
  if (!session)
    return res.status(400).json({ error: "Invalid sessionId" });

  const userLower = userMessage.toLowerCase().trim();

  // 🟢 Step 1: Detect greetings first (even before conversation check)
  if (detectGreeting(userMessage)) {
    return res.json({
      assistantMessage: randomGreetingResponse(),
      done: false,
      possible_conditions: []
    });
  }

  // Step 2: Find conversation if not started yet
  if (!session.conversation) {
    const { conv, score } = findBestConversation(userMessage);
    if (!conv || score === 0) {
      return res.json({
        assistantMessage: "I’m sorry, I didn’t understand that. Please describe your symptoms so I can assist you.",
        done: false,
        possible_conditions: []
      });
    }
    session.conversation = conv.conversation;
    session.possible_conditions = conv.possible_conditions;
    session.currentStep = 0;
  }

  const conv = session.conversation;
  let step = session.currentStep;

  if (conv[step]?.role === "user") step++;

  const nextAssistant = conv.slice(step).find(m => m.role === "assistant");

  // Relevance check
  const validNegatives = ["no", "nope", "nothing", "none", "nah"];
  const expectedWords = filterMeaningfulWords(conv[step]?.text || "");
  const inputWords = filterMeaningfulWords(userMessage);
  const overlap = expectedWords.filter(w => inputWords.includes(w)).length;
  const isValidNegative = validNegatives.includes(userLower);
  const symptomKeywords = [
    "pain", "ache", "tired", "weak", "fever", "cough", "sneeze", "sore",
    "throat", "nose", "head", "nausea", "vomit", "cold", "flu",
    "fatigue", "chills", "dizzy", "body", "hurt"
  ];
  const timePatterns = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|week|day|days|weeks|month|months)\b/;
  const containsTime = timePatterns.test(userLower);
  const containsSymptomWord = inputWords.some(w => symptomKeywords.includes(w));

  const isRelevant =
    overlap > 0 ||
    isValidNegative ||
    containsSymptomWord ||
    containsTime ||
    inputWords.length >= 2;

  if (!isRelevant) {
    return res.json({
      assistantMessage: "I’m sorry, I didn’t understand that. Please provide information relevant to your symptoms.",
      done: false,
      possible_conditions: session.possible_conditions
    });
  }

  // Step 3: Continue conversation normally
  let assistantMessage =
    nextAssistant?.text ||
    `It might be related to ${session.possible_conditions.join(", ")}. I recommend staying hydrated and consulting a doctor if it persists.`;

  let done = !nextAssistant;

  if (nextAssistant) {
    const assistantIndex = conv.indexOf(nextAssistant);
    session.currentStep = assistantIndex + 1;
    const remainingAssistant = conv.slice(session.currentStep).some(m => m.role === "assistant");
    if (!remainingAssistant) done = true;
  }

  res.json({
    assistantMessage,
    done,
    possible_conditions: session.possible_conditions
  });
});

app.get("/", (req, res) => res.send("✅ Medichat backend running"));

app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
