import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs/promises";
import pdfParse from "pdf-parse";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  console.log("🔁 Iniciando análisis de documento PDF...");

  const form = new formidable.IncomingForm({
    keepExtensions: true,
    uploadDir: "/tmp",
    maxFileSize: 30 * 1024 * 1024 // 30 MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Error al parsear el formulario:", err);
      return res.status(500).send("Error al procesar el formulario");
    }

    try {
      const fileObj = files.file?.[0] || Object.values(files)[0];

      if (!fileObj?.filepath) {
        console.error("🚫 No se encontró el archivo válido:", files);
        return res.status(400).send("No se recibió un archivo válido");
      }

      const filePath = fileObj.filepath;
      console.log("📄 Procesando archivo en ruta temporal:", filePath);

      const buffer = await fs.readFile(filePath);
      console.log("✅ Archivo leído correctamente, tamaño:", buffer.length, "bytes");

      const data = await pdfParse(buffer);
      console.log("📃 Texto extraído. Longitud:", data.text.length);

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `Eres un abogado experto en redacción de contratos para agencias de viajes de estudiantes. Analiza el siguiente contrato y entrega un informe claro con observaciones, errores, ambigüedades y recomendaciones de mejora:\n\n${data.text.slice(0, 8000)}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      });

      const result = response.choices[0].message.content;
      console.log("✅ Análisis completado por OpenAI");

      res.status(200).send(result);
    } catch (error) {
      console.error("❌ Error en análisis o conexión con OpenAI:", error);
      res.status(500).send("Error al procesar el archivo");
    }
  });
}
