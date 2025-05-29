// ✅ /api/analizar.js
import { Configuration, OpenAIApi } from "openai";
import formidable from "formidable";
import fs from "fs/promises";
import pdfParse from "pdf-parse";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  try {
    const form = new formidable.IncomingForm();
    form.uploadDir = "/tmp";
    form.keepExtensions = true;

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Error al procesar archivo:", err);
        return res.status(500).send("Error al recibir el archivo");
      }

      const uploadedFile = files.file;
      if (!uploadedFile || !uploadedFile.filepath) {
        return res.status(400).send("No se recibió ningún archivo");
      }

      try {
        const buffer = await fs.readFile(uploadedFile.filepath);
        const data = await pdfParse(buffer);

        const openai = new OpenAIApi(new Configuration({
          apiKey: process.env.OPENAI_API_KEY
        }));

        const prompt = `Eres un abogado experto en contratos en agencias de viajes de estudiantes. Analiza el siguiente documento, la parte del programa sobretodo, porque el contrato en si ya lo revisamos, pero hay partes que se personalizaron y hay que revisar. Entrega un informe detallado con observaciones, errores, ambigüedades y sugerencias de mejora:\n\n${data.text.slice(0, 8000)}`;

        const completion = await openai.createChatCompletion({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }]
        });

        const result = completion.data.choices[0].message.content;
        res.status(200).send(result);

      } catch (error) {
        console.error("Error al analizar el PDF:", error);
        res.status(500).send("Error al procesar el PDF");
      }
    });
  } catch (err) {
    console.error("Error general:", err);
    res.status(500).send("Error interno del servidor");
  }
}
