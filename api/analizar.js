import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs/promises";
import mammoth from "mammoth";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  console.log("📥 Iniciando análisis de archivo...");

  const form = formidable({
    keepExtensions: true,
    uploadDir: "/tmp",
    maxFileSize: 30 * 1024 * 1024
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Error al parsear el formulario:", err);
      return res.status(500).send("Error al procesar el formulario");
    }

    try {
      const fileObj = files.file?.[0] || Object.values(files)[0];
      const filePath = fileObj?.filepath;
      const mimeType = fileObj?.mimetype;

      if (!filePath || !mimeType) {
        console.error("🚫 Archivo inválido:", fileObj);
        return res.status(400).send("Archivo inválido o no detectado.");
      }

      console.log(`📄 Tipo de archivo recibido: ${mimeType}`);

      if (mimeType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return res.status(400).send("Solo se aceptan archivos DOCX.");
      }

      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      const extractedText = result.value;

      console.log("📃 Texto extraído. Longitud:", extractedText.length);

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `Eres un abogado experto en contratos de agencias de viajes estudiantiles. Analiza el siguiente texto de contrato y entrega un informe con observaciones, errores, ambigüedades y recomendaciones claras:\n\n${extractedText.slice(0, 8000)}`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }]
      });

      const resultText = response.choices[0].message.content;
      console.log("✅ Análisis completado.");
      res.status(200).send(resultText);

    } catch (error) {
      console.error("❌ Error interno:", error);
      res.status(500).send("Error al procesar el archivo.");
    }
  });
}
