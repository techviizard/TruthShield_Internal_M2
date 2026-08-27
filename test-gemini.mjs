console.log("Script started");

const API_KEY = "AQ.Ab8RN6LQL7BQswaoj2VUBuswVb3f-RhzoRQo7SMGqQjpzGSPfw";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = "gemini-flash-latest";

const response = await fetch(`${BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
  }),
});

console.log("HTTP status:", response.status);
const data = await response.json();
console.log("Response body:", JSON.stringify(data, null, 2));