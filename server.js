// =======================
//  server.js — by Qaes
//  يعمل على Render ويدعم تشغيل الأكواد عبر Piston API
// =======================

import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5500;

app.use(bodyParser.json());
app.use(express.static(__dirname));

async function executeCode(code, language, input) {
  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: language.toLowerCase(),
        version: "*",
        files: [{ name: "main", content: code }],
        stdin: input || ""
      }),
    });

    const data = await response.json();
    if (data.run && data.run.output) return data.run.output;
    else if (data.run && data.run.stderr) return data.run.stderr;
    else return "⚠️ لم يتم الحصول على ناتج.";
  } catch (error) {
    console.error("Error:", error);
    return "❌ حدث خطأ أثناء التنفيذ.";
  }
}

app.post("/execute", async (req, res) => {
  const { code, language, input } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: "يرجى إدخال الكود واللغة أولاً." });
  }

  const output = await executeCode(code, language, input);
  res.json({ output });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ الخادم جاهز ويعمل على المنفذ: http://localhost:${PORT}`);
});
