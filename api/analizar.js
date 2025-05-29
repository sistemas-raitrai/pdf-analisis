import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs/promises";
import pdfParse from "pdf-parse";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  console.log("🔁 Iniciando análisis...");

  const form = new formidable.IncomingForm({
    keepExtensions: true,
    uploadDir: "/tmp",
    maxFileSize: 30 * 1024 * 1024 // 30 MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Error al parsear el formulario:", err);
      return res.status(500).send("Error al procesar el archivo");
    }

    try {
      const file = files.file?.[0] || Object.values(files)[0];
      if (!file || !file.filepath) {
        console.error("❌ Archivo inválido:", file);
        return res.status(400).send("No se recibió ningún archivo PDF válido");
      }

      console.log("📦 Archivo recibido:", {
        name: file.originalFilename || file.newFilename || "desconocido",
        tipo: file.mimetype,
        ruta: file.filepath,
        tamaño: file.size
      });

      // Verificamos si el archivo realmente existe
      try {
        await fs.access(file.filepath);
        console.log("✅ Archivo accesible en:", file.filepath);
      } catch (err) {
        console.error("🚫 El archivo no está accesible:", err);
        return res.status(500).send("No se pudo acceder al archivo subido");
      }

      const buffer = await fs.readFile(file.filepath);
      const data = await pdfParse(buffer);

      console.log("📄 Texto extraído del PDF (primeros 100 caracteres):", data.text.slice(0, 100));

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `Eres un abogado experto en redacción de contratos para agencias de viajes de estudiantes. Analiza el siguiente contrato y entrega un informe claro con observaciones, errores, ambigüedades y recomendaciones de mejora:\n\n${data.text.slice(0, 8000)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      });

      const resultado = completion.choices[0].message.content;
      console.log("✅ Respuesta generada por OpenAI");

      res.status(200).send(resultado);

    } catch (error) {
      console.error("❌ Error interno durante el análisis:", error);
      res.status(500).send("Error al procesar el PDF");
    }
  });
}
