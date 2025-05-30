import express from "express";
import analizar from "./api/analizar.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.post("/api/analizar", analizar); // Usa tu función como handler directo

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
