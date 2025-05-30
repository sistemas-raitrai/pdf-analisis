import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import analizar from "./api/analizar.js";

// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos (index.html, estilos.css, imágenes, etc.)
app.use(express.static(__dirname));

// Ruta raíz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Endpoint de análisis
app.post("/api/analizar", analizar);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
